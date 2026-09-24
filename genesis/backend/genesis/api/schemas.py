"""Request bodies. Response shapes are documented in docs/API.md."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Importance = Literal["low", "medium", "high", "critical"]
MemoryType = Literal["episodic", "semantic", "procedural", "emotional", "personal"]


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    conversation_id: int | None = None


class MemoryAdd(BaseModel):
    content: str = Field(..., min_length=3, max_length=1500)
    title: str | None = Field(None, max_length=200)
    memory_type: MemoryType = "personal"
    category: str = Field("personal", max_length=32)
    importance: Importance | None = None
    confidence: float = Field(0.95, ge=0, le=1)
    tags: list[str] = Field(default_factory=list, max_length=12)
    emotional_score: float = Field(0.0, ge=-1, le=1)


class MemorySearch(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(10, ge=1, le=50)
    memory_types: list[MemoryType] | None = None


class MemoryUpdate(BaseModel):
    memory_id: int
    title: str | None = Field(None, max_length=200)
    content: str | None = Field(None, max_length=1500)
    importance: Importance | None = None
    confidence: float | None = Field(None, ge=0, le=1)
    tags: list[str] | None = None
    archived: bool | None = None
    memory_type: MemoryType | None = None
    category: str | None = Field(None, max_length=32)


class MemoryDelete(BaseModel):
    memory_id: int


class ProfileUpdate(BaseModel):
    field: str = Field(..., min_length=1, max_length=64)
    value: str = Field(..., max_length=300)


class GoalCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field("", max_length=1000)
    goal_type: str | None = None
    horizon: Literal["short", "medium", "long"] = "medium"
    owner: Literal["user", "companion"] = "user"
    follow_up_interval_days: float | None = Field(None, ge=0.5, le=365)


class GoalUpdateRequest(BaseModel):
    goal_id: int
    status: Literal["active", "paused", "completed", "abandoned"] | None = None
    progress: float | None = Field(None, ge=0, le=100)
    note: str | None = Field(None, max_length=1000)


class KnowledgeCreate(BaseModel):
    statement: str = Field(..., min_length=4, max_length=600)
    subject: str | None = Field(None, max_length=120)
    predicate: str | None = Field(None, max_length=64)
    object: str | None = Field(None, max_length=120)
    source: str = Field("user", max_length=32)
    confidence: float = Field(0.9, ge=0, le=1)


class JournalGenerate(BaseModel):
    period: Literal["daily", "weekly", "monthly"] = "daily"


class TimelineCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field("", max_length=1000)
    category: str = "milestone"
    event_date: str | None = None
    importance: Importance = "medium"


class ToolExecute(BaseModel):
    name: str = Field(..., max_length=64)
    arguments: dict[str, Any] = Field(default_factory=dict)


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: str | None = Field(None, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
