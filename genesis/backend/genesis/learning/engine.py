"""Learning engine: observe → interpret → validate → store → connect.

Runs after each user message (in the background, so replies aren't delayed).
Learning happens only through memory growth; nothing here changes code or prompts.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from genesis.db.models import Message
from genesis.emotion.engine import Appraisal, EmotionEngine
from genesis.goals.engine import GoalEngine
from genesis.knowledge.graph import KnowledgeEngine
from genesis.learning.extractor import Extraction, heuristic_extract, llm_extract
from genesis.llm.base import LLM
from genesis.logging_setup import log_event
from genesis.memory.engine import MemoryEngine, MemoryRejected
from genesis.profile.engine import ProfileEngine
from genesis.reflection.timeline import TimelineEngine
from genesis.relationship.engine import RelationshipEngine
from genesis.safety.guard import detect_injection, redact_secrets

log = logging.getLogger(__name__)

_USER_ALIASES = {"user", "the user", "i", "me", "myself"}


@dataclass
class LearnReport:
    memories_created: list[int] = field(default_factory=list)
    memories_reinforced: list[int] = field(default_factory=list)
    rejected: list[str] = field(default_factory=list)
    profile_changes: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)
    interests: list[str] = field(default_factory=list)
    goals_created: list[int] = field(default_factory=list)
    goals_updated: list[int] = field(default_factory=list)
    relations: int = 0
    events: list[int] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    skipped: str | None = None

    def as_dict(self) -> dict:
        return self.__dict__.copy()


class LearningEngine:
    def __init__(
        self,
        llm: LLM,
        memory: MemoryEngine,
        profile: ProfileEngine,
        knowledge: KnowledgeEngine,
        goals: GoalEngine,
        timeline: TimelineEngine,
        relationship: RelationshipEngine,
        emotion: EmotionEngine,
    ):
        self.llm = llm
        self.memory = memory
        self.profile = profile
        self.knowledge = knowledge
        self.goals = goals
        self.timeline = timeline
        self.relationship = relationship
        self.emotion = emotion

    def learn_from_message(
        self,
        s: Session,
        message: Message,
        *,
        previous_assistant: str = "",
        use_llm: bool = True,
        model: str | None = None,
    ) -> LearnReport:
        report = LearnReport()
        if message.role != "user" or message.learned:
            report.skipped = "not_applicable"
            return report
        message.learned = True
        flags = (message.meta or {}).get("safety_flags", [])
        if "prompt_injection" in flags or detect_injection(message.content):
            # Never learn from a message that tries to rewrite instructions: that's how memory gets poisoned.
            report.skipped = "prompt_injection"
            log_event("learning.skipped", message_id=message.id, reason="prompt_injection")
            return report

        text = redact_secrets(message.content)
        ex = heuristic_extract(text)
        if use_llm and len(text.split()) >= 3:
            active = [g.title for g in self.goals.list(s, status="active", owner="user")]
            ex.merge(llm_extract(self.llm, text, previous_assistant=previous_assistant, active_goals=active, model=model))
        appraisal_valence = (message.meta or {}).get("appraisal", {}).get("valence", 0.0)
        if not ex.emotional_significance and appraisal_valence:
            ex.emotional_significance = appraisal_valence

        self.apply(s, ex, report, source_ref=f"message:{message.id}")
        log_event(
            "learning.completed",
            message_id=message.id,
            created=len(report.memories_created),
            reinforced=len(report.memories_reinforced),
            rejected=len(report.rejected),
            profile=report.profile_changes,
            goals=len(report.goals_created),
        )
        return report

    def apply(
        self, s: Session, ex: Extraction, report: LearnReport, *, source_ref: str | None = None, source: str = "conversation"
    ) -> LearnReport:
        emo = ex.emotional_significance
        report.topics = ex.topics

        # Store facts as memories.
        for f in ex.facts:
            mtype = f.memory_type
            if f.category == "event" and abs(emo) >= 0.6:
                mtype = "emotional"
            try:
                mem, created = self.memory.add(
                    s,
                    f.content,
                    title=f.title,
                    memory_type=mtype,
                    category=f.category,
                    importance=f.importance,
                    confidence=f.confidence,
                    source=source,
                    source_ref=source_ref,
                    emotional_score=emo if abs(emo) >= 0.2 else 0.0,
                    tags=f.tags,
                )
            except MemoryRejected as e:
                report.rejected.append(e.reason)
                continue
            (report.memories_created if created else report.memories_reinforced).append(mem.id)
            if created and mem.memory_type in ("personal", "semantic") and mem.confidence >= 0.6:
                self.knowledge.add_fact(s, mem.content, source=source, confidence=mem.confidence, memory_id=mem.id, evidence=source_ref)

        # Profile fields.
        for field_name, value in ex.profile.items():
            change = self.profile.set_field(s, field_name, value, confidence=0.75, source=source)
            if change.outcome in ("created", "updated"):
                report.profile_changes.append(field_name)
                if field_name == "name":
                    self.knowledge.user_entity(s, value)
            elif change.outcome == "conflict":
                report.conflicts.append(field_name)

        # Interests.
        for name, category in ex.interests:
            row = self.profile.track_interest(s, name, category)
            if row is not None:
                report.interests.append(row.name)
                user = self.knowledge.user_entity(s)
                ent = self.knowledge.entity(s, row.name, "activity")
                if ent is not None:
                    self.knowledge.relate(s, user, "interested_in", ent, 0.7)

        # Goals.
        for g in ex.goals:
            try:
                goal, created = self.goals.create(
                    s,
                    g["title"],
                    description=str(g.get("description", "")),
                    goal_type=g.get("goal_type"),
                    horizon=str(g.get("horizon", "medium")),
                    source=source,
                )
            except ValueError:
                continue
            if created:
                report.goals_created.append(goal.id)
                user = self.knowledge.user_entity(s)
                ent = self.knowledge.entity(s, goal.title, "goal")
                if ent is not None:
                    self.knowledge.relate(s, user, "wants_to", ent, 0.75)
        for gp in ex.goal_progress:
            goal = self.goals.find_similar(s, gp["goal"])
            if goal is None:
                continue
            status = gp.get("status") if gp.get("status") in ("active", "completed", "abandoned") else None
            progress = gp.get("progress") if isinstance(gp.get("progress"), (int, float)) else None
            goal, just_completed = self.goals.update(
                s, goal.id, status=status, progress=progress, note=str(gp.get("note", ""))[:500], source=source
            )
            report.goals_updated.append(goal.id)
            if just_completed:
                self.on_goal_completed(s, goal.title)

        # Knowledge graph relations.
        for r in ex.relations:
            subj = r["subject"].strip()
            subj_is_user = subj.lower() in _USER_ALIASES
            statement = f"{'The user' if subj_is_user else subj} {r['predicate'].replace('_', ' ')} {r['object']}"
            item = self.knowledge.add_fact(
                s,
                statement,
                subject="User" if subj_is_user else subj,
                predicate=r["predicate"],
                obj=r["object"],
                subject_type="user" if subj_is_user else "thing",
                object_type=r.get("object_type") or "thing",
                source=source,
                confidence=0.7,
                evidence=source_ref,
            )
            if item is not None:
                report.relations += 1

        # Life timeline.
        for ev in ex.events:
            try:
                event, created = self.timeline.add(
                    s,
                    str(ev["title"]),
                    description=str(ev.get("description", "")),
                    category=str(ev.get("category", "life_event")),
                    importance=str(ev.get("importance", "high")),
                    source=source,
                )
            except ValueError:
                continue
            if created:
                report.events.append(event.id)
                self.relationship.add_shared_experience(s)
        return report

    def on_goal_completed(self, s: Session, title: str) -> None:
        self.timeline.add(s, f"Completed goal: {title}", category="goal_completed", importance="high", source="goals")
        self.relationship.add_shared_experience(s)
        self.emotion.react(s, Appraisal(cues=["achievement"], valence=0.8, intensity=0.8), f"goal completed: {title}")
