"""Health, stats, settings, tools, automation and proactive messages."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select

from genesis import __version__, settings_store
from genesis.api import serializers as ser
from genesis.api.deps import get_svc, not_found
from genesis.api.schemas import ToolExecute
from genesis.db import models as m
from genesis.services import Services
from genesis.timeutil import iso

router = APIRouter(tags=["system"])


@router.get("/health")
def health(svc: Services = Depends(get_svc)):
    ollama_up = svc.llm.available()
    models = svc.llm.list_models() if ollama_up else []
    db_ok = svc.db.healthy()
    try:
        vcount = svc.vector_store.count()
    except Exception:
        vcount = -1
    with svc.db.session() as s:
        chat_model = svc.settings(s).get("chat_model") or svc.llm.default_model
        voice = svc.settings(s).get("tts_voice") or None
    return {
        "status": "ok" if (ollama_up and db_ok and _installed(chat_model, models)) else "degraded",
        "version": __version__,
        "ollama": {
            "available": ollama_up,
            "chat_model": chat_model,
            "embed_model": svc.embedder.model_name,
            "models": models,
            "chat_model_installed": _installed(chat_model, models),
            "embed_model_installed": _installed(svc.embedder.model_name, models),
        },
        "vector_store": {"backend": svc.vector_store.backend, "count": vcount},
        "database": {"ok": db_ok, "path": svc.db.path},
        "voice": {"stt": svc.stt.status(), "tts": svc.tts.status(voice)},
        "vision": svc.vision.status() if ollama_up else {"available": False, "model": svc.config.vision_model},
        "scheduler": {"running": svc.scheduler.running},
    }


def _installed(name: str, models: list[str]) -> bool:
    base = name.split(":")[0]
    return any(m == name or m.split(":")[0] == base for m in models)


@router.get("/stats")
def stats(svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        count = lambda model, *where: s.scalar(select(func.count()).select_from(model).where(*where)) or 0  # noqa: E731
        by_type = dict(
            s.execute(select(m.Memory.memory_type, func.count()).where(m.Memory.archived.is_(False)).group_by(m.Memory.memory_type)).all()
        )
        scores = s.scalars(select(m.Memory.importance_score).where(m.Memory.archived.is_(False))).all()
        from genesis.memory.engine import importance_label

        by_importance: dict[str, int] = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        for sc in scores:
            by_importance[importance_label(sc)] += 1
        return {
            "conversations": count(m.Conversation, m.Conversation.message_count > 0),
            "messages": count(m.Message),
            "memories": {"total": len(scores), "by_type": by_type, "by_importance": by_importance},
            "knowledge_items": count(m.KnowledgeItem),
            "entities": count(m.Entity),
            "goals": {
                "active": count(m.Goal, m.Goal.status == "active", m.Goal.owner == "user"),
                "completed": count(m.Goal, m.Goal.status == "completed"),
            },
            "journal_entries": count(m.JournalEntry),
            "reflections": count(m.Reflection),
            "timeline_events": count(m.TimelineEvent),
        }


@router.get("/settings")
def get_settings(svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        return svc.settings(s)


@router.put("/settings")
def put_settings(changes: dict[str, Any] = Body(...), svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        try:
            return settings_store.update(s, changes)
        except settings_store.SettingsError as e:
            raise HTTPException(422, str(e)) from e


@router.get("/tools")
def tools(svc: Services = Depends(get_svc)):
    return [
        {"name": t.name, "description": t.description, "parameters": t.schema()["function"]["parameters"]} for t in svc.tools.available(svc)
    ]


@router.post("/tools/execute")
def execute_tool(body: ToolExecute, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        ok, result = svc.tools.execute(s, svc, body.name, body.arguments)
        return {"ok": ok, "result": result}


@router.get("/tools/logs")
def tool_logs(limit: int = 100, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        rows = s.scalars(select(m.ToolLog).order_by(m.ToolLog.id.desc()).limit(min(limit, 500))).all()
        return [ser.tool_log(t) for t in rows]


@router.get("/automation/jobs")
def jobs(svc: Services = Depends(get_svc)):
    return [{**j, "last_run": iso(j["last_run"])} for j in svc.scheduler.describe()]


@router.post("/automation/run/{job}")
def run_job(job: str, svc: Services = Depends(get_svc)):
    try:
        return svc.scheduler.run(job)
    except KeyError as e:
        raise not_found("job") from e


@router.get("/proactive")
def proactive(svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        rows = s.scalars(select(m.ProactiveMessage).where(m.ProactiveMessage.delivered.is_(False)).order_by(m.ProactiveMessage.id)).all()
        return [ser.proactive(p) for p in rows]


@router.post("/proactive/{pid}/dismiss")
def dismiss(pid: int, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        p = s.get(m.ProactiveMessage, pid)
        if p is None:
            raise not_found("proactive message")
        p.delivered = True
    return {"dismissed": True}
