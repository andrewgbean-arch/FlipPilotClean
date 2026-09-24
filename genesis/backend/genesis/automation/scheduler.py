"""Automation engine: periodic background jobs on a single daemon thread.

Job state is persisted in automation_runs, so a restart doesn't re-run everything,
and every job holds a non-blocking lock so a slow run can't pile up on itself.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import TYPE_CHECKING

from sqlalchemy import delete, func, select

from genesis.automation import proactive
from genesis.db.models import AutomationRun, Conversation
from genesis.logging_setup import log_event
from genesis.reflection.engine import period_bounds
from genesis.safety.guard import ReentrancyLock
from genesis.timeutil import utcnow

if TYPE_CHECKING:
    from genesis.services import Services

log = logging.getLogger(__name__)


@dataclass
class Job:
    name: str
    interval_seconds: int
    fn: Callable[[Services], str]
    description: str


def _reindex(svc: Services) -> str:
    with svc.db.session() as s:
        r = svc.memory.reindex(s)
    return f"indexed {r['indexed']}, removed {r['orphans_removed']} orphans, {r['pending']} pending"


def _consolidate(svc: Services) -> str:
    with svc.db.session() as s:
        r = svc.consolidator.run(s, use_llm=svc.llm.available())
        n = svc.profile.decay_interests(s)
    return f"{r}; {n} interests decayed"


def _proactive(svc: Services) -> str:
    with svc.db.session() as s:
        n = proactive.generate(s, svc)
    return f"queued {n}"


def _reflect(svc: Services) -> str:
    with svc.db.session() as s:
        settings = svc.settings(s)
        if not (settings.get("reflection_enabled") and settings.get("autonomy_enabled")):
            return "skipped: disabled"
        name, user = settings.get("companion_name") or "Genesis", svc.profile.display_name(s, settings.get("user_name") or "the user")
        r = svc.reflection.reflect(s, companion_name=name, user_name=user, use_llm=svc.llm.available())
    return f"reflection {r.id}"


def _journal(svc: Services) -> str:
    now = utcnow()
    written = []
    anchors = {"daily": now - timedelta(days=1), "weekly": now - timedelta(days=7), "monthly": now.replace(day=1) - timedelta(days=1)}
    with svc.db.session() as s:
        settings = svc.settings(s)
        name, user = settings.get("companion_name") or "Genesis", svc.profile.display_name(s, settings.get("user_name") or "the user")
        for period, anchor in anchors.items():
            start, end = period_bounds(period, anchor)
            if svc.reflection.journal_exists(s, period, start):
                continue
            active = s.scalar(
                select(func.count(Conversation.id)).where(Conversation.last_message_at >= start, Conversation.started_at < end)
            )
            if not active:
                continue
            svc.reflection.journal(s, period, anchor=anchor, companion_name=name, user_name=user, use_llm=svc.llm.available())
            written.append(period)
    return "wrote " + (", ".join(written) or "nothing")


def _backup(svc: Services) -> str:
    if not svc.config.db_url.startswith("sqlite") or ":memory:" in svc.config.db_url:
        return "skipped: not a file database"
    dest = svc.config.backups_dir / f"genesis-{utcnow().strftime('%Y%m%d-%H%M%S')}.db"
    svc.db.backup(dest)
    backups = sorted(svc.config.backups_dir.glob("genesis-*.db"))
    for old in backups[:-7]:
        old.unlink(missing_ok=True)
    return f"saved {dest.name}"


def _integrity(svc: Services) -> str:
    result = svc.db.integrity_check()
    with svc.db.session() as s:
        s.execute(delete(AutomationRun).where(AutomationRun.started_at < utcnow() - timedelta(days=30)))
        r = svc.memory.reindex(s)
    if result != "ok":
        log.error("database integrity check failed: %s", result)
    return f"integrity {result}; vector orphans removed {r['orphans_removed']}"


JOBS: list[Job] = [
    Job("reindex", 600, _reindex, "Embed memories missing from the vector index and repair broken links"),
    Job("proactive", 1800, _proactive, "Queue goal follow-ups, reminders and reconnect messages"),
    Job("consolidate", 3600, _consolidate, "Summarise conversations, merge duplicates, promote and prune memories"),
    Job("journal", 21600, _journal, "Write daily, weekly and monthly journal entries"),
    Job("reflect", 86400, _reflect, "Self-reflection: insights and questions for later"),
    Job("backup", 86400, _backup, "Back up the SQLite database (keeps the last 7)"),
    Job("integrity", 86400, _integrity, "Database integrity check and cleanup"),
]


class Scheduler:
    TICK_SECONDS = 30

    def __init__(self, svc: Services):
        self.svc = svc
        self.jobs = {j.name: j for j in JOBS}
        self._locks = ReentrancyLock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    @property
    def running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def start(self) -> None:
        if self.running:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="genesis-scheduler", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def _loop(self) -> None:
        self._stop.wait(10)  # let the app finish starting
        while not self._stop.is_set():
            for job in self.jobs.values():
                if self._stop.is_set():
                    break
                if self._due(job):
                    self.run(job.name)
            self._stop.wait(self.TICK_SECONDS)

    def _last_run(self, name: str) -> AutomationRun | None:
        with self.svc.db.session() as s:
            return s.scalars(select(AutomationRun).where(AutomationRun.job == name).order_by(AutomationRun.id.desc()).limit(1)).first()

    def _due(self, job: Job) -> bool:
        last = self._last_run(job.name)
        return last is None or (utcnow() - last.started_at).total_seconds() >= job.interval_seconds

    def run(self, name: str) -> dict[str, str]:
        job = self.jobs.get(name)
        if job is None:
            raise KeyError(name)
        if not self._locks.acquire(name):
            return {"job": name, "status": "skipped", "detail": "already running"}
        started, t0 = utcnow(), time.perf_counter()
        try:
            detail, status = job.fn(self.svc), "ok"
        except Exception as e:
            log.exception("job %s failed", name)
            detail, status = f"{type(e).__name__}: {e}"[:500], "error"
        finally:
            self._locks.release(name)
        duration = round((time.perf_counter() - t0) * 1000, 1)
        with self.svc.db.session() as s:
            s.add(AutomationRun(job=name, status=status, detail=detail[:2000], started_at=started, duration_ms=duration))
        log_event("automation.job", job=name, status=status, duration_ms=duration)
        return {"job": name, "status": status, "detail": detail}

    def describe(self) -> list[dict]:
        out = []
        for job in self.jobs.values():
            last = self._last_run(job.name)
            out.append(
                {
                    "name": job.name,
                    "description": job.description,
                    "interval_seconds": job.interval_seconds,
                    "last_run": last.started_at if last else None,
                    "last_status": last.status if last else None,
                    "last_detail": last.detail if last else None,
                }
            )
        return out
