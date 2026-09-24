"""Memory engine: storing, de-duplicating, linking, retrieving and ranking memories.

Retrieval is hybrid: vector similarity from the embedding index plus keyword
matches from SQLite, so memory keeps working (less cleverly) when the embedding
model is offline. Ranking blends relevance with importance, recency, how often a
memory has been useful, emotional weight and confidence.
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from genesis.db.database import DEFAULT_USER_ID
from genesis.db.models import Memory, MemoryLink
from genesis.llm.base import Embedder, LLMUnavailable
from genesis.logging_setup import log_event
from genesis.memory.vector_store import VectorStore
from genesis.safety.guard import sanitize, validate_memory
from genesis.timeutil import utcnow

log = logging.getLogger(__name__)

MEMORY_TYPES = ("episodic", "semantic", "procedural", "emotional", "personal")
IMPORTANCE_LEVELS = {"low": 0.2, "medium": 0.45, "high": 0.7, "critical": 0.95}
LONG_TERM_TYPES = {"personal", "semantic", "procedural"}

_STOPWORDS = set(
    "a an and are as at be but by can did do does for from had has have how i i'm im in is it its just me my of on or so "
    "that the their them then there they this to was we were what when where which who why will with you your yours "
    "about been being could would should really very much any some our us he she him her his hers it's don't didn't "
    "like get got going go know think want yes no ok okay hi hello hey".split()
)


def importance_label(score: float) -> str:
    if score >= 0.85:
        return "critical"
    if score >= 0.6:
        return "high"
    if score >= 0.33:
        return "medium"
    return "low"


def importance_score(value: str | float | None, default: float = 0.45) -> float:
    if value is None:
        return default
    if isinstance(value, str):
        return IMPORTANCE_LEVELS.get(value.lower().strip(), default)
    return max(0.0, min(1.0, float(value)))


_CRITICAL = re.compile(
    r"\b(my (son|daughter|child|kids?|children|wife|husband|partner|mum|mom|dad|father|mother|baby)\b|allerg|diagnos|passed away|died|funeral|pregnan|born|married|divorc|my name is|surgery|cancer)",
    re.I,
)
_HIGH = re.compile(
    r"\b(goal|career|job|work(ing)? (as|at|on)|business|dream|plan(ning)? to|want to|hope to|saving for|health|moving to|studying|degree|launch|my (brother|sister|friend|boss|dog|cat|pet)|live in|from)\b",
    re.I,
)
_LOW = re.compile(r"\b(favou?rite (colou?r|number|letter|emoji)|had .{0,20} for (lunch|breakfast|dinner)|weather)\b", re.I)


def estimate_importance(text: str, category: str = "other") -> float:
    """Heuristic importance when the model didn't supply one."""
    if _CRITICAL.search(text):
        return 0.9
    if _LOW.search(text):
        return 0.2
    if _HIGH.search(text) or category in {"goal", "relationship", "personal"}:
        return 0.65
    if category in {"preference", "interest"}:
        return 0.45
    return 0.35


def content_hash(text: str) -> str:
    norm = re.sub(r"[^a-z0-9 ]", "", re.sub(r"\s+", " ", text.lower())).strip()
    return hashlib.sha256(norm.encode()).hexdigest()


def keywords(text: str) -> list[str]:
    toks = re.findall(r"[a-z0-9']{3,}", text.lower())
    seen: list[str] = []
    for t in toks:
        if t not in _STOPWORDS and t not in seen:
            seen.append(t)
    return seen[:12]


class MemoryRejected(ValueError):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class ScoredMemory:
    memory: Memory
    score: float
    relevance: float


