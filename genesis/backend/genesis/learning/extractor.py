"""Information extraction: turn a user message into structured, candidate learnings.

Two extractors produce the same `Extraction` shape:
- `heuristic_extract`: fast regex rules for the most common personal statements.
  They always run, so Genesis learns even with a weak or offline model.
- `llm_extract`: the local LLM in JSON mode, which catches everything else.
Their outputs are merged; the memory engine de-duplicates.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

from genesis.llm.base import LLM, LLMUnavailable
from genesis.llm.jsonutil import parse_json_object

log = logging.getLogger(__name__)


@dataclass
class FactCandidate:
    content: str
    title: str | None = None
    memory_type: str = "personal"
    category: str = "personal"
    importance: str | None = None
    confidence: float = 0.75
    tags: list[str] = field(default_factory=list)


@dataclass
class Extraction:
    facts: list[FactCandidate] = field(default_factory=list)
    profile: dict[str, str] = field(default_factory=dict)
    interests: list[tuple[str, str | None]] = field(default_factory=list)
    goals: list[dict[str, Any]] = field(default_factory=list)
    goal_progress: list[dict[str, Any]] = field(default_factory=list)
    relations: list[dict[str, str]] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    emotional_significance: float = 0.0

    def merge(self, other: Extraction) -> Extraction:
        self.facts += other.facts
        for k, v in other.profile.items():
            self.profile.setdefault(k, v)
        have = {n.lower() for n, _ in self.interests}
        self.interests += [(n, c) for n, c in other.interests if n.lower() not in have]
        self.goals += other.goals
        self.goal_progress += other.goal_progress
        self.relations += other.relations
        self.events += other.events
        self.topics = list(dict.fromkeys(self.topics + other.topics))
        if abs(other.emotional_significance) > abs(self.emotional_significance):
            self.emotional_significance = other.emotional_significance
        return self

    def empty(self) -> bool:
        return not (self.facts or self.profile or self.interests or self.goals or self.goal_progress or self.relations or self.events)


# ----------------------------------------------------------------------------- heuristics

_END = r"(?=\s*(?:[,.;!?]|$|\band\b|\bbut\b|\bbecause\b|\bwhen\b|\bwith\b|\bso\b|\bwhich\b))"
_FAMILY = "son|daughter|wife|husband|partner|girlfriend|boyfriend|fiancée?|brother|sister|mum|mom|mother|dad|father|grandma|gran|nan|grandad|grandpa|grandfather|grandmother|best friend|uncle|aunt|cousin|nephew|niece|boss"
_PETS = "dog|cat|puppy|kitten|rabbit|bunny|parrot|budgie|horse|hamster|guinea pig|tortoise|turtle|snake|lizard|ferret"
_OWNABLE = "boat|car|van|bike|motorbike|motorcycle|house|flat|apartment|garden|allotment|shop|business|caravan|truck|kayak|canoe|guitar|piano|drum kit|computer|pc|laptop|camper|campervan|workshop|3d printer|drone"
_NOT_JOBS = {
    "better",
    "bigger",
    "smaller",
    "faster",
    "slower",
    "older",
    "younger",
    "stronger",
    "weaker",
    "lover",
    "member",
    "beginner",
    "user",
    "fan",
    "believer",
    "person",
    "people",
    "fighter",
    "winner",
    "loser",
    "other",
    "monster",
    "sucker",
    "worrier",
    "overthinker",
    "introvert",
    "extrovert",
    "mess",
    "wreck",
    "night owl",
    "early riser",
}
_JOB_SUFFIX = re.compile(
    r"(er|or|ist|ian|ant|ent|nurse|chef|doctor|engineer|student|mechanic|electrician|plumber|fisherman|carpenter|pilot|surgeon|vet|dentist|teacher|builder|farmer|soldier|officer|cook|coach|artist|designer|writer|lawyer|accountant|manager|director|founder|consultant|developer|programmer|scientist|trader|agent|clerk|driver)$"
)
_ING = {
    "run": "running",
    "swim": "swimming",
    "fish": "fishing",
    "cook": "cooking",
    "read": "reading",
    "draw": "drawing",
    "paint": "painting",
    "code": "coding",
    "game": "gaming",
    "travel": "travelling",
    "bake": "baking",
    "write": "writing",
    "dance": "dancing",
    "hike": "hiking",
    "cycle": "cycling",
    "sing": "singing",
    "camp": "camping",
    "sail": "sailing",
    "climb": "climbing",
    "surf": "surfing",
    "ski": "skiing",
    "garden": "gardening",
    "golf": "golfing",
    "shop": "shopping",
}
_VAGUE = {
    "it",
    "that",
    "this",
    "you",
    "them",
    "him",
    "her",
    "things",
    "stuff",
    "everything",
    "anything",
    "something",
    "that one",
    "the idea",
    "the sound of that",
    "a lot",
    "lots",
    "too",
    "how",
    "what",
    "when",
    "where",
    "to",
    "so",
    "one",
}
_TRIVIAL_GOAL = re.compile(
    r"\b(tonight|today|right now|later|in a bit|this evening|go to bed|sleep|eat|have (lunch|dinner|breakfast)|watch|grab|pee|shower|know|ask|say|see (if|what|how)|check|tell you|talk|chat)\b",
    re.I,
)


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip(" ,.;:!?'\"")


def _orig(sent: str, low: str, m: re.Match[str], group: int) -> str:
    """The matched group with its original casing (matching ran on the lower-cased sentence)."""
    return sent[m.start(group) : m.end(group)] if len(sent) == len(low) else m.group(group)


def _sentences(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"(?<=[.!?])\s+|\n+", text) if p.strip()]


def heuristic_extract(text: str) -> Extraction:
    ex = Extraction()
    for sent in _sentences(text):
        _extract_sentence(sent, ex)
    return ex


def _extract_sentence(sent: str, ex: Extraction) -> None:
    low = sent.lower()
    hypothetical = bool(re.search(r"\b(if i|i wish|would be nice|imagine if|pretend)\b", low))
    if hypothetical:
        return

    # --- name
    m = re.search(r"\b(?i:my name is|my name's|call me|i'm called|i am called)\s+([A-Z][a-zA-Z'-]+(?:\s[A-Z][a-zA-Z'-]+)?)", sent)
    if m:
        name = m.group(1)
        ex.profile["name"] = name
        ex.facts.append(FactCandidate(f"The user's name is {name}.", "User's name", "personal", "personal", "critical", 0.95, ["identity"]))

    # --- age
    m = re.search(r"\bi(?:'m| am) (\d{1,3})(?: years old| yrs old| yo\b|(?=\s*(?:[,.!]|$)))", low)
    if m and 5 <= int(m.group(1)) <= 110:
        ex.profile["age"] = m.group(1)
        ex.facts.append(FactCandidate(f"The user is {m.group(1)} years old.", "User's age", "personal", "personal", "medium", 0.85))

    # --- location / hometown
    m = re.search(r"\b(?i:i (?:live|am based|'m based|am living|'m living) in) ([A-Z][\w'-]+(?:[ ,]+[A-Z][\w'-]+){0,3})", sent)
    if m:
        place = _clean(m.group(1))
        ex.profile["location"] = place
        ex.facts.append(FactCandidate(f"The user lives in {place}.", "Where the user lives", "personal", "personal", "high", 0.85))
        ex.relations.append({"subject": "User", "predicate": "lives_in", "object": place, "object_type": "place"})
    m = re.search(r"\b(?i:i(?:'m| am) (?:originally )?from) ([A-Z][\w'-]+(?:[ ,]+[A-Z][\w'-]+){0,3})", sent)
    if m:
        place = _clean(m.group(1))
        ex.profile["hometown"] = place
        ex.facts.append(FactCandidate(f"The user is from {place}.", "User's hometown", "personal", "personal", "medium", 0.8))
        ex.relations.append({"subject": "User", "predicate": "from", "object": place, "object_type": "place"})

    # --- occupation / employer
    m = re.search(r"\b(?:i work as|i'm working as|my job is|i am|i'm) (?:an? )([a-z][a-z -]{2,40}?)" + _END, low)
    if m:
        job = _clean(m.group(1))
        last = job.split()[-1] if job else ""
        explicit = bool(re.search(r"\b(work as|working as|my job is)\b", low))
        if job and job not in _NOT_JOBS and last not in _NOT_JOBS and (explicit or _JOB_SUFFIX.search(last)) and len(job.split()) <= 4:
            ex.profile["occupation"] = job
            ex.facts.append(
                FactCandidate(f"The user works as a {job}.", "User's occupation", "personal", "personal", "high", 0.8, ["work"])
            )
            ex.relations.append({"subject": "User", "predicate": "works_as", "object": job, "object_type": "concept"})
    m = re.search(r"\b(?i:i work (?:at|for)) ([A-Z][\w&'.-]+(?: [A-Z][\w&'.-]+){0,4})", sent)
    if m:
        employer = _clean(m.group(1))
        ex.profile["employer"] = employer
        ex.facts.append(FactCandidate(f"The user works at {employer}.", "User's employer", "personal", "personal", "high", 0.8, ["work"]))
        ex.relations.append({"subject": "User", "predicate": "works_at", "object": employer, "object_type": "organisation"})

    # --- family and pets (names are critical memories)
    for m in re.finditer(
        rf"\bmy ({_FAMILY})(?:'s name is|,? who(?:'s| is) called| is called| is named| named|,)\s+([A-Z][a-zA-Z'-]+)", sent, re.I
    ):
        rel, name = m.group(1).lower(), m.group(2)
        if name.lower() in {"is", "and", "the", "a", "who", "has", "was"}:
            continue
        ex.facts.append(
            FactCandidate(
                f"The user's {rel} is called {name}.", f"User's {rel}: {name}", "personal", "relationship", "critical", 0.9, ["family", rel]
            )
        )
        ex.relations.append({"subject": "User", "predicate": f"has_{rel.replace(' ', '_')}", "object": name, "object_type": "person"})
        if rel in {"wife", "husband", "partner", "girlfriend", "boyfriend", "fiance", "fiancee", "fiancée"}:
            ex.profile["partner"] = name
    for m in re.finditer(
        rf"\b(?:i have|i've got|i got|we have|we've got) an? ({_PETS})(?: (?:called|named) ([A-Z][a-zA-Z'-]+))?", sent, re.I
    ):
        pet, name = m.group(1).lower(), m.group(2)
        desc = f"a {pet} called {name}" if name else f"a {pet}"
        ex.profile["pets"] = desc
        ex.facts.append(
            FactCandidate(
                f"The user has {desc}.",
                f"User's {pet}" + (f": {name}" if name else ""),
                "personal",
                "relationship",
                "high" if name else "medium",
                0.85,
                ["pets"],
            )
        )
        ex.relations.append({"subject": "User", "predicate": "has_pet", "object": name or pet, "object_type": "pet"})
    for m in re.finditer(
        rf"\bmy ({_PETS})(?:'s name is|,? who(?:'s| is) called| is called| is named| named|,)\s+([A-Z][a-zA-Z'-]+)", sent, re.I
    ):
        pet, name = m.group(1).lower(), m.group(2)
        ex.profile["pets"] = f"a {pet} called {name}"
        ex.facts.append(
            FactCandidate(
                f"The user has a {pet} called {name}.", f"User's {pet}: {name}", "personal", "relationship", "high", 0.9, ["pets"]
            )
        )
        ex.relations.append({"subject": "User", "predicate": "has_pet", "object": name, "object_type": "pet"})

    # --- possessions
    for m in re.finditer(
        rf"\b(?:i own|i have|i've got|i bought|i just bought|i got) (?:a|an|my|our) (?:new |old |little |small |big )?((?:[\w-]+ )?(?:{_OWNABLE}))\b(?: (?:called|named) ([A-Z][\w' -]+?){_END})?",
        sent,
        re.I,
    ):
        thing, name = _clean(m.group(1)).lower(), m.group(2)
        desc = f"a {thing}" + (f" called {name}" if name else "")
        ex.facts.append(
            FactCandidate(f"The user owns {desc}.", f"User's {thing}", "personal", "personal", "medium", 0.8, [thing.split()[-1]])
        )
        ex.relations.append({"subject": "User", "predicate": "owns", "object": name or thing, "object_type": "thing"})

    # --- current projects (medium-term memory)
    m = re.search(
        r"\bi(?:'m| am|'ve been| have been) (?:currently |still )?(working on|building|restoring|fixing|renovating|writing|painting|repairing|learning|studying) (?:up )?(?:my |a |an |the |some |on )?([\w' -]{3,50}?)"
        + _END,
        low,
    )
    if m:
        verb, obj = m.group(1), _clean(m.group(2))
        if obj and obj not in _VAGUE and not obj.startswith(("it ", "that ")):
            if verb in ("learning", "studying"):
                ex.goals.append({"title": f"Learn {obj}", "goal_type": "learning", "horizon": "medium", "description": sent[:200]})
                ex.interests.append((obj, None))
                ex.facts.append(
                    FactCandidate(f"The user is {verb} {obj}.", f"Learning {obj}", "episodic", "goal", "high", 0.8, ["learning"])
                )
            else:
                ex.facts.append(
                    FactCandidate(
                        f"The user is {verb} {('their ' if 'my' in low else '')}{obj}.",
                        f"Project: {verb} {obj}",
                        "episodic",
                        "event",
                        "medium",
                        0.8,
                        ["project"],
                    )
                )
                ex.relations.append({"subject": "User", "predicate": "working_on", "object": obj, "object_type": "thing"})

    # --- likes and dislikes
    for m in re.finditer(
        r"\bi (?:really |absolutely |totally |just )?(love|enjoy|like|adore|am into|'m into|am passionate about|'m passionate about|am obsessed with|'m obsessed with)\s+([\w' -]{3,40}?)"
        + _END,
        low,
    ):
        verb, obj = m.group(1), _clean(m.group(2))
        if re.search(r"\b(don't|do not|never|didn't)\s*$", low[: m.start() + 2]):
            continue
        obj = re.sub(r"^to ", "", obj)
        obj = _ING.get(obj, obj)
        obj = re.sub(r"^(the|a|an|my) ", "", obj)
        if not obj or obj in _VAGUE or obj.split()[0] in _VAGUE or len(obj.split()) > 4:
            continue
        ex.interests.append((obj, None))
        ex.facts.append(
            FactCandidate(
                f"The user {'loves' if verb in ('love', 'adore') or 'passionate' in verb or 'obsessed' in verb else 'enjoys'} {obj}.",
                f"Likes {obj}",
                "personal",
                "preference",
                "medium",
                0.8,
                ["likes"],
            )
        )
        ex.relations.append({"subject": "User", "predicate": "likes", "object": obj, "object_type": "activity"})
    for m in re.finditer(
        r"\bi (?:really )?(?:don't|do not|can't|cannot) (?:like|stand|bear)\s+([\w' -]{3,40}?)"
        + _END
        + r"|\bi (?:hate|dislike|detest)\s+([\w' -]{3,40}?)"
        + _END,
        low,
    ):
        obj = _clean(m.group(1) or m.group(2) or "")
        obj = re.sub(r"^(the|a|an|my|to) ", "", obj)
        if obj and obj not in _VAGUE and len(obj.split()) <= 4:
            ex.facts.append(
                FactCandidate(f"The user dislikes {obj}.", f"Dislikes {obj}", "personal", "preference", "low", 0.75, ["dislikes"])
            )
            ex.relations.append({"subject": "User", "predicate": "dislikes", "object": obj, "object_type": "thing"})

    # --- favourites
    for m in re.finditer(r"\bmy fav(?:ou?rite)? ([\w ]{3,25}?) (?:is|are|has to be) ([\w' &-]{2,40}?)" + _END, low):
        what, val = _clean(m.group(1)), _clean(m.group(2))
        if not val or val in _VAGUE:
            continue
        field_map = {
            "food": "food",
            "meal": "food",
            "dish": "food",
            "band": "music",
            "song": "music",
            "music": "music",
            "singer": "music",
            "artist": "music",
            "film": "movies",
            "movie": "movies",
            "game": "games",
            "video game": "games",
            "book": "books",
            "author": "books",
            "sport": "sports",
            "team": "sports",
        }
        if what in field_map:
            ex.profile[field_map[what]] = val
        imp = "low" if what in {"colour", "color", "number", "letter", "emoji"} else "medium"
        ex.facts.append(
            FactCandidate(f"The user's favourite {what} is {val}.", f"Favourite {what}", "personal", "preference", imp, 0.85, ["favourite"])
        )

    # --- goals
    m = re.search(
        r"\b(?:i(?:'d| would) (?:really )?(?:like|love) to|i (?:really )?want to|i wanna|i(?:'m| am) (?:planning|hoping|aiming|trying|determined) to|i plan to|i hope to|i intend to|my goal is to|my dream is to|one day i(?:'ll| will)) ([\w' ,-]{4,90}?)"
        + r"(?=\s*(?:[.;!?]|$|\bbut\b|\bbecause\b|\bso\b))",
        low,
    )
    if m:
        goal = _clean(_orig(sent, low, m, 1))
        if goal and len(goal) > 6 and not _TRIVIAL_GOAL.search(goal):
            horizon = "long" if re.search(r"\b(one day|dream|someday|eventually|retire)\b", low) else "medium"
            ex.goals.append({"title": goal[:1].upper() + goal[1:], "horizon": horizon, "description": sent[:200]})
            ex.facts.append(FactCandidate(f"The user wants to {goal}.", f"Goal: {goal}", "personal", "goal", "high", 0.8, ["goal"]))
    m = re.search(r"\bi(?:'m| am) saving (?:up )?for ([\w' -]{3,50}?)" + _END, low)
    if m:
        what = _clean(m.group(1))
        ex.goals.append({"title": f"Save for {what}", "goal_type": "finance", "horizon": "medium", "description": sent[:200]})

    # --- life events and achievements
    m = re.search(
        r"\bi (?:just |finally |recently )?(passed (?:my |the )?[\w ]{3,30}|graduated(?: from [\w ]{3,30})?|got (?:engaged|married|promoted|the job|a new job|a promotion)|launched (?:my |the |a )?[\w ]{3,30}|won (?:the |a |my )?[\w ]{3,30}|finished (?:my |the )?[\w ]{3,30}|moved (?:house|to [A-Z][\w ]{2,30})|started (?:a new job|my (?:own )?business|university|college|a course)|caught (?:a|my first) [\w ]{3,30}|became an? [\w ]{3,20}|retired)"
        + _END,
        sent,
        re.I,
    )
    if m:
        what = _clean(m.group(1))
        category = (
            "achievement"
            if re.match(r"(passed|graduated|won|finished|launched|got promoted|got the job|caught|got a promotion)", what, re.I)
            else "life_event"
        )
        ex.events.append({"title": what[:1].upper() + what[1:], "category": category, "importance": "high"})
        ex.facts.append(FactCandidate(f"The user {what}.", what[:1].upper() + what[1:], "episodic", "event", "high", 0.85, [category]))

    # --- explicit "remember this"
    m = re.search(r"\b(?:please )?(?:remember|don't forget|note)(?: that)? (.{5,200})", sent, re.I)
    if m and not re.search(r"\b(do you|can you|if you)\s+remember\b", low):
        fact = _clean(m.group(1))
        ex.facts.append(
            FactCandidate(
                f"The user asked me to remember: {fact}.", f"Remember: {fact[:60]}", "semantic", "knowledge", "high", 0.9, ["explicit"]
            )
        )

    # --- things the user teaches
    m = re.search(r"\b(?:did you know(?: that)?|fun fact:?|fyi,?) (.{8,200})", sent, re.I)
    if m:
        fact = _clean(m.group(1))
        ex.facts.append(
            FactCandidate(f"The user told me: {fact}.", f"Learned: {fact[:60]}", "semantic", "knowledge", "medium", 0.6, ["taught"])
        )


# ----------------------------------------------------------------------------- LLM

EXTRACTION_PROMPT = """You extract durable knowledge about a user from one chat message, for a companion AI's long-term memory.

