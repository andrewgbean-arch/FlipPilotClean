"""Vector index over memories. SQLite stays the source of truth; this is rebuildable."""

from __future__ import annotations

import logging
import math
import re
import threading
from pathlib import Path
from typing import Protocol

log = logging.getLogger(__name__)


class VectorStore(Protocol):
    backend: str

    def upsert(self, ids: list[int], embeddings: list[list[float]], metadatas: list[dict]) -> None: ...

    def query(self, embedding: list[float], k: int, where: dict | None = None) -> list[tuple[int, float]]:
        """Returns (memory_id, cosine_similarity) pairs, best first."""
        ...

    def delete(self, ids: list[int]) -> None: ...

    def ids(self) -> set[int]: ...

    def count(self) -> int: ...


class InMemoryVectorStore:
    backend = "memory"

    def __init__(self) -> None:
        self._vecs: dict[int, list[float]] = {}
        self._meta: dict[int, dict] = {}
        self._lock = threading.Lock()

    def upsert(self, ids, embeddings, metadatas) -> None:
        with self._lock:
            for i, e, m in zip(ids, embeddings, metadatas, strict=True):
                self._vecs[i] = e
                self._meta[i] = m

    def query(self, embedding, k, where=None):
        with self._lock:
            scored = [
                (i, _cosine(embedding, v))
                for i, v in self._vecs.items()
                if not where or all(self._meta[i].get(key) == val for key, val in where.items())
            ]
        scored.sort(key=lambda t: t[1], reverse=True)
        return scored[:k]

    def delete(self, ids) -> None:
        with self._lock:
            for i in ids:
                self._vecs.pop(i, None)
                self._meta.pop(i, None)

    def ids(self) -> set[int]:
        return set(self._vecs)

    def count(self) -> int:
        return len(self._vecs)


class ChromaVectorStore:
    """Persistent ChromaDB collection. One collection per embedding model, so switching models never mixes vector spaces."""

    backend = "chroma"

    def __init__(self, path: Path, embed_model: str):
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        path.mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(path=str(path), settings=ChromaSettings(anonymized_telemetry=False))
        name = "memories_" + re.sub(r"[^a-zA-Z0-9_-]", "_", embed_model)[:40]
        self._col = self._client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})

    def upsert(self, ids, embeddings, metadatas) -> None:
        if ids:
            self._col.upsert(ids=[str(i) for i in ids], embeddings=embeddings, metadatas=metadatas)

    def query(self, embedding, k, where=None):
        n = self.count()
        if n == 0:
            return []
        res = self._col.query(query_embeddings=[embedding], n_results=min(k, n), where=where or None)
        ids = res.get("ids", [[]])[0]
        dists = res.get("distances", [[]])[0]
        return [(int(i), 1.0 - float(d)) for i, d in zip(ids, dists, strict=False)]

    def delete(self, ids) -> None:
        if ids:
            self._col.delete(ids=[str(i) for i in ids])

    def ids(self) -> set[int]:
        return {int(i) for i in self._col.get(include=[]).get("ids", [])}

    def count(self) -> int:
        return self._col.count()


def make_vector_store(backend: str, path: Path, embed_model: str) -> VectorStore:
    if backend == "chroma":
        try:
            return ChromaVectorStore(path, embed_model)
        except Exception:
            log.exception("ChromaDB unavailable, using in-memory vector store (rebuilt from SQLite at startup)")
    return InMemoryVectorStore()


def _cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0
