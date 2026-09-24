"""Knowledge engine: facts with provenance, and an entity/relationship graph around the user.

Example graph:
    User --likes--> Fishing
    User --owns--> Boat "Sea Breeze" --moored_at--> Marina
    User --wants_to--> Learn Programming
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from genesis.db.models import Entity, KnowledgeItem, KnowledgeLink
from genesis.logging_setup import log_event
from genesis.safety.guard import detect_injection, sanitize

USER_KEY = "user"
ENTITY_TYPES = {"user", "person", "pet", "place", "thing", "activity", "organisation", "concept", "goal", "event"}


def normalize(name: str) -> str:
    n = re.sub(r"\s+", " ", re.sub(r"[^\w\s'-]", "", name.lower())).strip()
    n = re.sub(r"^(the|a|an|my) ", "", n)
    return n[:120]


def normalize_relation(rel: str) -> str:
    rel = re.sub(r"[^a-z_ ]", "", rel.lower()).strip().replace(" ", "_")
    return rel[:64] or "related_to"


class KnowledgeEngine:
    def user_entity(self, s: Session, display_name: str | None = None) -> Entity:
        e = s.scalars(select(Entity).where(Entity.normalized_name == USER_KEY, Entity.entity_type == "user")).first()
        if e is None:
            e = Entity(
                name=display_name or "User", normalized_name=USER_KEY, entity_type="user", description="The person Genesis lives with."
            )
            s.add(e)
            s.flush()
        elif display_name and e.name != display_name:
            e.name = display_name
        return e

    def entity(self, s: Session, name: str, entity_type: str = "thing") -> Entity | None:
        clean = sanitize(name, 120)
        norm = normalize(clean)
        if not norm or detect_injection(clean):
            return None
        if norm in {"user", "i", "me", "myself"}:
            return self.user_entity(s)
        entity_type = entity_type if entity_type in ENTITY_TYPES else "thing"
        e = s.scalars(select(Entity).where(Entity.normalized_name == norm).order_by(Entity.mention_count.desc())).first()
        if e is None:
            e = Entity(name=clean[:120], normalized_name=norm, entity_type=entity_type)
            s.add(e)
            s.flush()
        else:
            e.mention_count += 1
            if e.entity_type == "thing" and entity_type != "thing":
                e.entity_type = entity_type
        return e

    def relate(self, s: Session, subject: Entity, relation: str, obj: Entity, confidence: float = 0.7) -> KnowledgeLink | None:
        if subject.id == obj.id:
            return None
        rel = normalize_relation(relation)
        link = s.scalars(
            select(KnowledgeLink).where(
                KnowledgeLink.source_id == subject.id, KnowledgeLink.target_id == obj.id, KnowledgeLink.relation == rel
            )
        ).first()
        if link is None:
            link = KnowledgeLink(source_id=subject.id, target_id=obj.id, relation=rel, confidence=confidence)
            s.add(link)
            s.flush()
            log_event("knowledge.link", subject=subject.name, relation=rel, object=obj.name)
        else:
            link.weight += 1
            link.confidence = min(1.0, max(link.confidence, confidence) + 0.05)
        return link

    def add_fact(
        self,
        s: Session,
        statement: str,
        *,
        subject: str | None = None,
        predicate: str | None = None,
        obj: str | None = None,
        subject_type: str = "thing",
        object_type: str = "thing",
        source: str = "conversation",
        confidence: float = 0.7,
        evidence: str | None = None,
        memory_id: int | None = None,
    ) -> KnowledgeItem | None:
        statement = sanitize(statement, 600)
        if len(statement) < 4 or detect_injection(statement):
            return None
        h = hashlib.sha256(normalize(statement).encode()).hexdigest()
        item = s.scalars(select(KnowledgeItem).where(KnowledgeItem.statement_hash == h)).first()
        if item is not None:
            item.confidence = min(1.0, max(item.confidence, confidence) + 0.05)
            if evidence and evidence not in (item.evidence or []):
                item.evidence = [*(item.evidence or []), evidence[:300]][-10:]
            return item
        subj_e = self.entity(s, subject, subject_type) if subject else None
        obj_e = self.entity(s, obj, object_type) if obj else None
        rel = normalize_relation(predicate) if predicate else None
        if subj_e and obj_e and rel:
            self.relate(s, subj_e, rel, obj_e, confidence)
        item = KnowledgeItem(
            statement=statement,
            statement_hash=h,
            subject_id=subj_e.id if subj_e else None,
            predicate=rel,
            object_id=obj_e.id if obj_e else None,
            source=source,
            confidence=max(0.0, min(1.0, confidence)),
            evidence=[evidence[:300]] if evidence else [],
            memory_id=memory_id,
        )
        s.add(item)
        s.flush()
        log_event("knowledge.fact", item_id=item.id, source=source)
        return item

    def facts_about(self, s: Session, text: str, limit: int = 8) -> list[str]:
        """Graph-RAG: statements about any entity mentioned in the text."""
        low = f" {normalize(text)} "
        entities = [
            e
            for e in s.scalars(select(Entity).where(Entity.entity_type != "user").order_by(Entity.mention_count.desc()).limit(400))
            if len(e.normalized_name) >= 3 and f" {e.normalized_name} " in low
        ]
        if not entities:
            return []
        ids = [e.id for e in entities]
        links = s.scalars(
            select(KnowledgeLink)
            .where(or_(KnowledgeLink.source_id.in_(ids), KnowledgeLink.target_id.in_(ids)))
            .order_by(KnowledgeLink.weight.desc())
            .limit(limit)
        ).all()
        names = {
            e.id: e.name
            for e in s.scalars(select(Entity).where(Entity.id.in_({l.source_id for l in links} | {l.target_id for l in links})))
        }
        out = [f"{names.get(l.source_id, '?')} {l.relation.replace('_', ' ')} {names.get(l.target_id, '?')}" for l in links]
        items = s.scalars(
            select(KnowledgeItem)
            .where(or_(KnowledgeItem.subject_id.in_(ids), KnowledgeItem.object_id.in_(ids)))
            .order_by(KnowledgeItem.confidence.desc())
            .limit(limit)
        ).all()
        for it in items:
            it.retrieval_count += 1
            if it.statement not in out:
                out.append(it.statement)
        return out[:limit]

    def search(self, s: Session, query: str, limit: int = 20) -> list[KnowledgeItem]:
        words = [w for w in re.findall(r"[a-z0-9]{3,}", query.lower())][:8]
        if not words:
            return []
        conds = [func.lower(KnowledgeItem.statement).contains(w) for w in words]
        return list(s.scalars(select(KnowledgeItem).where(or_(*conds)).order_by(KnowledgeItem.confidence.desc()).limit(limit)))

    def items(self, s: Session, limit: int = 100) -> list[KnowledgeItem]:
        return list(s.scalars(select(KnowledgeItem).order_by(KnowledgeItem.id.desc()).limit(limit)))

    def graph(self, s: Session, limit: int = 300) -> dict[str, Any]:
        links = s.scalars(select(KnowledgeLink).order_by(KnowledgeLink.weight.desc()).limit(limit)).all()
        ids = {l.source_id for l in links} | {l.target_id for l in links}
        ents = s.scalars(select(Entity).where(Entity.id.in_(ids))).all() if ids else []
        degree: dict[int, int] = {}
        for l in links:
            degree[l.source_id] = degree.get(l.source_id, 0) + l.weight
            degree[l.target_id] = degree.get(l.target_id, 0) + l.weight
        return {
            "nodes": [{"id": e.id, "label": e.name, "type": e.entity_type, "weight": degree.get(e.id, 0) + e.mention_count} for e in ents],
            "edges": [
                {"source": l.source_id, "target": l.target_id, "relation": l.relation, "confidence": round(l.confidence, 2)} for l in links
            ],
        }
