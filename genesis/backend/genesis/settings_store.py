"""Runtime settings: typed defaults, validation and persistence in the settings table."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from genesis.db.models import Setting

DEFAULTS: dict[str, Any] = {
    "companion_name": "Genesis",
    "user_name": "",
    "chat_model": "",  # empty = use GENESIS_CHAT_MODEL
    "question_frequency": 55,  # 0 = never ask, 100 = ask whenever it's natural
    "response_length": "medium",
    "autonomy_enabled": True,
    "proactive_enabled": True,
    "voice_enabled": True,
    "tts_voice": "",  # empty = GENESIS_PIPER_VOICE
    "learning_enabled": True,
    "reflection_enabled": True,
    "temperature": 0.7,
}

_CHOICES = {"response_length": {"short", "medium", "long"}}
_RANGES = {"question_frequency": (0, 100), "temperature": (0.0, 1.5)}


class SettingsError(ValueError):
    pass


def validate(key: str, value: Any) -> Any:
    if key not in DEFAULTS:
        raise SettingsError(f"unknown setting: {key}")
    default = DEFAULTS[key]
    if isinstance(default, bool):
        if not isinstance(value, bool):
            raise SettingsError(f"{key} must be true or false")
        return value
    if isinstance(default, (int, float)):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise SettingsError(f"{key} must be a number")
        lo, hi = _RANGES.get(key, (float("-inf"), float("inf")))
        if not lo <= value <= hi:
            raise SettingsError(f"{key} must be between {lo} and {hi}")
        return type(default)(value) if isinstance(default, float) else value
    if not isinstance(value, str):
        raise SettingsError(f"{key} must be text")
    value = value.strip()[:120]
    if key in _CHOICES and value not in _CHOICES[key]:
        raise SettingsError(f"{key} must be one of {sorted(_CHOICES[key])}")
    return value


def get_all(s: Session) -> dict[str, Any]:
    stored = {row.key: row.value for row in s.scalars(select(Setting))}
    return {k: stored.get(k, v) for k, v in DEFAULTS.items()}


def get(s: Session, key: str) -> Any:
    row = s.get(Setting, key)
    return row.value if row is not None else DEFAULTS[key]


def update(s: Session, changes: dict[str, Any]) -> dict[str, Any]:
    cleaned = {k: validate(k, v) for k, v in changes.items()}  # validate all before writing any
    for key, value in cleaned.items():
        row = s.get(Setting, key)
        if row is None:
            s.add(Setting(key=key, value=value))
        else:
            row.value = value
    s.flush()
    return get_all(s)
