"""Document ingestion: uploaded text becomes searchable semantic memory (with provenance)."""

from __future__ import annotations

import hashlib
import io
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from genesis.db.models import Document
from genesis.logging_setup import log_event
from genesis.memory.engine import MemoryEngine, MemoryRejected

MAX_DOC_BYTES = 5 * 1024 * 1024
CHUNK_CHARS = 900


def extract_text(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError as e:
            raise ValueError("PDF support needs pypdf (pip install pypdf)") from e
        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join((p.extract_text() or "") for p in reader.pages)
    if not name.endswith((".txt", ".md", ".markdown", ".csv", ".json", ".log")):
        raise ValueError("supported formats: .txt, .md, .csv, .json, .log, .pdf")
    if b"\x00" in data[:4096]:
        raise ValueError("binary files aren't supported")
    return data.decode("utf-8", errors="replace")


def chunk(text: str, size: int = CHUNK_CHARS) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    cur = ""
    for p in paras:
        while len(p) > size:
            cut = p.rfind(". ", 0, size)
            cut = cut + 1 if cut > size // 2 else size
            if cur:
                chunks.append(cur)
                cur = ""
            chunks.append(p[:cut].strip())
            p = p[cut:].strip()
        if len(cur) + len(p) + 2 > size and cur:
            chunks.append(cur)
            cur = p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        chunks.append(cur)
    return chunks


def ingest(s: Session, memory: MemoryEngine, filename: str, data: bytes) -> dict[str, Any]:
    if len(data) > MAX_DOC_BYTES:
        raise ValueError("file too large (5 MB limit)")
    h = hashlib.sha256(data).hexdigest()
    existing = s.scalars(select(Document).where(Document.content_hash == h)).first()
    if existing:
        return {"document": existing.filename, "chunks": existing.chunks, "memories_created": 0, "duplicate": True}
    text = extract_text(filename, data)
    parts = chunk(text)
    created = 0
    safe_name = re.sub(r"[^\w .-]", "_", filename)[:120]
    for i, part in enumerate(parts, 1):
        try:
            _, new = memory.add(
                s,
                part,
                title=f"{safe_name} (part {i}/{len(parts)})",
                memory_type="semantic",
                category="knowledge",
                importance="medium",
                confidence=0.6,
                source="document",
                source_ref=f"document:{safe_name}#{i}",
                tags=["document", safe_name.lower()[:40]],
                tier="long",
            )
            created += int(new)
        except MemoryRejected:
            continue  # e.g. a chunk containing instructions or secrets is skipped, not stored
    doc = Document(filename=safe_name, content_hash=h, chunks=len(parts))
    s.add(doc)
    s.flush()
    log_event("document.ingested", filename=safe_name, chunks=len(parts), memories=created)
    return {"document": safe_name, "chunks": len(parts), "memories_created": created, "duplicate": False}
