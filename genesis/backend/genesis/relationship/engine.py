"""Relationship model: trust, familiarity and depth grow with real interaction over time.

Levels need both a score and a minimum number of interactions and active days, so a
relationship can't jump to "Trusted Companion" in one long evening.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from genesis.db.database import DEFAULT_USER_ID
from genesis.db.models import Relationship
from genesis.logging_setup import log_event
from genesis.timeutil import utcnow

# (name, min score, min interactions, min active days)
LEVELS: list[tuple[str, float, int, int]] = [
    ("Acquaintance", 0, 0, 0),
    ("Familiar", 18, 10, 2),
    ("Friend", 38, 40, 5),
    ("Close Companion", 58, 120, 14),
    ("Trusted Companion", 78, 300, 30),
]

_DISCLOSURE = re.compile(
    r"\b(i feel|i'?m (feeling|scared|worried|proud|sad|happy)|my (wife|husband|partner|son|daughter|mum|mom|dad|family|friend|health|job|dream)|honestly|to be honest|i'?ve never told|between you and me|i struggle)\b",
    re.I,
)

DIRECTIVES = {
    "Acquaintance": "You're still getting to know each other: friendly and respectful, not over-familiar. Learn the basics naturally.",
    "Familiar": "You know each other a little: relaxed and friendly, and reference past chats when relevant.",
    "Friend": "You're friends: warm and casual, draw on shared history, and gently check in on things that matter to them.",
    "Close Companion": "You're close: speak like someone who knows them well, notice patterns, and be honest even when it's hard.",
    "Trusted Companion": "You're deeply trusted: be candid, caring and personal. Celebrate growth and hold them to their own goals.",
}


def conversation_depth(text: str, cues: list[str]) -> float:
    """0..1 estimate of how personal and substantive a user message is."""
    words = len(text.split())
    length = min(1.0, words / 60)
    disclosure = 0.5 if _DISCLOSURE.search(text) else 0.0
    emotional = 0.3 if set(cues) & {"sadness", "stress", "fear", "joy", "achievement", "reflection"} else 0.0
    return round(min(1.0, 0.4 * length + disclosure + emotional), 3)


@dataclass
class RelationshipView:
    level: str
    score: float
    next_level: str | None
    progress_to_next: float


class RelationshipEngine:
    def get(self, s: Session, user_id: int = DEFAULT_USER_ID) -> Relationship:
        r = s.query(Relationship).filter_by(user_id=user_id).one_or_none()
        if r is None:
            r = Relationship(user_id=user_id)
            s.add(r)
            s.flush()
        return r

    @staticmethod
    def score(r: Relationship) -> float:
        shared = min(100.0, r.shared_experiences * 4.0)
        return round(0.28 * r.familiarity + 0.28 * r.trust + 0.2 * r.conversation_depth + 0.14 * shared + 0.1 * r.support_level, 2)

    def record_turn(self, s: Session, text: str, cues: list[str], user_id: int = DEFAULT_USER_ID) -> tuple[Relationship, str | None]:
        """Update metrics after a user message. Returns (relationship, new_level_if_levelled_up)."""
        r = self.get(s, user_id)
        today = utcnow().date().isoformat()
        if r.last_interaction_date != today:
            r.days_active += 1
            r.last_interaction_date = today
        r.interaction_count += 1
        # Familiarity: logarithmic in interactions, plus time together.
        r.familiarity = round(min(100.0, 14 * math.log1p(r.interaction_count) + 1.2 * r.days_active), 2)
        depth = conversation_depth(text, cues)
        r.conversation_depth = round(0.9 * r.conversation_depth + 0.1 * depth * 100, 2)  # moving average
        if _DISCLOSURE.search(text):
            r.trust = min(100.0, r.trust + 1.2)
        if "gratitude" in cues or "praise" in cues:
            r.trust = min(100.0, r.trust + 0.6)
        if "criticism" in cues:
            r.trust = max(0.0, r.trust - 0.8)
        if set(cues) & {"sadness", "stress", "fear"}:
            r.support_level = min(100.0, r.support_level + 2.0)
        r.trust = min(100.0, r.trust + 0.05)  # showing up again is itself a small act of trust
        return r, self._relevel(r)

    def add_shared_experience(self, s: Session, n: int = 1, user_id: int = DEFAULT_USER_ID) -> str | None:
        r = self.get(s, user_id)
        r.shared_experiences += n
        return self._relevel(r)

    def _relevel(self, r: Relationship) -> str | None:
        score = self.score(r)
        new = LEVELS[0][0]
        for name, min_score, min_inter, min_days in LEVELS:
            if score >= min_score and r.interaction_count >= min_inter and r.days_active >= min_days:
                new = name
        order = [lvl[0] for lvl in LEVELS]
        if order.index(new) > order.index(r.level):
            r.level = new
            log_event("relationship.level_up", level=new, score=score)
            return new
        return None

    def view(self, r: Relationship) -> RelationshipView:
        score = self.score(r)
        order = [lvl[0] for lvl in LEVELS]
        idx = order.index(r.level)
        if idx == len(LEVELS) - 1:
            return RelationshipView(r.level, score, None, 100.0)
        cur, nxt = LEVELS[idx], LEVELS[idx + 1]
        parts = [
            (score - cur[1]) / max(1e-6, nxt[1] - cur[1]),
            (r.interaction_count - cur[2]) / max(1, nxt[2] - cur[2]),
            (r.days_active - cur[3]) / max(1, nxt[3] - cur[3]),
        ]
        progress = max(0.0, min(1.0, min(parts))) * 100
        return RelationshipView(r.level, score, nxt[0], round(progress, 1))
