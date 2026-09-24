"""Autonomous behaviour: things the companion decides to bring up by itself.

Follow up on goals, remind about due tasks, reconnect after an absence, notice a
fading interest, and summarise weekly progress. Messages are queued (deduplicated)
and shown in the UI or woven into the next greeting. Nothing is sent anywhere.
"""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.orm import Session

from genesis.db.database import DEFAULT_USER_ID
from genesis.db.models import Conversation, Interest, ProactiveMessage, Task, User
from genesis.logging_setup import log_event
from genesis.timeutil import humanize_ago, utcnow

if TYPE_CHECKING:
    from genesis.services import Services


def _queue(s: Session, kind: str, content: str, key: str) -> bool:
    if s.scalars(select(ProactiveMessage.id).where(ProactiveMessage.dedupe_key == key)).first() is not None:
        return False
    s.add(ProactiveMessage(kind=kind, content=content, dedupe_key=key[:120]))
    s.flush()
    log_event("proactive.queued", kind=kind)
    return True


def generate(s: Session, svc: Services) -> int:
    settings = svc.settings(s)
    if not (settings.get("autonomy_enabled") and settings.get("proactive_enabled")):
        return 0
    now = utcnow()
    queued = 0

    for g in svc.goals.due_follow_ups(s, limit=3):
        title = g.title[:1].lower() + g.title[1:]
        queued += _queue(s, "goal_follow_up", f"You mentioned wanting to {title}. How is that progressing?", f"goal:{g.id}:{now.date()}")

    soon = now + timedelta(hours=1)
    for t in s.scalars(select(Task).where(Task.done.is_(False), Task.reminded.is_(False), Task.due_at.is_not(None), Task.due_at <= soon)):
        when = "now" if t.due_at <= now else f"at {t.due_at.strftime('%H:%M')} UTC"
        queued += _queue(s, "reminder", f"Reminder: {t.title} (due {when}).", f"task:{t.id}")
        t.reminded = True

    user = s.get(User, DEFAULT_USER_ID)
    if user and user.last_seen_at and (now - user.last_seen_at).days >= 3:
        last = s.scalars(
            select(Conversation).where(Conversation.message_count > 1).order_by(Conversation.last_message_at.desc()).limit(1)
        ).first()
        topic = f" Last time we talked about {last.title.lower().rstrip('…')}." if last and last.title else ""
        queued += _queue(
            s,
            "reconnect",
            f"It's been {humanize_ago(user.last_seen_at).replace(' ago', '')} since we last talked.{topic} How have things been?",
            f"reconnect:{user.last_seen_at.date()}",
        )

    fading = s.scalars(
        select(Interest)
        .where(Interest.strength >= 55, Interest.last_mentioned < now - timedelta(days=14))
        .order_by(Interest.strength.desc())
        .limit(1)
    ).first()
    if fading:
        queued += _queue(
            s,
            "suggestion",
            f"You haven't mentioned {fading.name} for a while. Been doing any lately?",
            f"interest:{fading.id}:{now.isocalendar()[1]}",
        )

    if now.weekday() == 0:
        goals = svc.goals.list(s, status="active", owner="user")
        if goals:
            lines = "; ".join(f"{g.title} ({round(g.progress)}%)" for g in goals[:4])
            queued += _queue(
                s,
                "summary",
                f"New week! Your goals so far: {lines}. Want to pick one to focus on?",
                f"weekly:{now.isocalendar()[0]}-{now.isocalendar()[1]}",
            )
    return queued
