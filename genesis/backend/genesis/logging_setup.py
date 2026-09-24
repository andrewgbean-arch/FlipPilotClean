"""Structured JSON logging.

Every log line is one JSON object. Domain events (memory creation, retrieval,
goal updates, tool executions, reflections) go through `log_event` so they share
an `event` key and can be filtered with jq:

    uvicorn ... | jq 'select(.event == "memory.created")'
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

_RESERVED = set(vars(logging.makeLogRecord({})).keys()) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def setup_logging(level: str = "INFO", as_json: bool = True) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if as_json else logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    for noisy in ("httpx", "httpcore", "chromadb", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


_events = logging.getLogger("genesis.events")


def log_event(event: str, **fields: Any) -> None:
    """Log a domain event. Never raises: logging must not break the companion."""
    safe = {(f"{k}_" if k in _RESERVED else k): v for k, v in fields.items()}
    try:
        _events.info(event, extra={"event": event, **safe})
    except Exception:  # pragma: no cover - defensive
        logging.getLogger(__name__).exception("failed to log event %s", event)
