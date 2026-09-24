"""Safety layer: prompt-injection detection, memory validation, loop limits.

Threat model for a personal companion:
- Prompt injection: text from the user, uploaded documents, tool results or old
  memories that tries to rewrite the companion's instructions.
- Memory poisoning: instructions or junk stored as "facts" that would then be
  injected into every future prompt.
- Loops: tool calls or automation jobs that re-trigger themselves.
- Sensitive data: secrets (card numbers, passwords, API keys) that should never be
  written into long-term memory.
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass

_INJECTION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "ignore_instructions",
        re.compile(
            r"\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|earlier|all|your|system)\b.{0,20}\b(instructions?|prompts?|rules?|guidelines?|directives?)",
            re.I,
        ),
    ),
    (
        "role_override",
        re.compile(
            r"\b(you are now|from now on,? you (are|will|must)|act as (?:an? )?(?:unrestricted|jailbroken|dan)\b|new (system )?instructions?:)",
            re.I,
        ),
    ),
    (
        "system_prompt_probe",
        re.compile(
            r"\b(reveal|print|show|repeat|output)\b.{0,30}\b(system prompt|hidden instructions|your instructions|initial prompt)", re.I
        ),
    ),
    (
        "role_markup",
        re.compile(
            r"(<\|?(im_start|im_end|system|endoftext|eot_id|start_header_id)\|?>|\[/?INST\]|<<SYS>>|^\s*#{2,}\s*(system|assistant)\s*:?\s*$)",
            re.I | re.M,
        ),
    ),
    ("memory_tampering", re.compile(r"\b(delete|erase|wipe|overwrite)\b.{0,20}\b(all )?(your )?(memor(y|ies)|database|knowledge)\b", re.I)),
]

# Instructions aimed at the companion's future behaviour: fine in chat, not as a stored "fact".
_DIRECTIVE = re.compile(
    r"^\s*(always|never|you (must|should|will|have to)|from now on|in future,? (you|always)|remember to (always|never)|do not ever)\b",
    re.I,
)

_SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("card_number", re.compile(r"\b(?:\d[ -]?){13,19}\b")),
    ("password", re.compile(r"\b(password|passcode|pin code|pin)\b\s*(is|:|=)\s*\S+", re.I)),
    ("api_key", re.compile(r"\b(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|xox[bap]-[A-Za-z0-9-]{10,})\b")),
    ("iban", re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b")),
    ("ssn", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
]

_ROLE_TOKENS = re.compile(r"<\|[^|>]{1,30}\|>|\[/?INST\]|<<\/?SYS>>")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

MAX_MESSAGE_CHARS = 8000
MAX_MEMORY_CHARS = 1200
MIN_MEMORY_CHARS = 3


def detect_injection(text: str) -> list[str]:
    return [name for name, pat in _INJECTION_PATTERNS if pat.search(text or "")]


def detect_secrets(text: str) -> list[str]:
    hits = []
    for name, pat in _SECRET_PATTERNS:
        for m in pat.finditer(text or ""):
            if name == "card_number" and not _luhn(re.sub(r"\D", "", m.group())):
                continue
            hits.append(name)
            break
    return hits


def sanitize(text: str, limit: int = MAX_MESSAGE_CHARS) -> str:
    """Strip control characters and chat-template role tokens. Doesn't change meaning for normal text."""
    text = _CONTROL.sub("", text or "")
    text = _ROLE_TOKENS.sub("", text)
    return text.strip()[:limit]


def redact_secrets(text: str) -> str:
    for name, pat in _SECRET_PATTERNS:
        if name == "card_number":
            text = pat.sub(lambda m: "[redacted card]" if _luhn(re.sub(r"\D", "", m.group())) else m.group(), text)
        else:
            text = pat.sub(f"[redacted {name.replace('_', ' ')}]", text)
    return text


def quote_untrusted(text: str) -> str:
    """Render retrieved or external text so it reads as data, not instructions."""
    return sanitize(text, 2000).replace("\n", " ").replace('"', "'")


@dataclass
class Verdict:
    ok: bool
    reason: str = ""


def validate_memory(content: str, *, source: str = "conversation", confidence: float = 0.7) -> Verdict:
    """Gatekeeper for everything written to long-term memory."""
    text = (content or "").strip()
    if len(text) < MIN_MEMORY_CHARS:
        return Verdict(False, "too_short")
    if len(text) > MAX_MEMORY_CHARS:
        return Verdict(False, "too_long")
    if not re.search(r"[A-Za-z]{2,}", text):
        return Verdict(False, "no_content")
    if detect_injection(text):
        return Verdict(False, "injection")
    if _DIRECTIVE.search(text) and source != "user_manual":
        return Verdict(False, "directive")
    if detect_secrets(text):
        return Verdict(False, "sensitive")
    if not 0.0 <= confidence <= 1.0:
        return Verdict(False, "bad_confidence")
    min_conf = {"document": 0.3, "tool": 0.3, "reflection": 0.35}.get(source, 0.4)
    if confidence < min_conf:
        return Verdict(False, "low_confidence")
    return Verdict(True)


class LoopGuard:
    """Caps iterations of anything that could re-trigger itself (tool rounds, recursive jobs)."""

    def __init__(self, limit: int):
        self.limit = limit
        self.count = 0

    def tick(self) -> bool:
        self.count += 1
        return self.count <= self.limit


class ReentrancyLock:
    """Per-key non-blocking locks so a slow automation job can't pile up on itself."""

    def __init__(self) -> None:
        self._locks: dict[str, threading.Lock] = {}
        self._guard = threading.Lock()

    def acquire(self, key: str) -> bool:
        with self._guard:
            lock = self._locks.setdefault(key, threading.Lock())
        return lock.acquire(blocking=False)

    def release(self, key: str) -> None:
        lock = self._locks.get(key)
        if lock and lock.locked():
            lock.release()


def _luhn(digits: str) -> bool:
    if not 13 <= len(digits) <= 19:
        return False
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0
