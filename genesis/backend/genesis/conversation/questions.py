"""Question engine: decides whether to ask a follow-up this turn, and about what.

Principles:
- At most one question per reply, and only when it feels natural.
- Never interrogate: back off after recent questions, and when the user is asking something.
- Care comes first: if the user seems to be struggling, ask about them, not about trivia.
- Priority when asking: care > clarify a contradiction > a due goal follow-up >
  something the user just mentioned > a question from the companion's own reflection >
  a gap in what the companion knows (only when the relationship allows it).
"""

from __future__ import annotations

import random
from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass
class QuestionInputs:
    user_text: str
    cues: list[str]
    frequency: float  # 0-100 setting
    curiosity_trait: float
    emotions: dict[str, float]
    recent_assistant: list[str]  # most recent last
    fresh_topics: list[str] = field(default_factory=list)  # things just mentioned in this message
    due_goal: tuple[int, str] | None = None  # (goal_id, title)
    conflict: tuple[str, str, str] | None = None  # (field, stored value, new value)
    curiosity_prompt: tuple[int, str] | None = None  # (proactive id, question)
    profile_gap: tuple[str, str] | None = None  # (field, hint)
    followed_up_this_conversation: bool = False


@dataclass
class QuestionPlan:
    ask: bool
    kind: str | None = None
    focus: str | None = None
    directive: str = ""
    probability: float = 0.0
    goal_id: int | None = None
    conflict_field: str | None = None
    curiosity_id: int | None = None


def probability(inp: QuestionInputs) -> float:
    if inp.frequency <= 0:
        return 0.0
    p = (inp.frequency / 100) * (0.55 + 0.45 * inp.curiosity_trait / 100) * (0.85 + 0.3 * inp.emotions.get("curious", 50) / 100)
    asked = sum(1 for m in inp.recent_assistant[-3:] if m.rstrip().endswith("?"))
    if asked >= 2:
        p *= 0.35
    elif asked == 1 and inp.recent_assistant and inp.recent_assistant[-1].rstrip().endswith("?"):
        p *= 0.75
    if inp.user_text.rstrip().endswith("?"):
        p *= 0.6  # they asked something: answering comes first
    if len(inp.user_text.split()) <= 2:
        p *= 0.8
    if inp.fresh_topics or inp.due_goal:
        p *= 1.25
    return round(max(0.0, min(0.95, p)), 3)


def decide(inp: QuestionInputs, rng: Callable[[], float] = random.random) -> QuestionPlan:
    distressed = bool(set(inp.cues) & {"sadness", "stress", "fear", "anger"}) or inp.emotions.get("concerned", 0) >= 55
    if distressed and inp.frequency > 0:
        return QuestionPlan(
            True,
            "care",
            None,
            "They seem to be having a hard time. Acknowledge it first. If it fits, end with one gentle, open question about how they're doing or whether they want to talk about it. Don't change the subject.",
            1.0,
        )

    p = probability(inp)
    if rng() >= p:
        return QuestionPlan(
            False,
            directive="Don't ask a question this turn unless it's truly needed. Respond naturally and let them lead.",
            probability=p,
        )

    if inp.conflict:
        f, old, new = inp.conflict
        return QuestionPlan(
            True,
            "clarify",
            f,
            f"You had noted their {f.replace('_', ' ')} as '{old}', but they just implied '{new}'. Casually check which is right (e.g. whether something changed). One short question, no fuss.",
            p,
            conflict_field=f,
        )
    if inp.due_goal and not inp.followed_up_this_conversation:
        gid, title = inp.due_goal
        return QuestionPlan(
            True,
            "goal_follow_up",
            title,
            f'If it fits the flow, briefly check in on their goal "{title}" (how it\'s going). Ask about it warmly, like a friend who remembered.',
            p,
            goal_id=gid,
        )
    if inp.fresh_topics:
        topic = inp.fresh_topics[0]
        return QuestionPlan(
            True,
            "topic_follow_up",
            topic,
            f"They just mentioned {topic}. End with ONE natural follow-up question that invites them to say more about it (for example what they enjoy most about it, how they got into it, or what's next). Keep it specific, not generic.",
            p,
        )
    if inp.curiosity_prompt:
        pid, q = inp.curiosity_prompt
        return QuestionPlan(
            True,
            "curiosity",
            q,
            f'If it fits naturally, you\'ve been wondering: "{q}". You may ask it, in your own words.',
            p,
            curiosity_id=pid,
        )
    if inp.profile_gap:
        f, hint = inp.profile_gap
        return QuestionPlan(
            True,
            "profile_gap",
            f,
            f"If it fits naturally, you'd like to learn {hint}. Ask lightly, and only if it flows from the conversation.",
            p,
        )
    return QuestionPlan(
        True,
        "open",
        None,
        "End with one natural question that shows interest in what they just said.",
        p,
    )
