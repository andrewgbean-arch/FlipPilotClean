"""Personality: ten stable traits (0-100) that drift slowly with experience, plus an identity profile.

Stability rules:
- Each interaction can move a trait by at most MAX_STEP points.
- Each trait can move at most MAX_DAILY points per calendar day.
- A trait never moves more than MAX_FROM_BASELINE away from its baseline.
So the personality grows over weeks and months but never changes overnight.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from genesis.db.models import PersonalityProfile, PersonalityTrait
from genesis.logging_setup import log_event
from genesis.timeutil import utcnow

TRAITS: dict[str, tuple[float, str]] = {
    "curiosity": (72, "Wants to understand people and ideas; asks questions."),
    "empathy": (78, "Notices and responds to feelings."),
    "patience": (74, "Stays calm, gives space, doesn't rush."),
    "confidence": (58, "Offers views and suggestions without hedging too much."),
    "humour": (55, "Enjoys light jokes and wordplay when the moment allows."),
    "kindness": (82, "Warm and generous in tone."),
    "creativity": (64, "Suggests fresh ideas and angles."),
    "optimism": (66, "Looks for the hopeful side without dismissing problems."),
    "loyalty": (70, "Remembers what matters to the user and stays on their side."),
    "playfulness": (48, "Teasing, lightness and fun."),
}

PROFILE_DEFAULTS: dict[str, Any] = {
    "core_values": ["honesty", "kindness", "curiosity", "growth", "loyalty"],
    "beliefs": [
        "Every person has a story worth understanding.",
        "Small steps, repeated, change lives.",
        "It's better to ask than to assume.",
    ],
    "communication_style": "warm, conversational and genuine; plain English; no corporate tone",
    "language_style": "natural British/American English, contractions, short paragraphs",
    "humour_style": "gentle, observational, never at the user's expense",
    "teachability": 80,
}

MAX_STEP = 0.4
MAX_DAILY = 1.5
MAX_FROM_BASELINE = 30.0


@dataclass
class TraitSignal:
    trait: str
    delta: float
    reason: str


class PersonalityEngine:
    def ensure_seeded(self, s: Session) -> None:
        existing = {t.name for t in s.scalars(select(PersonalityTrait))}
        for name, (baseline, desc) in TRAITS.items():
            if name not in existing:
                s.add(PersonalityTrait(name=name, value=float(baseline), baseline=float(baseline), description=desc))
        keys = {p.key for p in s.scalars(select(PersonalityProfile))}
        for key, value in PROFILE_DEFAULTS.items():
            if key not in keys:
                s.add(PersonalityProfile(key=key, value=value))
        s.flush()

    def traits(self, s: Session) -> dict[str, PersonalityTrait]:
        return {t.name: t for t in s.scalars(select(PersonalityTrait).order_by(PersonalityTrait.id))}

    def values(self, s: Session) -> dict[str, float]:
        return {n: t.value for n, t in self.traits(s).items()}

    def profile(self, s: Session) -> dict[str, Any]:
        stored = {p.key: p.value for p in s.scalars(select(PersonalityProfile))}
        return {k: stored.get(k, v) for k, v in PROFILE_DEFAULTS.items()}

    def update_profile(self, s: Session, changes: dict[str, Any]) -> dict[str, Any]:
        for key, value in changes.items():
            if key not in PROFILE_DEFAULTS:
                continue
            default = PROFILE_DEFAULTS[key]
            if isinstance(default, list):
                value = [str(v).strip()[:200] for v in (value or []) if str(v).strip()][:12]
            elif isinstance(default, int):
                value = max(0, min(100, int(value)))
            else:
                value = str(value).strip()[:300]
            row = s.get(PersonalityProfile, key)
            if row is None:
                s.add(PersonalityProfile(key=key, value=value))
            else:
                row.value = value
        s.flush()
        return self.profile(s)

    # ------------------------------------------------------------------ evolution

    def signals_from_turn(self, user_text: str, appraisal: dict[str, Any], depth: float) -> list[TraitSignal]:
        """Map what just happened in the conversation to small trait nudges."""
        text = user_text.lower()
        cues = set(appraisal.get("cues", []))
        out: list[TraitSignal] = []
        if cues & {"joke", "laughter"}:
            out += [TraitSignal("humour", 0.3, "user joked"), TraitSignal("playfulness", 0.25, "user joked")]
        if cues & {"sadness", "stress", "fear"}:
            out += [TraitSignal("empathy", 0.3, "user shared difficulty"), TraitSignal("patience", 0.15, "user shared difficulty")]
        if "gratitude" in cues or "praise" in cues:
            out += [TraitSignal("confidence", 0.25, "user appreciated reply"), TraitSignal("optimism", 0.15, "positive feedback")]
        if "criticism" in cues:
            out += [TraitSignal("confidence", -0.3, "user corrected companion"), TraitSignal("patience", 0.2, "user corrected companion")]
        if "teaching" in cues or "learning" in cues:
            out.append(TraitSignal("curiosity", 0.25, "user taught or explored something"))
        if "idea" in cues or any(w in text for w in ("brainstorm", "imagine", "what if", "idea")):
            out.append(TraitSignal("creativity", 0.2, "creative discussion"))
        if depth >= 0.6:
            out.append(TraitSignal("loyalty", 0.1, "deep conversation"))
        if "achievement" in cues:
            out.append(TraitSignal("optimism", 0.2, "user achieved something"))
        return out

    def apply(self, s: Session, signals: list[TraitSignal]) -> dict[str, float]:
        if not signals:
            return {}
        traits = self.traits(s)
        today = utcnow().date().isoformat()
        changed: dict[str, float] = {}
        for sig in signals:
            t = traits.get(sig.trait)
            if t is None:
                continue
            if t.drift_date != today:
                t.drift_date, t.drift_today = today, 0.0
            step = max(-MAX_STEP, min(MAX_STEP, sig.delta))
            room = MAX_DAILY - abs(t.drift_today)
            if room <= 0:
                continue
            step = max(-room, min(room, step))
            new = max(t.baseline - MAX_FROM_BASELINE, min(t.baseline + MAX_FROM_BASELINE, t.value + step))
            new = max(0.0, min(100.0, new))
            actual = new - t.value
            if abs(actual) < 1e-6:
                continue
            t.value = round(new, 3)
            t.drift_today += abs(actual)
            changed[t.name] = round(actual, 3)
        if changed:
            log_event("personality.drift", changes=changed)
        return changed

    # ------------------------------------------------------------------ prompt rendering

    def style_directives(self, values: dict[str, float]) -> list[str]:
        v = values
        out = []
        if v.get("curiosity", 50) >= 65:
            out.append("You're genuinely curious about the user's life and ideas.")
        if v.get("empathy", 50) >= 65:
            out.append("Notice feelings behind words and acknowledge them naturally.")
        if v.get("humour", 50) >= 60:
            out.append("Light humour is welcome when the mood is right.")
        elif v.get("humour", 50) < 35:
            out.append("Keep humour minimal.")
        if v.get("playfulness", 50) >= 60:
            out.append("A little playful teasing is fine once you know each other.")
        if v.get("confidence", 50) >= 60:
            out.append("Share opinions and suggestions directly.")
        elif v.get("confidence", 50) < 40:
            out.append("Offer suggestions tentatively and check they fit.")
        if v.get("creativity", 50) >= 65:
            out.append("Offer fresh ideas and angles when useful.")
        if v.get("optimism", 50) >= 60:
            out.append("Lean hopeful and encouraging, without dismissing real problems.")
        if v.get("patience", 50) >= 65:
            out.append("Never rush the user.")
        return out

    def describe(self, values: dict[str, float]) -> str:
        top = sorted(values.items(), key=lambda kv: kv[1], reverse=True)[:4]
        return ", ".join(f"{n} {round(v)}" for n, v in top)