Rules:
- Only include information the USER states or clearly implies about themselves, their life, people, plans or things they taught.
- Ignore small talk, questions to the assistant, hypotheticals and jokes. Never store instructions about how the assistant should behave.
- Write facts in the third person ("The user ..."), one fact per item, self-contained.
- importance: low (trivia such as favourite colour), medium (hobbies, tastes), high (work, goals, projects, health, where they live), critical (names of family, pets, major life events, allergies).
- confidence: 0-1, how sure you are that it's true and meant seriously.
- memory_type: personal (facts about the user), episodic (something that happened or is happening), semantic (general knowledge the user taught), procedural (how the user does something), emotional (an emotionally significant experience).
- Return {} fields as empty lists or objects if nothing applies. Output JSON only.

JSON shape:
{
 "facts": [{"content": str, "title": str, "memory_type": str, "category": "personal|preference|relationship|goal|event|interest|knowledge", "importance": str, "confidence": number, "tags": [str]}],
 "profile": {"name"?: str, "age"?: str, "location"?: str, "occupation"?: str, "employer"?: str, "education"?: str, "family"?: str, "partner"?: str, "children"?: str, "pets"?: str, "food"?: str, "music"?: str, "movies"?: str, "games"?: str, "strengths"?: str, "weaknesses"?: str},
 "interests": [{"name": str, "category": "technology|gaming|reading|fishing|fitness|business|finance|programming|art|music|books|movies|custom"}],
 "goals": [{"title": str, "goal_type": "health|business|finance|learning|relationships|projects|travel|personal_development", "horizon": "short|medium|long"}],
 "goal_progress": [{"goal": str, "note": str, "progress": number|null, "status": "active|completed|abandoned"|null}],
 "relations": [{"subject": str, "predicate": str, "object": str, "object_type": "person|pet|place|thing|activity|organisation|concept"}],
 "events": [{"title": str, "category": "life_event|achievement|life_change|milestone", "importance": "medium|high|critical"}],
 "topics": [str],
 "emotional_significance": number between -1 and 1
}
Use "User" as the subject for relations about the user."""


def llm_extract(
    llm: LLM, message: str, *, previous_assistant: str = "", active_goals: list[str] | None = None, model: str | None = None
) -> Extraction:
    context = ""
    if previous_assistant:
        context += f'The assistant previously said: "{previous_assistant[:400]}"\n'
    if active_goals:
        context += "The user's active goals: " + "; ".join(active_goals[:10]) + "\n"
    prompt = f'{context}User message: "{message[:3000]}"\nReturn the JSON.'
    try:
        res = llm.chat(
            [{"role": "system", "content": EXTRACTION_PROMPT}, {"role": "user", "content": prompt}],
            json_mode=True,
            temperature=0.1,
            model=model,
        )
    except LLMUnavailable as e:
        log.info("LLM extraction skipped: %s", e)
        return Extraction()
    return parse_llm_extraction(parse_json_object(res.content))


def parse_llm_extraction(data: dict[str, Any]) -> Extraction:
    ex = Extraction()

    def _list(key: str) -> list[Any]:
        v = data.get(key)
        return v if isinstance(v, list) else []

    for f in _list("facts"):
        if not isinstance(f, dict) or not isinstance(f.get("content"), str):
            continue
        try:
            conf = float(f.get("confidence", 0.7))
        except (TypeError, ValueError):
            conf = 0.7
        ex.facts.append(
            FactCandidate(
                content=f["content"],
                title=f.get("title") if isinstance(f.get("title"), str) else None,
                memory_type=str(f.get("memory_type", "personal")),
                category=str(f.get("category", "personal")),
                importance=str(f.get("importance", "medium")),
                confidence=max(0.0, min(1.0, conf)),
                tags=[str(t) for t in f.get("tags", []) if isinstance(t, (str, int))][:8] if isinstance(f.get("tags"), list) else [],
            )
        )
    if isinstance(data.get("profile"), dict):
        ex.profile = {str(k): str(v) for k, v in data["profile"].items() if isinstance(v, (str, int)) and str(v).strip()}
    for i in _list("interests"):
        if isinstance(i, dict) and isinstance(i.get("name"), str):
            ex.interests.append((i["name"], i.get("category") if isinstance(i.get("category"), str) else None))
        elif isinstance(i, str):
            ex.interests.append((i, None))
    ex.goals = [g for g in _list("goals") if isinstance(g, dict) and isinstance(g.get("title"), str)]
    ex.goal_progress = [g for g in _list("goal_progress") if isinstance(g, dict) and isinstance(g.get("goal"), str)]
    ex.relations = [
        {k: str(r.get(k, "")) for k in ("subject", "predicate", "object", "object_type")}
        for r in _list("relations")
        if isinstance(r, dict) and r.get("subject") and r.get("predicate") and r.get("object")
    ]
    ex.events = [e for e in _list("events") if isinstance(e, dict) and isinstance(e.get("title"), str)]
    ex.topics = [str(t)[:40] for t in _list("topics") if isinstance(t, str)][:8]
    try:
        ex.emotional_significance = max(-1.0, min(1.0, float(data.get("emotional_significance", 0) or 0)))
    except (TypeError, ValueError):
        pass
    return ex
