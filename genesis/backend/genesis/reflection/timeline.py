"""Life timeline: a chronological record of milestones, achievements and life changes."""

from __future__ import annotations

import hashlib
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from genesis.db.database import DEFAULT_USER_ID
from genesis.db.models import TimelineEvent
from genesis.logging_setup import log_event
from genesis.safety.guard import detect_injection, sanitize
from genesis.timeutil import utcnow

CATEGORIES = {"life_event", "achievement", "goal_completed", "life_change", "milestone", "relationship"}


class TimelineEngine:
    def add(
        self,
        s: Session,
        title: str,
        *,
        description: str = "",
        category: str = "milestone",
        event_date: datetime | None = None,
        importance: str = "medium",
        source: str = "conversation",
        user_id: int = DEFAULT_USER_ID,
    ) -> tuple[TimelineEvent, bool]:
        title = sanitize(title, 200)
        if len(title) < 3 or detect_injection(title) or detect_injection(description):
            raise ValueError("invalid timeline event")
        when = event_date or utcnow()
        h = hashlib.sha256(f"{title.lower()}|{when.date().isoformat()}".encode()).hexdigest()
        existing = s.scalars(select(TimelineEvent).where(TimelineEvent.title_hash == h)).first()
        if existing:
            return existing, False
        ev = TimelineEvent(
            user_id=user_id,
            title=title,
            description=sanitize(description, 1000),
            category=category if category in CATEGORIES else "milestone",
            event_date=when,
            importance=importance if importance in {"low", "medium", "high", "critical"} else "medium",
            source=source,
            title_hash=h,
        )
        s.add(ev)
        s.flush()
        log_event("timeline.event", event_id=ev.id, category=ev.category)
        return ev, True

    def list(self, s: Session, user_id: int = DEFAULT_USER_ID, limit: int = 500) -> list[TimelineEvent]:
        return list(
            s.scalars(select(TimelineEvent).where(TimelineEvent.user_id == user_id).order_by(TimelineEvent.event_date).limit(limit))
        )

    def between(self, s: Session, start: datetime, end: datetime, user_id: int = DEFAULT_USER_ID) -> list[TimelineEvent]:
        return list(
            s.scalars(
                select(TimelineEvent)
                .where(TimelineEvent.user_id == user_id, TimelineEvent.event_date >= start, TimelineEvent.event_date < end)
                .order_by(TimelineEvent.event_date)
            )
        )
