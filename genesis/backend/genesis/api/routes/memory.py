from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from genesis.api import serializers as ser
from genesis.api.deps import get_svc, not_found
from genesis.api.schemas import MemoryAdd, MemoryDelete, MemorySearch, MemoryUpdate
from genesis.db.models import Memory
from genesis.memory.engine import IMPORTANCE_LEVELS, MemoryRejected
from genesis.services import Services

router = APIRouter(prefix="/memory", tags=["memory"])

_BANDS = {"low": (0.0, 0.33), "medium": (0.33, 0.6), "high": (0.6, 0.85), "critical": (0.85, 1.01)}


@router.get("")
def list_memories(
    memory_type: str | None = None,
    importance: str | None = None,
    include_archived: bool = False,
    limit: int = 50,
    offset: int = 0,
    svc: Services = Depends(get_svc),
):
    with svc.db.session() as s:
        q = select(Memory)
        if not include_archived:
            q = q.where(Memory.archived.is_(False))
        if memory_type:
            q = q.where(Memory.memory_type == memory_type)
        if importance in _BANDS:
            lo, hi = _BANDS[importance]
            q = q.where(Memory.importance_score >= lo, Memory.importance_score < hi)
        rows = s.scalars(q.order_by(Memory.created_at.desc(), Memory.id.desc()).offset(max(0, offset)).limit(min(limit, 500))).all()
        return [ser.memory(m) for m in rows]


@router.get("/{memory_id}")
def get_memory(memory_id: int, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        m = s.get(Memory, memory_id)
        if m is None:
            raise not_found("memory")
        return ser.memory_with_links(s, svc.memory, m)


@router.post("/add")
def add_memory(body: MemoryAdd, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        try:
            m, _ = svc.memory.add(
                s,
                body.content,
                title=body.title,
                memory_type=body.memory_type,
                category=body.category,
                importance=IMPORTANCE_LEVELS.get(body.importance) if body.importance else None,
                confidence=body.confidence,
                source="user_manual",
                tags=body.tags,
                emotional_score=body.emotional_score,
            )
        except MemoryRejected as e:
            raise HTTPException(422, f"memory rejected: {e.reason}") from e
        return ser.memory_with_links(s, svc.memory, m)


@router.post("/search")
def search(body: MemorySearch, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        hits = svc.memory.search(s, body.query, k=body.limit, memory_types=body.memory_types, min_relevance=0.2)
        return [{"memory": ser.memory(h.memory), "score": round(h.score, 4)} for h in hits]


@router.post("/update")
def update_memory(body: MemoryUpdate, svc: Services = Depends(get_svc)):
    fields = body.model_dump(exclude={"memory_id"})
    with svc.db.session() as s:
        try:
            m = svc.memory.update(s, body.memory_id, **fields)
        except KeyError as e:
            raise not_found("memory") from e
        except MemoryRejected as e:
            raise HTTPException(422, f"memory rejected: {e.reason}") from e
        return ser.memory_with_links(s, svc.memory, m)


@router.post("/delete")
def delete_memory(body: MemoryDelete, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        try:
            svc.memory.delete(s, body.memory_id)
        except KeyError as e:
            raise not_found("memory") from e
    return {"deleted": True}
