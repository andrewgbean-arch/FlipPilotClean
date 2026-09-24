"""Tool engine: a registry of validated, logged, sandboxed tools the companion can call.

Every call is validated against a pydantic model before running, capped per turn,
timed and written to tool_logs. Tool output is treated as untrusted data by the
conversation engine.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any

import httpx
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from genesis.db.models import Note, Task, ToolLog
from genesis.logging_setup import log_event
from genesis.safety.guard import detect_injection, sanitize
from genesis.timeutil import iso, utcnow

if TYPE_CHECKING:
    from genesis.services import Services

log = logging.getLogger(__name__)

MAX_RESULT_CHARS = 4000
MAX_FILE_BYTES = 256 * 1024


class ToolError(RuntimeError):
    pass


@dataclass
class Tool:
    name: str
    description: str
    params: type[BaseModel]
    handler: Callable[[Session, Services, Any], str]
    enabled: Callable[[Services], bool] = lambda _svc: True

    def schema(self) -> dict[str, Any]:
        params = self.params.model_json_schema()
        params.pop("title", None)
        return {"type": "function", "function": {"name": self.name, "description": self.description, "parameters": params}}


# ----------------------------------------------------------------------------- parameter models


class RememberArgs(BaseModel):
    fact: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description="The fact to remember, in the third person, e.g. 'The user's boat is called Sea Breeze'.",
    )
    importance: str = Field("high", pattern="^(low|medium|high|critical)$")


class QueryArgs(BaseModel):
    query: str = Field(..., min_length=1, max_length=300)
    limit: int = Field(5, ge=1, le=20)


class NoteArgs(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field("", max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=10)


class TaskArgs(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    due_at: str | None = Field(None, description="ISO 8601 date-time in UTC, e.g. 2026-09-25T09:00:00")


class ListTasksArgs(BaseModel):
    include_done: bool = False


class TaskIdArgs(BaseModel):
    task_id: int = Field(..., ge=1)


class ReadFileArgs(BaseModel):
    path: str = Field(..., min_length=1, max_length=500, description="Path of a text file inside the allowed folders.")


class NoArgs(BaseModel):
    pass


# ----------------------------------------------------------------------------- handlers


def _remember(s: Session, svc: Services, a: RememberArgs) -> str:
    from genesis.memory.engine import MemoryRejected

    try:
        m, created = svc.memory.add(
            s,
            a.fact,
            memory_type="personal",
            category="knowledge",
            importance=a.importance,
            confidence=0.9,
            source="user",
            tags=["explicit"],
        )
    except MemoryRejected as e:
        return f"Not stored ({e.reason})."
    return f"{'Remembered' if created else 'Already knew'}: {m.content}"


def _search_memory(s: Session, svc: Services, a: QueryArgs) -> str:
    hits = svc.memory.search(s, a.query, k=a.limit)
    if not hits:
        return "No matching memories."
    return "\n".join(f"- ({h.memory.created_at.date()}) {h.memory.content}" for h in hits)


def _create_note(s: Session, svc: Services, a: NoteArgs) -> str:
    n = Note(title=sanitize(a.title, 200), body=sanitize(a.body, 5000), tags=[t[:40] for t in a.tags])
    s.add(n)
    s.flush()
    return f"Saved note #{n.id}: {n.title}"


def _search_notes(s: Session, svc: Services, a: QueryArgs) -> str:
    q = f"%{a.query.lower()}%"
    rows = s.scalars(select(Note).where(or_(Note.title.ilike(q), Note.body.ilike(q))).order_by(Note.updated_at.desc()).limit(a.limit)).all()
    if not rows:
        return "No matching notes."
    return "\n".join(f"- #{n.id} {n.title}: {n.body[:200]}" for n in rows)


def _create_task(s: Session, svc: Services, a: TaskArgs) -> str:
    due = None
    if a.due_at:
        try:
            due = datetime.fromisoformat(a.due_at.replace("Z", "+00:00"))
            if due.tzinfo:
                due = due.astimezone(UTC).replace(tzinfo=None)
        except ValueError as e:
            raise ToolError("due_at must be ISO 8601, e.g. 2026-09-25T09:00:00") from e
    t = Task(title=sanitize(a.title, 200), due_at=due)
    s.add(t)
    s.flush()
    return f"Task #{t.id} created: {t.title}" + (f" (due {iso(due)})" if due else "")


def _list_tasks(s: Session, svc: Services, a: ListTasksArgs) -> str:
    q = select(Task).order_by(Task.done, Task.due_at.is_(None), Task.due_at, Task.id)
    if not a.include_done:
        q = q.where(Task.done.is_(False))
    rows = s.scalars(q.limit(50)).all()
    if not rows:
        return "No tasks."
    return "\n".join(f"- #{t.id} [{'x' if t.done else ' '}] {t.title}" + (f" (due {iso(t.due_at)})" if t.due_at else "") for t in rows)


def _complete_task(s: Session, svc: Services, a: TaskIdArgs) -> str:
    t = s.get(Task, a.task_id)
    if t is None:
        raise ToolError(f"No task #{a.task_id}")
    t.done = True
    return f"Completed task #{t.id}: {t.title}"


def allowed_roots(svc: Services) -> list[Path]:
    return [p.resolve() for p in [svc.config.files_dir, *svc.config.file_tool_roots]]


def _read_file(s: Session, svc: Services, a: ReadFileArgs) -> str:
    roots = allowed_roots(svc)
    raw = Path(a.path).expanduser()
    candidates = [raw] if raw.is_absolute() else [r / raw for r in roots]
    for cand in candidates:
        path = cand.resolve()
        if not any(path == r or r in path.parents for r in roots):
            continue  # path traversal outside the sandbox
        if not path.is_file():
            continue
        if path.stat().st_size > MAX_FILE_BYTES:
            raise ToolError("File is too large (limit 256 KB).")
        data = path.read_bytes()
        if b"\x00" in data[:4096]:
            raise ToolError("Only text files can be read.")
        return data.decode("utf-8", errors="replace")
    raise ToolError("File not found in the allowed folders: " + ", ".join(str(r) for r in roots))


def _web_search(s: Session, svc: Services, a: QueryArgs) -> str:
    url = svc.config.searxng_url
    if not url:
        raise ToolError("Web search isn't configured (set GENESIS_SEARXNG_URL).")
    r = httpx.get(f"{url.rstrip('/')}/search", params={"q": a.query, "format": "json"}, timeout=15)
    r.raise_for_status()
    results = r.json().get("results", [])[: a.limit]
    return "\n".join(f"- {x.get('title')}: {x.get('content', '')[:300]} ({x.get('url')})" for x in results) or "No results."


def _now(s: Session, svc: Services, a: NoArgs) -> str:
    return f"Current UTC time: {iso(utcnow())}"


# ----------------------------------------------------------------------------- registry


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def available(self, svc: Services) -> list[Tool]:
        return [t for t in self._tools.values() if t.enabled(svc)]

    def schemas(self, svc: Services) -> list[dict[str, Any]]:
        return [t.schema() for t in self.available(svc)]

    def execute(self, s: Session, svc: Services, name: str, arguments: dict[str, Any] | None) -> tuple[bool, str]:
        started = time.perf_counter()
        tool = self._tools.get(name)
        args = arguments if isinstance(arguments, dict) else {}
        ok, result = False, ""
        try:
            if tool is None or not tool.enabled(svc):
                raise ToolError(f"Unknown or disabled tool: {name}")
            parsed = tool.params.model_validate(args)
            for v in parsed.model_dump().values():
                if isinstance(v, str) and detect_injection(v):
                    raise ToolError("Tool arguments rejected by the safety layer.")
            result = tool.handler(s, svc, parsed)
            ok = True
        except ValidationError as e:
            result = "Invalid arguments: " + "; ".join(f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors())
        except (ToolError, httpx.HTTPError, OSError) as e:
            result = str(e)
        except Exception as e:  # never let a tool take the conversation down
            log.exception("tool %s crashed", name)
            result = f"Tool failed: {type(e).__name__}"
        result = result[:MAX_RESULT_CHARS]
        duration = (time.perf_counter() - started) * 1000
        s.add(
            ToolLog(
                tool_name=name[:64],
                arguments=json.loads(json.dumps(args, default=str)),
                ok=ok,
                result=result,
                duration_ms=round(duration, 1),
            )
        )
        s.flush()
        log_event("tool.executed", tool=name, ok=ok, duration_ms=round(duration, 1))
        return ok, result


def default_registry() -> ToolRegistry:
    reg = ToolRegistry()
    reg.register(
        Tool(
            "remember",
            "Store an important fact about the user in long-term memory when they explicitly ask you to remember something.",
            RememberArgs,
            _remember,
        )
    )
    reg.register(Tool("search_memory", "Search your long-term memory about the user.", QueryArgs, _search_memory))
    reg.register(Tool("create_note", "Save a note for the user.", NoteArgs, _create_note))
    reg.register(Tool("search_notes", "Search the user's saved notes.", QueryArgs, _search_notes))
    reg.register(
        Tool("create_task", "Create a task or reminder, optionally with a due date-time (the local calendar).", TaskArgs, _create_task)
    )
    reg.register(Tool("list_tasks", "List the user's tasks and upcoming reminders.", ListTasksArgs, _list_tasks))
    reg.register(Tool("complete_task", "Mark a task as done.", TaskIdArgs, _complete_task))
    reg.register(Tool("read_file", "Read a text file from the user's allowed folders.", ReadFileArgs, _read_file))
    reg.register(
        Tool(
            "web_search",
            "Search the web via the user's local SearXNG instance.",
            QueryArgs,
            _web_search,
            enabled=lambda svc: bool(svc.config.searxng_url),
        )
    )
    reg.register(Tool("get_time", "Get the current date and time.", NoArgs, _now))
    return reg