class MemoryEngine:
    DUPLICATE_SIMILARITY = 0.93
    LINK_SIMILARITY = 0.62
    MIN_RELEVANCE = 0.3

    def __init__(self, embedder: Embedder, store: VectorStore):
        self.embedder = embedder
        self.store = store
        self._nomic = "nomic" in embedder.model_name

    # ------------------------------------------------------------------ embedding helpers

    def _embed_docs(self, texts: list[str]) -> list[list[float]] | None:
        if self._nomic:
            texts = [f"search_document: {t}" for t in texts]
        try:
            return self.embedder.embed(texts)
        except LLMUnavailable as e:
            log.warning("embedding unavailable, memory stored without vector: %s", e)
            return None

    def _embed_query(self, text: str) -> list[float] | None:
        q = f"search_query: {text}" if self._nomic else text
        try:
            return self.embedder.embed([q])[0]
        except LLMUnavailable:
            return None

    @staticmethod
    def _meta(m: Memory) -> dict:
        return {"memory_type": m.memory_type, "category": m.category, "user_id": m.user_id}

    def _index(self, m: Memory) -> list[float] | None:
        vecs = self._embed_docs([f"{m.title}. {m.content}"])
        if not vecs:
            m.indexed = False
            return None
        self.store.upsert([m.id], vecs, [self._meta(m)])
        m.indexed = True
        m.embedding_model = self.embedder.model_name
        return vecs[0]

    # ------------------------------------------------------------------ write

    def add(
        self,
        s: Session,
        content: str,
        *,
        title: str | None = None,
        memory_type: str = "episodic",
        category: str = "other",
        importance: str | float | None = None,
        confidence: float = 0.7,
        source: str = "conversation",
        source_ref: str | None = None,
        emotional_score: float = 0.0,
        tags: list[str] | None = None,
        tier: str | None = None,
        user_id: int = DEFAULT_USER_ID,
        validate: bool = True,
    ) -> tuple[Memory, bool]:
        """Store a memory. Returns (memory, created). Duplicates reinforce the existing memory instead."""
        content = sanitize(content, 1500)
        if memory_type not in MEMORY_TYPES:
            memory_type = "episodic"
        if validate:
            verdict = validate_memory(content, source=source, confidence=confidence)
            if not verdict.ok:
                log_event("memory.rejected", reason=verdict.reason, source=source, preview=content[:60])
                raise MemoryRejected(verdict.reason)

        score = importance_score(importance, estimate_importance(content, category))
        h = content_hash(content)
        existing = s.scalars(select(Memory).where(Memory.user_id == user_id, Memory.content_hash == h, Memory.archived.is_(False))).first()
        if existing:
            self._reinforce(existing, score, confidence, tags)
            return existing, False

        m = Memory(
            user_id=user_id,
            title=sanitize(title or _auto_title(content), 200),
            content=content,
            memory_type=memory_type,
            category=category[:32],
            tier=tier or ("long" if memory_type in LONG_TERM_TYPES or score >= 0.6 else "medium"),
            importance_score=score,
            confidence=max(0.0, min(1.0, confidence)),
            source=source,
            source_ref=source_ref,
            emotional_score=max(-1.0, min(1.0, emotional_score)),
            tags=sorted({t.lower().strip()[:40] for t in (tags or []) if t and t.strip()})[:12],
            content_hash=h,
        )
        s.add(m)
        s.flush()

        vec = self._index(m)
        if vec is not None:
            neighbours = [(mid, sim) for mid, sim in self.store.query(vec, 6, where={"user_id": user_id}) if mid != m.id]
            dup = next((mid for mid, sim in neighbours if sim >= self.DUPLICATE_SIMILARITY), None)
            if dup is not None:
                other = s.get(Memory, dup)
                if other is not None and not other.archived and other.memory_type == m.memory_type:
                    # Near-identical wording: keep one memory, strengthen it.
                    self.store.delete([m.id])
                    s.delete(m)
                    s.flush()
                    self._reinforce(other, score, confidence, tags)
                    return other, False
            for mid, sim in neighbours:
                if sim >= self.LINK_SIMILARITY:
                    self.link(s, m.id, mid, "related", strength=round(sim, 3))

        log_event(
            "memory.created",
            memory_id=m.id,
            memory_type=m.memory_type,
            category=m.category,
            importance=importance_label(m.importance_score),
            source=source,
            indexed=m.indexed,
        )
        return m, True

    def _reinforce(self, m: Memory, score: float, confidence: float, tags: list[str] | None) -> None:
        m.importance_score = max(m.importance_score, score)
        m.confidence = min(1.0, max(m.confidence, confidence) + 0.05)
        if tags:
            m.tags = sorted(set(m.tags or []) | {t.lower().strip()[:40] for t in tags if t.strip()})[:12]
        if m.tier == "medium" and m.importance_score >= 0.6:
            m.tier = "long"
        m.updated_at = utcnow()
        log_event("memory.reinforced", memory_id=m.id, confidence=round(m.confidence, 3))

    def link(self, s: Session, source_id: int, target_id: int, relation: str = "related", strength: float = 0.5) -> None:
        if source_id == target_id:
            return
        exists = s.scalars(
            select(MemoryLink).where(
                or_(
                    (MemoryLink.source_id == source_id) & (MemoryLink.target_id == target_id),
                    (MemoryLink.source_id == target_id) & (MemoryLink.target_id == source_id),
                ),
                MemoryLink.relation == relation,
            )
        ).first()
        if not exists:
            s.add(MemoryLink(source_id=source_id, target_id=target_id, relation=relation, strength=strength))
            s.flush()

    def update(self, s: Session, memory_id: int, **fields) -> Memory:
        m = s.get(Memory, memory_id)
        if m is None:
            raise KeyError(memory_id)
        reembed = False
        if fields.get("content") is not None:
            content = sanitize(fields["content"], 1500)
            verdict = validate_memory(content, source="user_manual", confidence=1.0)
            if not verdict.ok:
                raise MemoryRejected(verdict.reason)
            m.content = content
            m.content_hash = content_hash(content)
            reembed = True
        if fields.get("title") is not None:
            m.title = sanitize(fields["title"], 200)
            reembed = True
        if fields.get("importance") is not None:
            m.importance_score = importance_score(fields["importance"], m.importance_score)
        if fields.get("confidence") is not None:
            m.confidence = max(0.0, min(1.0, float(fields["confidence"])))
        if fields.get("tags") is not None:
            m.tags = sorted({t.lower().strip()[:40] for t in fields["tags"] if t.strip()})[:12]
        if fields.get("memory_type") in MEMORY_TYPES:
            m.memory_type = fields["memory_type"]
            reembed = True
        if fields.get("category"):
            m.category = fields["category"][:32]
            reembed = True
        if fields.get("archived") is not None:
            m.archived = bool(fields["archived"])
            if m.archived:
                self.store.delete([m.id])
                m.indexed = False
            else:
                reembed = True
        s.flush()
        if reembed and not m.archived:
            self._index(m)
        log_event("memory.updated", memory_id=m.id, fields=sorted(k for k, v in fields.items() if v is not None))
        return m

    def delete(self, s: Session, memory_id: int) -> None:
        m = s.get(Memory, memory_id)
        if m is None:
            raise KeyError(memory_id)
        s.delete(m)
        s.flush()
        self.store.delete([memory_id])
        log_event("memory.deleted", memory_id=memory_id)

    def archive(self, s: Session, m: Memory, superseded_by: int | None = None) -> None:
        m.archived = True
        m.superseded_by = superseded_by
        m.indexed = False
        self.store.delete([m.id])

    # ------------------------------------------------------------------ read

    def search(
        self,
        s: Session,
        query: str,
        *,
        k: int = 8,
        memory_types: list[str] | None = None,
        user_id: int = DEFAULT_USER_ID,
        min_relevance: float | None = None,
    ) -> list[ScoredMemory]:
        min_rel = self.MIN_RELEVANCE if min_relevance is None else min_relevance
        relevance: dict[int, float] = {}

        vec = self._embed_query(query) if query.strip() else None
        if vec is not None:
            where = {"user_id": user_id}
            for mid, sim in self.store.query(vec, k * 4, where=where):
                relevance[mid] = max(relevance.get(mid, 0.0), sim)

        kws = keywords(query)
        if kws:
            conds = [func.lower(Memory.content).contains(w) | func.lower(Memory.title).contains(w) for w in kws]
            rows = s.scalars(select(Memory).where(Memory.user_id == user_id, Memory.archived.is_(False), or_(*conds)).limit(k * 4)).all()
            for m in rows:
                text = f"{m.title} {m.content}".lower()
                hits = sum(1 for w in kws if w in text)
                kw_rel = 0.35 + 0.45 * hits / len(kws)
                relevance[m.id] = max(relevance.get(m.id, 0.0), kw_rel)

        if not relevance:
            return []
        mems = s.scalars(select(Memory).where(Memory.id.in_(relevance), Memory.archived.is_(False))).all()
        now = utcnow()
        out: list[ScoredMemory] = []
        for m in mems:
            if memory_types and m.memory_type not in memory_types:
                continue
            rel = relevance[m.id]
            if rel < min_rel:
                continue
            out.append(ScoredMemory(m, self.rank(m, rel, now), rel))
        out.sort(key=lambda sm: sm.score, reverse=True)
        log_event("memory.retrieval", query_preview=query[:60], candidates=len(relevance), returned=min(k, len(out)))
        return out[:k]

    @staticmethod
    def rank(m: Memory, relevance: float, now=None) -> float:
        now = now or utcnow()
        age_days = max(0.0, (now - m.created_at).total_seconds() / 86400)
        half_life = 180.0 if m.tier == "long" else 21.0
        recency = math.exp(-age_days * math.log(2) / half_life)
        recall = min(1.0, math.log1p(m.retrieval_count) / math.log(20))
        score = (
            0.60 * relevance
            + 0.15 * m.importance_score
            + 0.10 * recency
            + 0.05 * recall
            + 0.05 * abs(m.emotional_score)
            + 0.05 * m.confidence
        )
        return round(score, 4)

    def mark_recalled(self, s: Session, ids: list[int]) -> None:
        if not ids:
            return
        now = utcnow()
        for m in s.scalars(select(Memory).where(Memory.id.in_(ids))):
            m.retrieval_count += 1
            m.last_recalled = now
            if m.tier == "medium" and m.retrieval_count >= 5:
                m.tier = "long"  # repeatedly useful: promote to long-term memory

    def recent(self, s: Session, *, days: float = 7, limit: int = 20, user_id: int = DEFAULT_USER_ID) -> list[Memory]:
        since = utcnow() - timedelta(days=days)
        return list(
            s.scalars(
                select(Memory)
                .where(Memory.user_id == user_id, Memory.archived.is_(False), Memory.created_at >= since)
                .order_by(Memory.created_at.desc())
                .limit(limit)
            )
        )

    def important(self, s: Session, *, limit: int = 8, user_id: int = DEFAULT_USER_ID) -> list[Memory]:
        """Core memories that should inform every conversation regardless of topic."""
        return list(
            s.scalars(
                select(Memory)
                .where(Memory.user_id == user_id, Memory.archived.is_(False), Memory.importance_score >= 0.85)
                .order_by(Memory.importance_score.desc(), Memory.updated_at.desc())
                .limit(limit)
            )
        )

    def related_ids(self, s: Session, memory_id: int) -> list[int]:
        rows = s.scalars(select(MemoryLink).where(or_(MemoryLink.source_id == memory_id, MemoryLink.target_id == memory_id))).all()
        return sorted({r.target_id if r.source_id == memory_id else r.source_id for r in rows})

    # ------------------------------------------------------------------ maintenance

    def reindex(self, s: Session, *, limit: int = 500) -> dict[str, int]:
        """Embed memories missing from the index and drop index entries with no memory behind them."""
        pending = s.scalars(
            select(Memory)
            .where(
                Memory.archived.is_(False),
                or_(Memory.indexed.is_(False), Memory.embedding_model != self.embedder.model_name, Memory.embedding_model.is_(None)),
            )
            .limit(limit)
        ).all()
        indexed = 0
        if pending:
            vecs = self._embed_docs([f"{m.title}. {m.content}" for m in pending])
            if vecs:
                self.store.upsert([m.id for m in pending], vecs, [self._meta(m) for m in pending])
                for m in pending:
                    m.indexed = True
                    m.embedding_model = self.embedder.model_name
                indexed = len(pending)
        live = set(s.scalars(select(Memory.id).where(Memory.archived.is_(False))))
        orphans = sorted(self.store.ids() - live)
        self.store.delete(orphans)
        if indexed or orphans:
            log_event("memory.reindexed", indexed=indexed, orphans_removed=len(orphans))
        return {"indexed": indexed, "orphans_removed": len(orphans), "pending": len(pending) - indexed}

    def rebuild_if_empty(self, s: Session) -> None:
        """An in-memory store starts empty: mark everything for reindex."""
        if self.store.count() == 0:
            for m in s.scalars(select(Memory).where(Memory.indexed.is_(True))):
                m.indexed = False
            s.flush()


def _auto_title(content: str) -> str:
    first = re.split(r"(?<=[.!?])\s", content.strip(), maxsplit=1)[0]
    return first[:80] + ("…" if len(first) > 80 else "")
