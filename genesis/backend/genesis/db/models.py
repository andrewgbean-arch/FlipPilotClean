"""SQLAlchemy ORM models: the relational half of Genesis's memory.

SQLite is the source of truth. ChromaDB holds only embeddings keyed by memory id,
so the vector index can always be rebuilt from this database (see
MemoryEngine.reindex).

All datetimes are naive UTC.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from genesis.timeutil import utcnow


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON, list[Any]: JSON}


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


# --------------------------------------------------------------------------- users


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120), default="Friend")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime)


class ProfileField(TimestampMixin, Base):
    """One known fact about the user's profile (name, age, location, ...)."""

    __tablename__ = "profile_fields"
    __table_args__ = (UniqueConstraint("user_id", "field"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    field: Mapped[str] = mapped_column(String(64))
    value: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, default=0.7)
    source: Mapped[str] = mapped_column(String(32), default="conversation")
    # Earlier conflicting values are kept, never silently lost.
    history: Mapped[list[Any]] = mapped_column(JSON, default=list)


class Interest(TimestampMixin, Base):
    __tablename__ = "interests"
    __table_args__ = (UniqueConstraint("user_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(40), default="custom")
    strength: Mapped[float] = mapped_column(Float, default=30.0)  # 0-100
    mention_count: Mapped[int] = mapped_column(Integer, default=1)
    last_mentioned: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# --------------------------------------------------------------------------- conversations


class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="New conversation")
    summary: Mapped[str | None] = mapped_column(Text)
    topics: Mapped[list[Any]] = mapped_column(JSON, default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_message_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    summarized_at: Mapped[datetime | None] = mapped_column(DateTime)
    message_count: Mapped[int] = mapped_column(Integer, default=0)

    messages: Mapped[list[Message]] = relationship(back_populates="conversation", cascade="all, delete-orphan", order_by="Message.id")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (CheckConstraint("role in ('user','assistant','system','tool')"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    # Per-turn metadata: detected topics/emotion, memories used, question asked, safety flags.
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    learned: Mapped[bool] = mapped_column(Boolean, default=False)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


# --------------------------------------------------------------------------- memory


class Memory(TimestampMixin, Base):
    __tablename__ = "memories"
    __table_args__ = (
        CheckConstraint("importance_score >= 0 AND importance_score <= 1"),
        CheckConstraint("confidence >= 0 AND confidence <= 1"),
        CheckConstraint("emotional_score >= -1 AND emotional_score <= 1"),
        Index("ix_memories_user_active", "user_id", "archived"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    # Cognitive type: episodic | semantic | procedural | emotional | personal
    memory_type: Mapped[str] = mapped_column(String(20), index=True)
    # Content category: personal, preference, relationship, goal, event, interest, knowledge, reflection, summary, other
    category: Mapped[str] = mapped_column(String(32), default="other", index=True)
    # medium (recent, decays) | long (permanent)
    tier: Mapped[str] = mapped_column(String(10), default="medium")
    importance_score: Mapped[float] = mapped_column(Float, default=0.4)
    confidence: Mapped[float] = mapped_column(Float, default=0.7)
    source: Mapped[str] = mapped_column(String(32), default="conversation")
    source_ref: Mapped[str | None] = mapped_column(String(120))  # e.g. "message:42"
    emotional_score: Mapped[float] = mapped_column(Float, default=0.0)
    retrieval_count: Mapped[int] = mapped_column(Integer, default=0)
    last_recalled: Mapped[datetime | None] = mapped_column(DateTime)
    tags: Mapped[list[Any]] = mapped_column(JSON, default=list)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    embedding_model: Mapped[str | None] = mapped_column(String(80))
    indexed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    superseded_by: Mapped[int | None] = mapped_column(ForeignKey("memories.id", ondelete="SET NULL"))


class MemoryLink(Base):
    __tablename__ = "memory_links"
    __table_args__ = (
        UniqueConstraint("source_id", "target_id", "relation"),
        CheckConstraint("source_id != target_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("memories.id", ondelete="CASCADE"), index=True)
    target_id: Mapped[int] = mapped_column(ForeignKey("memories.id", ondelete="CASCADE"), index=True)
    relation: Mapped[str] = mapped_column(String(32), default="related")  # related, merged_into, summarises, contradicts
    strength: Mapped[float] = mapped_column(Float, default=0.5)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# --------------------------------------------------------------------------- companion state


class PersonalityTrait(Base):
    __tablename__ = "personality_traits"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(32), unique=True)
    value: Mapped[float] = mapped_column(Float)
    baseline: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text, default="")
    drift_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD the drift budget applies to
    drift_today: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class PersonalityProfile(Base):
    """Key/value identity attributes (core values, communication style, ...)."""

    __tablename__ = "personality_profile"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class EmotionState(Base):
    """Snapshots of the companion's simulated emotions. The latest row is the current state."""

    __tablename__ = "emotion_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    values: Mapped[dict[str, Any]] = mapped_column(JSON)
    mood: Mapped[str] = mapped_column(String(20))
    trigger: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Relationship(TimestampMixin, Base):
    __tablename__ = "relationships"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    trust: Mapped[float] = mapped_column(Float, default=20.0)
    familiarity: Mapped[float] = mapped_column(Float, default=0.0)
    interaction_count: Mapped[int] = mapped_column(Integer, default=0)
    shared_experiences: Mapped[int] = mapped_column(Integer, default=0)
    conversation_depth: Mapped[float] = mapped_column(Float, default=0.0)
    support_level: Mapped[float] = mapped_column(Float, default=0.0)
    level: Mapped[str] = mapped_column(String(32), default="Acquaintance")
    days_active: Mapped[int] = mapped_column(Integer, default=0)
    last_interaction_date: Mapped[str | None] = mapped_column(String(10))


# --------------------------------------------------------------------------- goals


class Goal(TimestampMixin, Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint("progress >= 0 AND progress <= 100"),
        CheckConstraint("status in ('active','paused','completed','abandoned')"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    goal_type: Mapped[str] = mapped_column(String(32), default="personal_development")
    horizon: Mapped[str] = mapped_column(String(10), default="medium")
    owner: Mapped[str] = mapped_column(String(12), default="user")  # user | companion
    status: Mapped[str] = mapped_column(String(12), default="active", index=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    follow_up_interval_days: Mapped[float] = mapped_column(Float, default=7.0)
    last_follow_up_at: Mapped[datetime | None] = mapped_column(DateTime)
    next_follow_up_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    last_mentioned_at: Mapped[datetime | None] = mapped_column(DateTime)
    source_memory_id: Mapped[int | None] = mapped_column(ForeignKey("memories.id", ondelete="SET NULL"))

    updates: Mapped[list[GoalUpdate]] = relationship(back_populates="goal", cascade="all, delete-orphan", order_by="GoalUpdate.id")


class GoalUpdate(Base):
    __tablename__ = "goal_updates"

    id: Mapped[int] = mapped_column(primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"), index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    progress: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str | None] = mapped_column(String(12))
    source: Mapped[str] = mapped_column(String(32), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    goal: Mapped[Goal] = relationship(back_populates="updates")


# --------------------------------------------------------------------------- knowledge


class Entity(TimestampMixin, Base):
    """A knowledge-graph node: a person, place, thing, activity or concept."""

    __tablename__ = "entities"
    __table_args__ = (UniqueConstraint("normalized_name", "entity_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    normalized_name: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(
        String(32), default="thing"
    )  # user, person, pet, place, thing, activity, organisation, concept, goal
    description: Mapped[str] = mapped_column(Text, default="")
    mention_count: Mapped[int] = mapped_column(Integer, default=1)


class KnowledgeItem(TimestampMixin, Base):
    """A factual statement with provenance. Optionally a (subject, predicate, object) triple."""

    __tablename__ = "knowledge_items"
    __table_args__ = (CheckConstraint("confidence >= 0 AND confidence <= 1"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    statement: Mapped[str] = mapped_column(Text)
    statement_hash: Mapped[str] = mapped_column(String(64), unique=True)
    subject_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id", ondelete="SET NULL"))
    predicate: Mapped[str | None] = mapped_column(String(64))
    object_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id", ondelete="SET NULL"))
    source: Mapped[str] = mapped_column(String(32), default="conversation")
    confidence: Mapped[float] = mapped_column(Float, default=0.7)
    evidence: Mapped[list[Any]] = mapped_column(JSON, default=list)
    retrieval_count: Mapped[int] = mapped_column(Integer, default=0)
    memory_id: Mapped[int | None] = mapped_column(ForeignKey("memories.id", ondelete="SET NULL"))


class KnowledgeLink(TimestampMixin, Base):
    """A knowledge-graph edge between two entities."""

    __tablename__ = "knowledge_links"
    __table_args__ = (UniqueConstraint("source_id", "target_id", "relation"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"), index=True)
    target_id: Mapped[int] = mapped_column(ForeignKey("entities.id", ondelete="CASCADE"), index=True)
    relation: Mapped[str] = mapped_column(String(64))
    confidence: Mapped[float] = mapped_column(Float, default=0.7)
    weight: Mapped[int] = mapped_column(Integer, default=1)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_hash: Mapped[str] = mapped_column(String(64), unique=True)
    chunks: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# --------------------------------------------------------------------------- reflection, journal, timeline


class Reflection(Base):
    __tablename__ = "reflections"

    id: Mapped[int] = mapped_column(primary_key=True)
    question: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    insights: Mapped[list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (UniqueConstraint("user_id", "period", "period_start"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    period: Mapped[str] = mapped_column(String(10))  # daily | weekly | monthly
    period_start: Mapped[datetime] = mapped_column(DateTime)
    period_end: Mapped[datetime] = mapped_column(DateTime)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    highlights: Mapped[list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(
        String(32), default="milestone"
    )  # life_event, achievement, goal_completed, life_change, milestone, relationship
    event_date: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    importance: Mapped[str] = mapped_column(String(10), default="medium")
    source: Mapped[str] = mapped_column(String(32), default="conversation")
    title_hash: Mapped[str] = mapped_column(String(64), unique=True)


# --------------------------------------------------------------------------- settings, tools, automation


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class ToolLog(Base):
    __tablename__ = "tool_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    tool_name: Mapped[str] = mapped_column(String(64), index=True)
    arguments: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    ok: Mapped[bool] = mapped_column(Boolean)
    result: Mapped[str] = mapped_column(Text, default="")
    duration_ms: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Note(TimestampMixin, Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list[Any]] = mapped_column(JSON, default=list)


class Task(TimestampMixin, Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    due_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    reminded: Mapped[bool] = mapped_column(Boolean, default=False)


class ProactiveMessage(Base):
    """Something the companion wants to say unprompted: a follow-up, a reminder, a curiosity question."""

    __tablename__ = "proactive_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(24))  # goal_follow_up, reminder, curiosity, reconnect, summary, suggestion
    content: Mapped[str] = mapped_column(Text)
    dedupe_key: Mapped[str] = mapped_column(String(120), unique=True)
    delivered: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AutomationRun(Base):
    __tablename__ = "automation_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    job: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(12))  # ok | error | skipped
    detail: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    duration_ms: Mapped[float] = mapped_column(Float, default=0.0)
