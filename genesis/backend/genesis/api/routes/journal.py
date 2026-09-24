"""Journal, life timeline and reflections."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from genesis.api import serializers as ser
from genesis.api.deps import get_svc
from genesis.api.schemas import JournalGenerate, TimelineCreate
from genesis.db.models import JournalEntry
from genesis.services import Services

router = APIRouter(tags=["journal"])


def _names(s, svc: Services) -> tuple[str, str]:
    settings = svc.settings(s)
    return settings.get("companion_name") or "Genesis", svc.profile.display_name(s, settings.get("user_name") or "the user")


@router.get("/journal")
def journal(period: str | None = None, limit: int = 100, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        q = select(JournalEntry)
        if period:
            q = q.where(JournalEntry.period == period)
        return [ser.journal(j) for j in s.scalars(q.order_by(JournalEntry.period_start.desc()).limit(min(limit, 500)))]


@router.post("/journal/generate")
def generate_journal(body: JournalGenerate, svc: Services = Depends(get_svc)):
    use_llm = svc.llm.available()
    with svc.db.session() as s:
        name, user = _names(s, svc)
        return ser.journal(svc.reflection.journal(s, body.period, companion_name=name, user_name=user, use_llm=use_llm))


@router.get("/timeline")
def timeline(svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        return [ser.timeline_event(e) for e in svc.timeline.list(s)]


@router.post("/timeline")
def add_timeline(body: TimelineCreate, svc: Services = Depends(get_svc)):
    when = None
    if body.event_date:
        try:
            when = datetime.fromisoformat(body.event_date.replace("Z", "")).replace(tzinfo=None)
        except ValueError as e:
            raise HTTPException(422, "event_date must be ISO 8601") from e
    with svc.db.session() as s:
        try:
            ev, _ = svc.timeline.add(
                s,
                body.title,
                description=body.description,
                category=body.category,
                event_date=when,
                importance=body.importance,
                source="user",
            )
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        return ser.timeline_event(ev)


@router.get("/reflections")
def reflections(limit: int = 50, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        return [ser.reflection(r) for r in svc.reflection.list(s, min(limit, 200))]


@router.post("/reflections/run")
def run_reflection(svc: Services = Depends(get_svc)):
    use_llm = svc.llm.available()
    with svc.db.session() as s:
        name, user = _names(s, svc)
        return ser.reflection(svc.reflection.reflect(s, companion_name=name, user_name=user, use_llm=use_llm))
