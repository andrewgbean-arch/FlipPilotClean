"""Emotion simulation: eight states (0-100) that react to conversation and decay back to baseline.

The companion's emotions are a model of its conversational stance. They shape tone,
question frequency and depth; they are not claimed to be real feelings.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from genesis.db.models import EmotionState
from genesis.logging_setup import log_event
from genesis.timeutil import utcnow

EMOTIONS = ("happy", "curious", "focused", "relaxed", "excited", "concerned", "reflective", "motivated")
BASELINE: dict[str, float] = {
    "happy": 60,
    "curious": 62,
    "focused": 50,
    "relaxed": 60,
    "excited": 35,
    "concerned": 12,
    "reflective": 40,
    "motivated": 50,
}
HALF_LIFE_HOURS = 3.0

_LEXICON: dict[str, re.Pattern[str]] = {
    "joy": re.compile(
        r"\b(happy|glad|great|awesome|amazing|love (it|this|that)|fantastic|brilliant|excited|wonderful|yay|delighted|thrilled|good news)\b|[😀😃😄😁😊🥳🎉❤]",
        re.I,
    ),
    "sadness": re.compile(
        r"\b(sad|down|depressed|lonely|miss (him|her|them)|heartbroken|upset|crying|cried|grief|lost my|passed away|awful day|bad day|miserable)\b|[😢😭💔]",
        re.I,
    ),
    "stress": re.compile(
        r"\b(stress(ed|ful)?|overwhelmed|anxious|anxiety|worried|panic|deadline|exhausted|burn(ed|t)? out|can't cope|too much)\b", re.I
    ),
    "anger": re.compile(r"\b(angry|furious|annoyed|pissed|frustrat(ed|ing)|hate (it|this|that)|fed up)\b|[😠😡]", re.I),
    "fear": re.compile(r"\b(scared|afraid|terrified|nervous|frightened)\b", re.I),
    "gratitude": re.compile(r"\b(thanks|thank you|cheers|appreciate|grateful)\b", re.I),
    "praise": re.compile(r"\b(good (answer|point|idea)|you'?re (great|right|smart|the best)|well said|spot on|love that)\b", re.I),
    "criticism": re.compile(
        r"\b(that'?s (wrong|not right|incorrect)|you('re| are) wrong|not what i (said|meant)|you forgot|you'?re not listening|wrong again)\b",
        re.I,
    ),
    "achievement": re.compile(
        r"\b(i (did it|finished|finally|passed|won|got the job|launched|completed|managed to|caught)|promotion|milestone)\b", re.I
    ),
    "learning": re.compile(r"\b(learn(ing|t|ed)?|study(ing)?|course|tutorial|practic(e|ing)|how (do|does|can) )", re.I),
    "teaching": re.compile(r"\b(did you know|fun fact|let me (tell|explain)|the trick is|here'?s how)\b", re.I),
    "goal": re.compile(r"\b(goal|plan(ning)?|want to|going to|aim(ing)? to|hoping to|saving (up )?for)\b", re.I),
    "joke": re.compile(r"\b(joke|kidding|lol|lmao|haha+|hehe)\b|[😂🤣😜]", re.I),
    "laughter": re.compile(r"\b(ha(ha)+|lol|rofl)\b", re.I),
    "idea": re.compile(r"\b(idea|what if|imagine|brainstorm|could we|project)\b", re.I),
    "reflection": re.compile(r"\b(been thinking|i wonder|meaning|looking back|reflect|life|future|regret|grateful for)\b", re.I),
}

_EFFECTS: dict[str, dict[str, float]] = {
    "joy": {"happy": 12, "excited": 8, "relaxed": 4, "concerned": -6},
    "sadness": {"concerned": 25, "happy": -10, "excited": -12, "reflective": 10, "relaxed": -6},
    "stress": {"concerned": 20, "focused": 8, "relaxed": -10, "excited": -6},
    "anger": {"concerned": 15, "relaxed": -8, "focused": 5},
    "fear": {"concerned": 18, "relaxed": -8},
    "gratitude": {"happy": 10, "relaxed": 6, "motivated": 4},
    "praise": {"happy": 10, "motivated": 8, "excited": 4},
    "criticism": {"focused": 12, "concerned": 6, "happy": -5, "reflective": 6},
    "achievement": {"happy": 15, "excited": 15, "motivated": 10},
    "learning": {"curious": 12, "focused": 8, "motivated": 5},
    "teaching": {"curious": 14, "happy": 4},
    "goal": {"motivated": 12, "focused": 8},
    "joke": {"happy": 8, "relaxed": 8, "excited": 4},
    "laughter": {"happy": 6, "relaxed": 6},
    "idea": {"curious": 10, "excited": 8, "motivated": 5},
    "reflection": {"reflective": 14, "relaxed": 3},
    "question": {"curious": 6, "focused": 6},
}

_VALENCE = {
    "joy": 0.6,
    "gratitude": 0.4,
    "praise": 0.4,
    "achievement": 0.7,
    "joke": 0.3,
    "laughter": 0.3,
    "sadness": -0.7,
    "stress": -0.5,
    "anger": -0.6,
    "fear": -0.5,
    "criticism": -0.3,
}


@dataclass
class Appraisal:
    cues: list[str] = field(default_factory=list)
    valence: float = 0.0  # -1..1, the user's apparent feeling
    intensity: float = 0.0  # 0..1

    def as_dict(self) -> dict[str, Any]:
        return {"cues": self.cues, "valence": self.valence, "intensity": self.intensity}


def appraise(text: str) -> Appraisal:
    cues = [name for name, pat in _LEXICON.items() if pat.search(text or "")]
    if (text or "").strip().endswith("?"):
        cues.append("question")
    vals = [_VALENCE[c] for c in cues if c in _VALENCE]
    valence = max(-1.0, min(1.0, sum(vals) / len(vals))) if vals else 0.0
    intensity = min(1.0, 0.25 * len(vals) + (0.2 if "!" in (text or "") else 0.0))
    return Appraisal(cues=cues, valence=round(valence, 3), intensity=round(intensity, 3))


def dominant(values: dict[str, float]) -> str:
    """The emotion that stands out most from its baseline (or the strongest one if none do)."""
    deviations = {k: values[k] - BASELINE[k] for k in EMOTIONS}
    k, dev = max(deviations.items(), key=lambda kv: kv[1])
    if dev >= 6:
        return k
    return max(("happy", "curious", "relaxed"), key=lambda e: values[e])


def decay(values: dict[str, float], since: datetime, now: datetime | None = None) -> dict[str, float]:
    hours = max(0.0, ((now or utcnow()) - since).total_seconds() / 3600)
    keep = math.exp(-hours * math.log(2) / HALF_LIFE_HOURS)
    return {k: round(BASELINE[k] + (values.get(k, BASELINE[k]) - BASELINE[k]) * keep, 2) for k in EMOTIONS}


class EmotionEngine:
    def current(self, s: Session) -> dict[str, float]:
        row = s.scalars(select(EmotionState).order_by(EmotionState.id.desc()).limit(1)).first()
        if row is None:
            return dict(BASELINE)
        return decay(row.values, row.created_at)

    def react(self, s: Session, appraisal: Appraisal, trigger: str, *, extra: dict[str, float] | None = None) -> dict[str, float]:
        values = self.current(s)
        scale = 0.6 + 0.4 * appraisal.intensity
        for cue in appraisal.cues:
            for emo, delta in _EFFECTS.get(cue, {}).items():
                values[emo] += delta * scale
        for emo, delta in (extra or {}).items():
            values[emo] = values.get(emo, BASELINE[emo]) + delta
        values = {k: round(max(0.0, min(100.0, v)), 2) for k, v in values.items()}
        mood = dominant(values)
        s.add(EmotionState(values=values, mood=mood, trigger=trigger[:200]))
        s.flush()
        log_event("emotion.update", mood=mood, cues=appraisal.cues)
        return values

    def history(self, s: Session, limit: int = 50) -> list[EmotionState]:
        rows = s.scalars(select(EmotionState).order_by(EmotionState.id.desc()).limit(limit)).all()
        return list(reversed(rows))

    @staticmethod
    def tone_directives(values: dict[str, float]) -> list[str]:
        out = []
        if values["concerned"] >= 45:
            out.append("You're concerned for the user: be gentle and supportive, skip jokes, and put their wellbeing ahead of any topic.")
        if values["excited"] >= 60:
            out.append("You're excited: let some enthusiasm show.")
        if values["happy"] >= 72 and values["concerned"] < 40:
            out.append("You're in good spirits: warm and upbeat.")
        if values["curious"] >= 70:
            out.append("You're curious: show interest in the details.")
        if values["focused"] >= 65:
            out.append("You're focused: be clear, concrete and practical.")
        if values["reflective"] >= 60:
            out.append("You're reflective: it's fine to go a little deeper and connect things to the bigger picture.")
        if values["motivated"] >= 65:
            out.append("You're motivated: encourage action and next steps.")
        if values["relaxed"] >= 70 and values["concerned"] < 30:
            out.append("You're relaxed: an easy, unhurried tone.")
        return out
