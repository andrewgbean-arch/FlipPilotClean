from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any, Protocol


class LLMUnavailable(RuntimeError):
    """The language model runtime can't be reached or has no usable model."""


@dataclass
class ToolCall:
    name: str
    arguments: dict[str, Any]


@dataclass
class ChatResult:
    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    model: str = ""


class LLM(Protocol):
    def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
        json_mode: bool = False,
        model: str | None = None,
        max_tokens: int | None = None,
    ) -> ChatResult: ...

    def chat_stream(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.7,
        model: str | None = None,
        max_tokens: int | None = None,
    ) -> Iterator[str]: ...

    def list_models(self) -> list[str]: ...

    def available(self) -> bool: ...

    @property
    def default_model(self) -> str: ...


class Embedder(Protocol):
    model_name: str

    def embed(self, texts: list[str]) -> list[list[float]]: ...
