# Memory system design

Memory is the core of Genesis. Everything else (personality, relationship, goals, follow-up questions) depends on the companion remembering you accurately over months and years.

## Memory types

| Layer | Where it lives | What it holds | Lifetime |
|---|---|---|---|
| **Short-term** | `messages` of the current conversation (last 20 go into the prompt) | The live conversation, session state | The conversation |
| **Medium-term** | `memories.tier = 'medium'` | Recent projects, recent interests, this week's discussions | Promoted to long-term if useful; archived after ~60 days if trivial and never recalled |
| **Long-term** | `memories.tier = 'long'` | Personal facts, relationships, goals, history, life events | Permanent |

Each memory also has a cognitive **type**:

| `memory_type` | Examples |
|---|---|
| `personal` | "The user's daughter is called Mia." "The user lives in Plymouth." |
| `episodic` | "The user is restoring their fishing boat." "Conversation on Tuesday: …" |
| `semantic` | Things the user taught; insights from reflection; document chunks |
| `procedural` | How the user does things ("The user ties a palomar knot for braid") |
| `emotional` | Experiences with strong emotional significance (a loss, a big win) |

The `category` field is orthogonal: personal, preference, relationship, goal, event, interest, knowledge, reflection, summary, other.

## Attributes

Every memory row has `id`, `title`, `content`, `memory_type`, `category`, `tier`, `importance_score` (0-1, shown as low/medium/high/critical), `confidence` (0-1), `created_at` (the timestamp), `source` (conversation, user, user_manual, reflection, document, consolidation, tool, vision), `source_ref` (e.g. `message:42`), `emotional_score` (-1..1), `retrieval_count`, `last_recalled`, `tags`, `content_hash`, `embedding_model`, `indexed`, `archived` and `superseded_by`. Related memories are stored as `memory_links` (related, merged_into). The embedding itself lives in ChromaDB under the memory's id.

## Importance

| Level | Score | Examples |
|---|---|---|
| Low | < 0.33 | Favourite colour, what they had for lunch |
| Medium | 0.33-0.6 | Hobbies, tastes, a film they liked |
| High | 0.6-0.85 | Career, goals, projects, where they live, health |
| Critical | ≥ 0.85 | Names of family members and pets, major life events, allergies |

The LLM extractor assigns importance. If it didn't, the heuristics in `estimate_importance` do. Critical memories are "core" and go into every prompt.

## Writing a memory

```
candidate ─► sanitise ─► validate_memory ─► exact-duplicate check (content hash)
          ─► store row ─► embed (nomic-embed-text, "search_document:" prefix)
          ─► near-duplicate check (cosine ≥ 0.93, same type ⇒ reinforce existing instead)
          ─► auto-link neighbours (cosine ≥ 0.62)
```

Validation rejects: too short or too long, no real words, prompt-injection patterns, directives aimed at the companion ("always answer in French"), secrets, and confidence below the source's minimum. A duplicate never creates a second memory. It **reinforces** the existing one (confidence +0.05, importance keeps the max).

If the embedding model is down, the memory is still stored with `indexed = false`, and the `reindex` job embeds it later.

## Retrieval (RAG), before every reply

1. **Query.** The user's message. Very short messages ("yes, the big one") borrow the previous exchange for context.
2. **Vector search.** The query is embedded with the `search_query:` prefix, and the top k×4 candidates come from ChromaDB.
3. **Keyword search.** Significant words are matched in SQLite (hybrid search, and the fallback when embeddings are down).
4. **Rank.**

   ```
   score = 0.60·relevance + 0.15·importance + 0.10·recency + 0.05·recall + 0.05·|emotion| + 0.05·confidence
   recency = 2^(-age / half_life), half_life = 21 days (medium tier) or 180 days (long tier)
   recall  = min(1, ln(1 + retrieval_count) / ln 20)
   ```

   Candidates below relevance 0.3 are dropped.
5. **Inject.** The top 6 go into the prompt with a human "when" ("yesterday", "3 weeks ago"), quoted as data. Core memories and graph facts about mentioned entities are added.
6. **Mark recalled.** `retrieval_count += 1`. A medium-tier memory recalled 5 times is promoted to long-term.

## Consolidation (hourly "sleep")

1. **Summarise** conversations that have been idle for 30+ minutes into an episodic `summary` memory, and set the conversation's title, summary and topics.
2. **Merge** near-duplicates (cosine ≥ 0.95, same type): keep the stronger one, combine recall counts and tags, archive the other with `superseded_by`, and link them with `merged_into`.
3. **Promote** medium-tier memories that proved useful (≥ 3 recalls, importance ≥ 0.6, or ≥ 2 recalls after 30 days).
4. **Archive** stale trivia: medium tier, older than 60 days, importance < 0.35, never recalled, and not a goal, relationship or summary. Archived memories are hidden from retrieval but never deleted, and can be restored from the Memories page.
5. **Decay** interests not mentioned for 30 days (×0.95, floor 5).

## Knowledge graph

Alongside the memories, the knowledge engine keeps **entities** (user, person, pet, place, thing, activity, organisation, concept, goal) and **links** (`likes`, `owns`, `lives_in`, `has_daughter`, `working_on`, `wants_to`, …). Every statement is also a `knowledge_item` with source, confidence, evidence (which message) and a retrieval count. When a message mentions a known entity, its links are added to the prompt (graph-RAG).

```
User ──likes──► fishing
  │ ──owns──► Sea Breeze ──moored_at──► Sutton Harbour
  │ ──has_daughter──► Mia
  └──wants_to──► Learn Python
```

## Profile and contradictions

Profile fields (name, age, location, occupation, family, pets, favourites, …) are kept as key/value rows with confidence and history. A new value replaces the old one only if its confidence is at least the old confidence minus 0.1, or if you edited it yourself. Otherwise it's recorded as a `conflict`, and the question engine may ask about it: "You'd mentioned Leeds, did you move to Bristol?"

## Privacy

Everything stays on your machine: `data/genesis.db` (SQLite), `data/chroma/` (vectors) and `data/backups/`. Secrets are redacted before storage. You can view, edit, archive or delete any memory, and deleting a conversation removes the transcript (but not what was learned from it, which you can delete separately).
