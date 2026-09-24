"""Deterministic stand-ins for the LLM and embedder, used by tests and offline demos."""

from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Callable, Iterator
from typing import Any

from genesis.llm.base import ChatResult, LLMUnavailable

Responder = Callable[[list[dict[str, Any]], dict[str, Any]], ChatResult | str]


class FakeLLM:
    """Replies via a responder function; records every call for assertions."""

    def __init__(self, responder: Responder | None = None, *, up: bool = True):
        self.responder = responder or _default_responder
        self.calls: list[dict[str, Any]] = []
        self.up = up

    @property
    def default_model(self) -> str:
        return "fake"

    def list_models(self) -> list[str]:
        return ["fake"] if self.up else []

    def available(self) -> bool:
        return self.up

    def chat(self, messages, *, tools=None, temperature=0.7, json_mode=False, model=None, max_tokens=None) -> ChatResult:
        if not self.up:
            raise LLMUnavailable("fake LLM is down")
        opts = {"tools": tools, "json_mode": json_mode, "model": model}
        self.calls.append({"messages": messages, **opts})
        out = self.responder(messages, opts)
        return out if isinstance(out, ChatResult) else ChatResult(content=out, model="fake")

    def chat_stream(self, messages, *, temperature=0.7, model=None, max_tokens=None) -> Iterator[str]:
        text = self.chat(messages, temperature=temperature, model=model).content
        yield from re.findall(r"\S+\s*", text)

    def describe_image(self, image_b64: str, prompt: str, model: str) -> str:
        return "A photo of a small fishing boat moored at a marina."


def _default_responder(messages: list[dict[str, Any]], opts: dict[str, Any]) -> str:
    if opts.get("json_mode"):
        return "{}"
    last = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    return f"I hear you. You said: {last[:80]}"


class HashEmbedder:
    """Bag-of-words feature hashing. Similar wording gives similar vectors; good enough for tests."""

    def __init__(self, dims: int = 256):
        self.dims = dims
        self.model_name = f"hash-{dims}"

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._one(t) for t in texts]

    def _one(self, text: str) -> list[float]:
        vec = [0.0] * self.dims
        for tok in re.findall(r"[a-z0-9']+", text.lower()):
            tok = tok[:-1] if tok.endswith("s") and len(tok) > 3 else tok  # crude stemming
            h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
            vec[h % self.dims] += 1.0 if (h >> 8) & 1 else -1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]
