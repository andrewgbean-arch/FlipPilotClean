"""Goal engine: the user's goals, the companion's own goals, progress and timely follow-ups."""

from __future__ import annotations

import re
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from genesis.db.database import DEFAULT_USER_ID
from genesis.db.models import Goal, GoalUpdate
from genesis.logging_setup import log_event
from genesis.memory.engine import keywords
from genesis.safety.guard import detect_injection, sanitize
from genesis.timeutil import utcnow

GOAL_TYPES = ("health", "business", "finance", "learning", "relationships", "projects", "travel", "personal_development", "companion")

_TYPE_HINTS: list[tuple[str, re.Pattern[str]]] = [
    ("health", re.compile(r"\b(fit|fitness|gym|weight|run|marathon|health|diet|sleep|quit smoking|exercise|steps)\b", re.I)),
    ("finance", re.compile(r"\b(save|saving|money|debt|invest|budget|mortgage|pay off|income)\b", re.I)),
    ("business", re.compile(r"\b(business|startup|launch|customers|revenue|company|website|shop|brand|clients)\b", re.I)),
    ("learning", re.compile(r"\b(learn|study|course|degree|exam|language|python|programming|read more|certificate)\b", re.I)),
    ("travel", re.compile(r"\b(travel|trip|visit|holiday|vacation|abroad)\b", re.I)),
    ("relationships", re.compile(r"\b(friend|family|partner|date|call (mum|mom|dad)|reconnect)\b", re.I)),
    ("projects", re.compile(r"\b(build|finish|project|renovate|fix|restore|boat|garden|write a book)\b", re.I)),
]

DEFAULT_INTERVAL = {"short": 3.0, "medium": 7.0, "long": 21.0}

COMPANION_GOALS = [
    ("Get to know them", "Learn their name, work, and what makes a good day for them.", "short"),
    ("Understand their hobbies", "Find out which interests matter most and why.", "medium"),
    ("Support their goals", "Help them make steady progress on what they care about, and follow up.", "long"),
]


def infer_goal_type(text: str) -> str:
    for goal_type, pat in _TYPE_HINTS:
        if pat.search(text):
            return goal_type
    return "personal_development"


def _similar(a: str, b: str) -> float:
    ka, kb = set(keywords(a)), set(keywords(b))
    if not ka or not kb:
        return 0.0
    return len(ka & kb) / min(len(ka), len(kb))


