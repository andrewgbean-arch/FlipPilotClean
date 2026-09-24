from __future__ import annotations

from datetime import UTC, datetime


def utcnow() -> datetime:
    """Naive UTC now. The database stores naive UTC; the API adds the Z suffix."""
    return datetime.now(UTC).replace(tzinfo=None)


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(UTC).replace(tzinfo=None)
    return dt.isoformat(timespec="seconds") + "Z"


def humanize_ago(dt: datetime, now: datetime | None = None) -> str:
    """'earlier today', 'yesterday', '3 days ago', 'last week', ..."""
    now = now or utcnow()
    delta = now - dt
    days = delta.days
    if delta.total_seconds() < 3600:
        return "a little while ago"
    if days == 0 and dt.date() == now.date():
        return "earlier today"
    if days <= 1 and (now.date() - dt.date()).days == 1:
        return "yesterday"
    if days < 7:
        return f"{max(days, 2)} days ago"
    if days < 14:
        return "last week"
    if days < 31:
        return f"{days // 7} weeks ago"
    if days < 60:
        return "last month"
    if days < 365:
        return f"{days // 30} months ago"
    return "over a year ago" if days < 730 else f"{days // 365} years ago"
