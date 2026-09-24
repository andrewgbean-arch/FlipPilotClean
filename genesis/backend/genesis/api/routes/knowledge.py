from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select

from genesis.api import serializers as ser
from genesis.api.deps import get_svc
from genesis.api.schemas import KnowledgeCreate
from genesis.db.models import Entity
from genesis.knowledge.documents import MAX_DOC_BYTES, ingest
from genesis.services import Services

router = APIRouter(tags=["knowledge"])


def _names(s, items) -> dict[int, str]:
    ids = {i.subject_id for i in items if i.subject_id} | {i.object_id for i in items if i.object_id}
    if not ids:
        return {}
    return {e.id: e.name for e in s.scalars(select(Entity).where(Entity.id.in_(ids)))}


@router.get("/knowledge")
def list_knowledge(limit: int = 100, q: str | None = None, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        items = svc.knowledge.search(s, q, limit=min(limit, 500)) if q else svc.knowledge.items(s, limit=min(limit, 500))
        names = _names(s, items)
        return [ser.knowledge_item(k, names) for k in items]


@router.post("/knowledge")
def add_knowledge(body: KnowledgeCreate, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        item = svc.knowledge.add_fact(
            s,
            body.statement,
            subject=body.subject,
            predicate=body.predicate,
            obj=body.object,
            subject_type="user" if (body.subject or "").lower() in {"user", "me", "i"} else "thing",
            source=body.source,
            confidence=body.confidence,
        )
        if item is None:
            raise HTTPException(422, "statement rejected")
        return ser.knowledge_item(item, _names(s, [item]))


@router.get("/knowledge/graph")
def graph(limit: int = 300, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        return svc.knowledge.graph(s, limit=min(limit, 2000))


@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), svc: Services = Depends(get_svc)):
    data = await file.read(MAX_DOC_BYTES + 1)
    try:
        with svc.db.session() as s:
            return ingest(s, svc.memory, file.filename or "document.txt", data)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
