"""Engine/session setup, SQLite hardening and first-run seeding."""

from __future__ import annotations

import logging
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from genesis.db.models import Base, User

log = logging.getLogger(__name__)

DEFAULT_USER_ID = 1


class Database:
    def __init__(self, url: str):
        self.url = url
        is_sqlite = url.startswith("sqlite")
        connect_args = {"check_same_thread": False, "timeout": 30} if is_sqlite else {}
        self.engine: Engine = create_engine(url, connect_args=connect_args, future=True)
        if is_sqlite:
            event.listen(self.engine, "connect", _sqlite_pragmas)
        self.SessionLocal = sessionmaker(bind=self.engine, expire_on_commit=False, autoflush=True)

    @property
    def path(self) -> str:
        return self.url.removeprefix("sqlite:///")

    def create_all(self) -> None:
        Base.metadata.create_all(self.engine)
        with self.session() as s:
            if s.get(User, DEFAULT_USER_ID) is None:
                s.add(User(id=DEFAULT_USER_ID, display_name="Friend"))

    @contextmanager
    def session(self) -> Iterator[Session]:
        s = self.SessionLocal()
        try:
            yield s
            s.commit()
        except Exception:
            s.rollback()
            raise
        finally:
            s.close()

    def healthy(self) -> bool:
        try:
            with self.engine.connect() as c:
                c.execute(text("SELECT 1"))
            return True
        except Exception:  # pragma: no cover - defensive
            log.exception("database health check failed")
            return False

    def integrity_check(self) -> str:
        with self.engine.connect() as c:
            return str(c.execute(text("PRAGMA integrity_check")).scalar())

    def backup(self, dest: Path) -> Path:
        """Online, consistent copy using SQLite's backup API (safe while the app runs)."""
        dest.parent.mkdir(parents=True, exist_ok=True)
        raw = self.engine.raw_connection()
        try:
            src = raw.driver_connection
            with sqlite3.connect(dest) as out:
                src.backup(out)
        finally:
            raw.close()
        return dest


def _sqlite_pragmas(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")  # crash-safe, readers don't block the writer
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.execute("PRAGMA busy_timeout=30000")
    cur.close()
