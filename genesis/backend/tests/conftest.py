"""Test fixtures: a full Genesis stack with a scripted fake LLM, hash embeddings and an in-memory vector store."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from genesis.config import Config
from genesis.llm.base import ChatResult
from genesis.llm.fake import FakeLLM, HashEmbedder
from genesis.main import create_app
from genesis.memory.vector_store import InMemoryVectorStore
from genesis.services import Services


class Script:
    """Routes fake-LLM calls: JSON-mode calls (extraction, summaries) vs. chat replies."""

    def __init__(self) -> None:
        self.reply: Callable[[list[dict[str, Any]], dict[str, Any]], ChatResult | str] = lambda m, o: "That sounds great. Tell me more?"
        self.json: Callable[[list[dict[str, Any]]], str] = lambda m: "{}"

    def __call__(self, messages, opts):
        if opts.get("json_mode"):
            return self.json(messages)
        return self.reply(messages, opts)


@pytest.fixture
def script() -> Script:
    return Script()


@pytest.fixture
def config(tmp_path) -> Config:
    return Config(data_dir=tmp_path, vector_backend="memory", scheduler_enabled=False, log_json=True, log_level="INFO")


@pytest.fixture
def llm(script) -> FakeLLM:
    return FakeLLM(script)


@pytest.fixture
def svc(config, llm) -> Services:
    services = Services(config, llm=llm, embedder=HashEmbedder(), vector_store=InMemoryVectorStore(), rng=lambda: 0.0)
    services.startup(start_scheduler=False)
    return services


@pytest.fixture
def client(svc) -> TestClient:
    app = create_app(services=svc, start_scheduler=False)
    with TestClient(app) as c:
        yield c


def system_prompt(llm: FakeLLM, index: int = -1) -> str:
    chats = [c for c in llm.calls if not c["json_mode"]]
    return chats[index]["messages"][0]["content"]