class GoalEngine:
    def ensure_companion_goals(self, s: Session, user_id: int = DEFAULT_USER_ID) -> None:
        have = {g.title for g in s.scalars(select(Goal).where(Goal.owner == "companion", Goal.user_id == user_id))}
        for title, desc, horizon in COMPANION_GOALS:
            if title not in have:
                s.add(Goal(user_id=user_id, title=title, description=desc, goal_type="companion", horizon=horizon, owner="companion"))
        s.flush()

    def list(self, s: Session, status: str | None = None, owner: str | None = None, user_id: int = DEFAULT_USER_ID) -> list[Goal]:
        q = select(Goal).where(Goal.user_id == user_id)
        if status:
            q = q.where(Goal.status == status)
        if owner:
            q = q.where(Goal.owner == owner)
        return list(s.scalars(q.order_by(Goal.status, Goal.owner.desc(), Goal.updated_at.desc())))

    def find_similar(self, s: Session, title: str, user_id: int = DEFAULT_USER_ID) -> Goal | None:
        best, best_sim = None, 0.0
        for g in self.list(s, owner="user", user_id=user_id):
            if g.status in ("completed", "abandoned"):
                continue
            sim = _similar(title, g.title)
            if sim > best_sim:
                best, best_sim = g, sim
        return best if best_sim >= 0.6 else None

    def create(
        self,
        s: Session,
        title: str,
        *,
        description: str = "",
        goal_type: str | None = None,
        horizon: str = "medium",
        owner: str = "user",
        follow_up_interval_days: float | None = None,
        source: str = "user",
        source_memory_id: int | None = None,
        user_id: int = DEFAULT_USER_ID,
    ) -> tuple[Goal, bool]:
        title = sanitize(title, 200).rstrip(".")
        if len(title) < 3 or detect_injection(title):
            raise ValueError("invalid goal title")
        if owner == "user":
            existing = self.find_similar(s, title, user_id)
            if existing:
                existing.last_mentioned_at = utcnow()
                return existing, False
        horizon = horizon if horizon in DEFAULT_INTERVAL else "medium"
        interval = follow_up_interval_days or DEFAULT_INTERVAL[horizon]
        gt = goal_type if goal_type in GOAL_TYPES else infer_goal_type(f"{title} {description}")
        now = utcnow()
        g = Goal(
            user_id=user_id,
            title=title[:1].upper() + title[1:],
            description=sanitize(description, 1000),
            goal_type=gt,
            horizon=horizon,
            owner=owner,
            follow_up_interval_days=interval,
            next_follow_up_at=now + timedelta(days=interval) if owner == "user" else None,
            last_mentioned_at=now,
            source_memory_id=source_memory_id,
        )
        s.add(g)
        s.flush()
        s.add(GoalUpdate(goal_id=g.id, note="Goal created", progress=0.0, status="active", source=source))
        log_event("goal.created", goal_id=g.id, goal_type=gt, owner=owner, source=source)
        return g, True

    def update(
        self,
        s: Session,
        goal_id: int,
        *,
        status: str | None = None,
        progress: float | None = None,
        note: str | None = None,
        source: str = "user",
    ) -> tuple[Goal, bool]:
        """Returns (goal, just_completed)."""
        g = s.get(Goal, goal_id)
        if g is None:
            raise KeyError(goal_id)
        was_completed = g.status == "completed"
        if status:
            if status not in ("active", "paused", "completed", "abandoned"):
                raise ValueError("invalid status")
            g.status = status
        if progress is not None:
            g.progress = max(0.0, min(100.0, float(progress)))
        if g.status == "completed":
            g.progress = 100.0
            g.next_follow_up_at = None
        elif g.progress >= 100:
            g.status = "completed"
            g.next_follow_up_at = None
        now = utcnow()
        g.last_mentioned_at = now
        if g.status == "active" and g.owner == "user":
            g.next_follow_up_at = now + timedelta(days=g.follow_up_interval_days)
        s.add(GoalUpdate(goal_id=g.id, note=sanitize(note or "", 1000), progress=g.progress, status=g.status, source=source))
        s.flush()
        just_completed = g.status == "completed" and not was_completed
        log_event("goal.updated", goal_id=g.id, status=g.status, progress=g.progress, source=source)
        return g, just_completed

    def due_follow_ups(self, s: Session, user_id: int = DEFAULT_USER_ID, limit: int = 3) -> list[Goal]:
        now = utcnow()
        return list(
            s.scalars(
                select(Goal)
                .where(
                    Goal.user_id == user_id,
                    Goal.owner == "user",
                    Goal.status == "active",
                    Goal.next_follow_up_at.is_not(None),
                    Goal.next_follow_up_at <= now,
                )
                .order_by(Goal.next_follow_up_at)
                .limit(limit)
            )
        )

    def mark_followed_up(self, s: Session, goal: Goal) -> None:
        now = utcnow()
        goal.last_follow_up_at = now
        goal.next_follow_up_at = now + timedelta(days=goal.follow_up_interval_days)
        log_event("goal.follow_up", goal_id=goal.id)

    def goals_mentioned(self, s: Session, text: str, user_id: int = DEFAULT_USER_ID) -> list[Goal]:
        """Active user goals the message talks about. Mentioning a goal resets its follow-up clock."""
        words = set(keywords(text))
        hits = []
        for g in self.list(s, status="active", owner="user", user_id=user_id):
            gk = set(keywords(g.title))
            if gk and len(gk & words) / len(gk) >= 0.5:
                g.last_mentioned_at = utcnow()
                g.next_follow_up_at = utcnow() + timedelta(days=g.follow_up_interval_days)
                hits.append(g)
        return hits

    def refresh_companion_goals(
        self, s: Session, profile_known: int, interests: int, user_goals: int, user_id: int = DEFAULT_USER_ID
    ) -> None:
        """The companion's own goals progress as it genuinely learns more."""
        progress = {
            "Get to know them": min(100.0, profile_known * 20.0),
            "Understand their hobbies": min(100.0, interests * 20.0),
            "Support their goals": min(100.0, user_goals * 15.0),
        }
        for g in self.list(s, owner="companion", user_id=user_id):
            if g.title in progress and g.status == "active":
                g.progress = max(g.progress, progress[g.title])
