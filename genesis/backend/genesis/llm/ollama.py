"""Ollama client for chat, streaming, tool calls, embeddings and vision."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
from typing import Any

import httpx

from genesis.llm.base import ChatResult, LLMUnavailable, ToolCall

log = logging.getLogger(__name__)


class OllamaClient:
    def __init__(self, base_url: str, model: str, fallback_models: list[str] | None = None, timeout: float = 120.0):
        self.base_url = base_url.rstrip("/")
        self._model = model
        self.fallback_models = fallback_models or []
        self._http = httpx.Client(base_url=self.base_url, timeout=httpx.Timeout(timeout, connect=5.0))
        self._models_cache: tuple[float, list[str]] | None = None

    # ------------------------------------------------------------------ models

    def list_models(self) -> list[str]:
        if self._models_cache and time.monotonic() - self._models_cache[0] < 30:
            return self._models_cache[1]
        try:
            r = self._http.get("/api/tags", timeout=5.0)
            r.raise_for_status()
            names = [m["name"] for m in r.json().get("models", [])]
        except (httpx.HTTPError, ValueError, KeyError):
            names = []
        self._models_cache = (time.monotonic(), names)
        return names

    def available(self) -> bool:
        try:
            return self._http.get("/api/version", timeout=3.0).status_code == 200
        except httpx.HTTPError:
            return False

    @property
    def default_model(self) -> str:
        return self._model

    def resolve_model(self, requested: str | None = None) -> str:
        """Use the requested model if installed, else the first installed fallback."""
        wanted = requested or self._model
        installed = self.list_models()
        if not installed:
            return wanted  # let Ollama report the real error
        if _installed(wanted, installed):
            return wanted
        for candidate in self.fallback_models:
            match = _installed(candidate, installed)
            if match:
                log.warning("model %s not installed, falling back to %s", wanted, match)
                return match
        return wanted

    # ------------------------------------------------------------------ chat

    def _payload(self, messages, model, temperature, max_tokens, stream, tools=None, json_mode=False) -> dict[str, Any]:
        options: dict[str, Any] = {"temperature": temperature}
        if max_tokens:
            options["num_predict"] = max_tokens
        payload: dict[str, Any] = {
            "model": self.resolve_model(model),
            "messages": messages,
            "stream": stream,
            "options": options,
        }
        if tools:
            payload["tools"] = tools
        if json_mode:
            payload["format"] = "json"
        return payload

    def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
        json_mode: bool = False,
        model: str | None = None,
        max_tokens: int | None = None,
    ) -> ChatResult:
        payload = self._payload(messages, model, temperature, max_tokens, False, tools, json_mode)
        try:
            r = self._http.post("/api/chat", json=payload)
        except httpx.HTTPError as e:
            raise LLMUnavailable(f"Ollama unreachable at {self.base_url}: {e}") from e
        if r.status_code == 400 and tools:
            # Model doesn't support tools: retry without them rather than failing the turn.
            return self.chat(messages, temperature=temperature, json_mode=json_mode, model=model, max_tokens=max_tokens)
        if r.status_code >= 400:
            raise LLMUnavailable(f"Ollama error {r.status_code}: {r.text[:300]}")
        data = r.json()
        msg = data.get("message", {})
        calls = []
        for c in msg.get("tool_calls") or []:
            fn = c.get("function", {})
            args = fn.get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except ValueError:
                    args = {}
            calls.append(ToolCall(name=fn.get("name", ""), arguments=args))
        return ChatResult(content=msg.get("content", ""), tool_calls=calls, model=data.get("model", payload["model"]))

    def chat_stream(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.7,
        model: str | None = None,
        max_tokens: int | None = None,
    ) -> Iterator[str]:
        payload = self._payload(messages, model, temperature, max_tokens, True)
        try:
            with self._http.stream("POST", "/api/chat", json=payload) as r:
                if r.status_code >= 400:
                    r.read()
                    raise LLMUnavailable(f"Ollama error {r.status_code}: {r.text[:300]}")
                for line in r.iter_lines():
                    if not line:
                        continue
                    chunk = json.loads(line)
                    if chunk.get("error"):
                        raise LLMUnavailable(chunk["error"])
                    piece = chunk.get("message", {}).get("content", "")
                    if piece:
                        yield piece
                    if chunk.get("done"):
                        return
        except httpx.HTTPError as e:
            raise LLMUnavailable(f"Ollama unreachable at {self.base_url}: {e}") from e

    def describe_image(self, image_b64: str, prompt: str, model: str) -> str:
        messages = [{"role": "user", "content": prompt, "images": [image_b64]}]
        return self.chat(messages, model=model, temperature=0.2).content

    def close(self) -> None:
        self._http.close()


class OllamaEmbedder:
    def __init__(self, base_url: str, model: str, timeout: float = 60.0):
        self.model_name = model
        self._http = httpx.Client(base_url=base_url.rstrip("/"), timeout=httpx.Timeout(timeout, connect=5.0))

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            r = self._http.post("/api/embed", json={"model": self.model_name, "input": texts})
        except httpx.HTTPError as e:
            raise LLMUnavailable(f"embedding model unreachable: {e}") from e
        if r.status_code >= 400:
            raise LLMUnavailable(f"embedding error {r.status_code}: {r.text[:200]}")
        vectors = r.json().get("embeddings") or []
        if len(vectors) != len(texts):
            raise LLMUnavailable("embedding count mismatch")
        return vectors


def _installed(name: str, installed: list[str]) -> str | None:
    if name in installed:
        return name
    base = name.split(":")[0]
    for m in installed:
        if m == f"{name}:latest" or m.split(":")[0] == base:
            return m
    return None
