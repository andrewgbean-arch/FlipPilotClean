"""Service container: builds and wires every engine once, at startup.

Tests build it with a FakeLLM, HashEmbedder and in-memory vector store; the app
builds it with Ollama and ChromaDB. Nothing else constructs engines.
"""

from __future__ import annotations

import random
from collections.abc import Callable
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from genesis import settings_store
from genesis.automation.scheduler import Scheduler
from genesis.config import Config
from genesis.conversation.engine import ConversationEngine
from genesis.db.database import Database
from genesis.db.models import Goal, ProfileField
from genesis.emotion.engine import EmotionEngine
from genesis.goals.engine import GoalEngine
from genesis.knowledge.graph import KnowledgeEngine
from genesis.learning.engine import LearningEngine
from genesis.llm.base import LLM, Embedder
from genesis.llm.ollama import OllamaClient, OllamaEmbedder
from genesis.memory.consolidation import Consolidator
from genesis.memory.engine import MemoryEngine
from genesis.memory.vector_store import VectorStore, make_vector_store
from genesis.personality.engine import PersonalityEngine
from genesis.profile.engine import ProfileEngine
from genesis.reflection.engine import ReflectionEngine
from genesis.reflection.timeline import TimelineEngine
from genesis.relationship.engine import RelationshipEngine
from genesis.tools.registry import ToolRegistry, default_registry
from genesis.vision.engine import VisionEngine
from genesis.voice.engine import SpeechToText, TextToSpeech


class Services:
    def __init__(
        self,
        config: Config,
        *,
        llm: LLM | None = None,
        embedder: Embedder | None = None,
        vector_store: VectorStore | None = None,
        rng: Callable[[], float] | None = None,
        tools: ToolRegistry | None = None,
    ):
        self.config = config
        config.ensure_dirs()
        self.db = Database(config.db_url)
        self.llm: LLM = llm or OllamaClient(config.ollama_url, config.chat_model, config.fallback_models, config.llm_timeout_seconds)
        self.embedder: Embedder = embedder or OllamaEmbedder(config.ollama_url, config.embed_model)
        self.vector_store = vector_store or make_vector_store(config.vector_backend, config.chroma_dir, self.embedder.model_name)
        self.rng = rng or random.random

        self.memory = MemoryEngine(self.embedder, self.vector_store)
        self.personality = PersonalityEngine()
        self.emotion = EmotionEngine()
        self.relationship = RelationshipEngine()
        self.profile = ProfileEngine()
        self.knowledge = KnowledgeEngine()
        self.goals = GoalEngine()
        self.timeline = TimelineEngine()
        self.learning = LearningEngine(
            self.llm, self.memory, self.profile, self.knowledge, self.goals, self.timeline, self.relationship, self.emotion
        )
        self.consolidator = Consolidator(self.llm, self.memory, self.relationship)
        self.reflection = ReflectionEngine(self.llm, self.memory, self.goals, self.profile, self.relationship, self.timeline, self.emotion)
        self.tools = tools or default_registry()
        self.conversation = ConversationEngine(self)
        self.stt = SpeechToText(config.whisper_model, config.whisper_device)
        self.tts = TextToSpeech(config.voices_dir, config.piper_voice, config.piper_binary)
        self.vision = VisionEngine(self)
        self.scheduler = Scheduler(self)

    def startup(self, *, start_scheduler: bool | None = None) -> None:
        self.db.create_all()
        with self.db.session() as s:
            self.personality.ensure_seeded(s)
            self.goals.ensure_companion_goals(s)
            self.relationship.get(s)
            self.knowledge.user_entity(s)
            self.memory.rebuild_if_empty(s)
        with self.db.session() as s:
            self.memory.reindex(s)
        if self.config.scheduler_enabled if start_scheduler is None else start_scheduler:
            self.scheduler.start()

    def shutdown(self) -> None:
        self.scheduler.stop()

    # ------------------------------------------------------------------ shared helpers

    def settings(self, s: Session) -> dict[str, Any]:
        return settings_store.get_all(s)

    def refresh_companion_goals(self, s: Session) -> None:
        known = s.scalar(select(func.count(ProfileField.id))) or 0
        interests = len(self.profile.interests(s, limit=100))
        user_goals = s.scalar(select(func.count(Goal.id)).where(Goal.owner == "user")) or 0
        self.goals.refresh_companion_goals(s, known, interests, user_goals)
