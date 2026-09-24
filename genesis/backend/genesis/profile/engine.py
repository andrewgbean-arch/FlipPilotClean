"""What the companion knows about the user: profile fields and tracked interests.

Conflicting information is never silently overwritten. A lower-confidence value that
disagrees with what's stored is kept in the field's history as a `conflict`, and the
question engine may gently ask about it ("Did you move to Bristol?").
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from genesis.db.database import DEFAULT_USER_ID
from genesis.db.models import Interest, ProfileField
from genesis.logging_setup import log_event
from genesis.safety.guard import detect_injection, sanitize
from genesis.timeutil import iso, utcnow

PROFILE_FIELDS = (
    "name",
    "age",
    "birthday",
    "location",
    "hometown",
    "occupation",
    "employer",
    "education",
    "family",
    "partner",
    "children",
    "pets",
    "strengths",
    "weaknesses",
    "food",
    "music",
    "movies",
    "games",
    "books",
    "sports",
    "communication_preference",
)

# Asked about roughly in this order, and only once the relationship allows it.
GAP_PRIORITY: list[tuple[str, str, str]] = [
    ("name", "Acquaintance", "what they'd like you to call them"),
    ("occupation", "Acquaintance", "what they do for work or study"),
    ("location", "Familiar", "roughly where they live"),
    ("pets", "Familiar", "whether they have any pets"),
    ("music", "Familiar", "what music they enjoy"),
    ("food", "Familiar", "their favourite food"),
    ("family", "Friend", "the important people in their life"),
    ("strengths", "Friend", "what they feel they're good at"),
    ("age", "Close Companion", "their age, if they want to share"),
]

INTEREST_CATEGORIES: dict[str, list[str]] = {
    "technology": ["tech", "technology", "gadget", "computer", "ai", "robot", "electronics", "smart home"],
    "programming": ["programming", "coding", "python", "javascript", "rust", "developer", "code", "software"],
    "gaming": ["gaming", "video game", "playstation", "xbox", "nintendo", "steam", "fortnite", "minecraft"],
    "reading": ["reading", "novel", "kindle"],
    "books": ["book", "books", "author"],
    "fishing": ["fishing", "angling", "fly fishing", "carp", "trout", "sea fishing", "boat"],
    "fitness": ["gym", "fitness", "running", "workout", "lifting", "cycling", "yoga", "swimming", "hiking"],
    "business": ["business", "startup", "entrepreneur", "side hustle", "company", "sales", "marketing"],
    "finance": ["finance", "investing", "stocks", "crypto", "saving", "budget", "trading"],
    "art": ["art", "drawing", "painting", "sketching", "photography", "design"],
    "music": ["music", "guitar", "piano", "singing", "band", "drums", "concert"],
    "movies": ["movie", "movies", "film", "cinema", "netflix", "series", "tv show"],
    "cooking": ["cooking", "baking", "recipe", "chef", "bbq"],
    "travel": ["travel", "travelling", "traveling", "trip", "holiday", "vacation"],
    "outdoors": ["camping", "outdoors", "nature", "gardening", "walking"],
    "cars": ["car", "cars", "motorbike", "motorcycle", "engine", "mechanic"],
}


def categorize_interest(name: str) -> str:
    low = name.lower()
    for cat, words in INTEREST_CATEGORIES.items():
        if low == cat or any(re.search(rf"\b{re.escape(w)}\b", low) for w in words):
            return cat
    return "custom"


@dataclass
class FieldChange:
    field: str
    value: str
    outcome: str  # created | updated | reinforced | conflict | rejected


class ProfileEngine:
    def fields(self, s: Session, user_id: int = DEFAULT_USER_ID) -> dict[str, ProfileField]:
        return {f.field: f for f in s.scalars(select(ProfileField).where(ProfileField.user_id == user_id))}

    def value(self, s: Session, field: str, user_id: int = DEFAULT_USER_ID) -> str | None:
        row = s.scalars(select(ProfileField).where(ProfileField.user_id == user_id, ProfileField.field == field)).first()
        return row.value if row else None

    def set_field(
        self,
        s: Session,
        field: str,
        value: str,
        *,
        confidence: float = 0.7,
        source: str = "conversation",
        user_id: int = DEFAULT_USER_ID,
    ) -> FieldChange:
        field = re.sub(r"[^a-z_]", "", field.lower().strip().replace(" ", "_"))[:64]
        value = sanitize(str(value), 300)
        if not field or not value or detect_injection(value) or not _plausible(field, value):
            return FieldChange(field, value, "rejected")
        row = s.scalars(select(ProfileField).where(ProfileField.user_id == user_id, ProfileField.field == field)).first()
        now = iso(utcnow())
        if row is None:
            s.add(ProfileField(user_id=user_id, field=field, value=value, confidence=confidence, source=source, history=[]))
            s.flush()
            log_event("profile.field_set", field=field, outcome="created")
            return FieldChange(field, value, "created")
        if row.value.strip().lower() == value.strip().lower():
            row.confidence = min(1.0, row.confidence + 0.05)
            return FieldChange(field, value, "reinforced")
        manual = source == "user_manual"
        if manual or confidence >= row.confidence - 0.1:
            row.history = [*(row.history or []), {"value": row.value, "confidence": row.confidence, "replaced_at": now}][-10:]
            row.value, row.confidence, row.source = value, confidence if not manual else 1.0, source
            log_event("profile.field_set", field=field, outcome="updated")
            return FieldChange(field, value, "updated")
        row.history = [*(row.history or []), {"value": value, "confidence": confidence, "status": "conflict", "seen_at": now}][-10:]
        log_event("profile.field_conflict", field=field)
        return FieldChange(field, value, "conflict")

    def open_conflicts(self, s: Session, user_id: int = DEFAULT_USER_ID, days: int = 3) -> list[tuple[ProfileField, str]]:
        cutoff = utcnow() - timedelta(days=days)
        out = []
        for f in self.fields(s, user_id).values():
            for h in reversed(f.history or []):
                if h.get("status") == "conflict" and h.get("seen_at", "") >= (iso(cutoff) or ""):
                    out.append((f, h["value"]))
                    break
        return out

    def resolve_conflict(self, s: Session, field: str, user_id: int = DEFAULT_USER_ID) -> None:
        row = self.fields(s, user_id).get(field)
        if row:
            row.history = [{**h, "status": "asked"} if h.get("status") == "conflict" else h for h in (row.history or [])]

    def gaps(self, s: Session, level: str, user_id: int = DEFAULT_USER_ID) -> list[tuple[str, str]]:
        from genesis.relationship.engine import LEVELS

        order = [lvl[0] for lvl in LEVELS]
        known = self.fields(s, user_id)
        return [
            (field, hint) for field, min_level, hint in GAP_PRIORITY if field not in known and order.index(level) >= order.index(min_level)
        ]

    # ------------------------------------------------------------------ interests

    def track_interest(
        self, s: Session, name: str, category: str | None = None, *, weight: float = 1.0, user_id: int = DEFAULT_USER_ID
    ) -> Interest | None:
        name = sanitize(name, 80).lower().strip(" .,!")
        if len(name) < 2 or len(name.split()) > 5 or detect_injection(name):
            return None
        row = s.scalars(select(Interest).where(Interest.user_id == user_id, Interest.name == name)).first()
        if row is None:
            row = Interest(
                user_id=user_id, name=name, category=category or categorize_interest(name), strength=25.0 * weight, mention_count=1
            )
            s.add(row)
            s.flush()
            log_event("interest.new", name=name, category=row.category)
        else:
            row.mention_count += 1
            row.strength = min(100.0, row.strength + 8.0 * weight)
            row.last_mentioned = utcnow()
        return row

    def mention_interests_in(self, s: Session, text: str, user_id: int = DEFAULT_USER_ID) -> list[Interest]:
        """Bump known interests the user talks about again."""
        low = text.lower()
        hits = []
        for row in s.scalars(select(Interest).where(Interest.user_id == user_id)):
            if re.search(rf"\b{re.escape(row.name)}\b", low):
                row.mention_count += 1
                row.strength = min(100.0, row.strength + 3.0)
                row.last_mentioned = utcnow()
                hits.append(row)
        return hits

    def interests(self, s: Session, user_id: int = DEFAULT_USER_ID, limit: int = 50) -> list[Interest]:
        return list(s.scalars(select(Interest).where(Interest.user_id == user_id).order_by(Interest.strength.desc()).limit(limit)))

    def decay_interests(self, s: Session, user_id: int = DEFAULT_USER_ID) -> int:
        """Interests not mentioned for a month fade slowly (but are never deleted)."""
        cutoff = utcnow() - timedelta(days=30)
        n = 0
        for row in s.scalars(select(Interest).where(Interest.user_id == user_id, Interest.last_mentioned < cutoff)):
            row.strength = max(5.0, row.strength * 0.95)
            n += 1
        return n

    def display_name(self, s: Session, fallback: str = "", user_id: int = DEFAULT_USER_ID) -> str:
        return self.value(s, "name", user_id) or fallback


def _plausible(field: str, value: str) -> bool:
    if field == "age":
        m = re.fullmatch(r"\s*(\d{1,3})\s*", value)
        return bool(m) and 1 <= int(m.group(1)) <= 120
    if field == "name":
        return 1 <= len(value.split()) <= 4 and bool(re.fullmatch(r"[A-Za-zÀ-ÿ' .-]{1,60}", value))
    return len(value) <= 300
