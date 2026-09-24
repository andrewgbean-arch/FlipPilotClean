"""ORM → JSON shapes documented in docs/API.md."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from genesis.db import models as m
from genesis.memory.engine import MemoryEngine, importance_label
from genesis.timeutil import iso


def memory(x: m.Memory, related: list[int] | None = None) -> dict[str, Any]:
    return {
        "id": x.id,
        "title": x.title,
        "content": x.content,
        "memory_type": x.memory_type,
        "category": x.category,
        "tier": x.tier,
        "importance": importance_label(x.importance_score),
        "importance_score": round(x.importance_score, 3),
        "confidence": round(x.confidence, 3),
        "source": x.source,
        "emotional_score": round(x.emotional_score, 3),
        "retrieval_count": x.retrieval_count,
        "last_recalled": iso(x.last_recalled),
        "tags": x.tags or [],
        "related_memory_ids": related or [],
        "indexed": x.indexed,
        "archived": x.archived,
        "created_at": iso(x.created_at),
        "updated_at": iso(x.updated_at),
    }


def memory_with_links(s: Session, engine: MemoryEngine, x: m.Memory) -> dict[str, Any]:
    return memory(x, engine.related_ids(s, x.id))


def goal(g: m.Goal) -> dict[str, Any]:
    return {
        "id": g.id,
        "title": g.title,
        "description": g.description,
        "goal_type": g.goal_type,
        "horizon": g.horizon,
        "owner": g.owner,
        "status": g.status,
        "progress": round(g.progress, 1),
        "follow_up_interval_days": g.follow_up_interval_days,
        "last_follow_up_at": iso(g.last_follow_up_at),
        "next_follow_up_at": iso(g.next_follow_up_at),
        "created_at": iso(g.created_at),
        "updated_at": iso(g.updated_at),
    }


def goal_update(u: m.GoalUpdate) -> dict[str, Any]:
    return {"id": u.id, "note": u.note, "progress": u.progress, "status": u.status, "source": u.source, "created_at": iso(u.created_at)}


def conversation(c: m.Conversation) -> dict[str, Any]:
    return {
        "id": c.id,
        "title": c.title,
        "started_at": iso(c.started_at),
        "last_message_at": iso(c.last_message_at),
        "message_count": c.message_count,
        "summary": c.summary,
        "topics": c.topics or [],
    }


def message(x: m.Message) -> dict[str, Any]:
    meta = x.meta or {}
    return {
        "id": x.id,
        "role": x.role,
        "content": x.content,
        "created_at": iso(x.created_at),
        "mood": meta.get("mood"),
        "memories_used": meta.get("memories_used", []),
        "tool_calls": meta.get("tool_calls", []),
    }


def knowledge_item(k: m.KnowledgeItem, names: dict[int, str]) -> dict[str, Any]:
    return {
        "id": k.id,
        "statement": k.statement,
        "subject": names.get(k.subject_id) if k.subject_id else None,
        "predicate": k.predicate,
        "object": names.get(k.object_id) if k.object_id else None,
        "source": k.source,
        "confidence": round(k.confidence, 3),
        "evidence": k.evidence or [],
        "retrieval_count": k.retrieval_count,
        "created_at": iso(k.created_at),
    }


def journal(j: m.JournalEntry) -> dict[str, Any]:
    return {
        "id": j.id,
        "period": j.period,
        "period_start": iso(j.period_start),
        "period_end": iso(j.period_end),
        "title": j.title,
        "content": j.content,
        "highlights": j.highlights or [],
        "created_at": iso(j.created_at),
    }


def timeline_event(e: m.TimelineEvent) -> dict[str, Any]:
    return {
        "id": e.id,
        "title": e.title,
        "description": e.description,
        "category": e.category,
        "event_date": iso(e.event_date),
        "importance": e.importance,
        "source": e.source,
    }


def reflection(r: m.Reflection) -> dict[str, Any]:
    return {"id": r.id, "question": r.question, "content": r.content, "insights": r.insights or [], "created_at": iso(r.created_at)}


def tool_log(t: m.ToolLog) -> dict[str, Any]:
    return {
        "id": t.id,
        "tool_name": t.tool_name,
        "arguments": t.arguments,
        "ok": t.ok,
        "result": t.result,
        "duration_ms": t.duration_ms,
        "created_at": iso(t.created_at),
    }


def proactive(p: m.ProactiveMessage) -> dict[str, Any]:
    return {"id": p.id, "kind": p.kind, "content": p.content, "created_at": iso(p.created_at)}
