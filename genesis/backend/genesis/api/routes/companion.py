"""Emotions, personality, relationship and the user profile."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from genesis import settings_store
from genesis.api.deps import get_svc
from genesis.api.schemas import ProfileUpdate
from genesis.emotion.engine import dominant
from genesis.services import Services
from genesis.timeutil import iso

router = APIRouter(tags=["companion"])


@router.get("/emotions")
def emotions(limit: int = 50, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        current = svc.emotion.current(s)
        history = [
            {"timestamp": iso(h.created_at), "values": h.values, "trigger": h.trigger} for h in svc.emotion.history(s, min(limit, 500))
        ]
        return {"current": current, "mood": dominant(current), "history": history}


def _personality(s, svc: Services) -> dict[str, Any]:
    traits = svc.personality.traits(s)
    profile = svc.personality.profile(s)
    profile["question_frequency"] = settings_store.get(s, "question_frequency")
    profile["curiosity_level"] = round(traits["curiosity"].value) if "curiosity" in traits else None
    return {
        "traits": [
            {"name": t.name, "value": round(t.value, 2), "baseline": t.baseline, "description": t.description} for t in traits.values()
        ],
        "profile": profile,
    }


@router.get("/personality")
def personality(svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        return _personality(s, svc)


@router.put("/personality/profile")
def update_personality_profile(changes: dict[str, Any] = Body(...), svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        if "question_frequency" in changes:
            try:
                settings_store.update(s, {"question_frequency": changes.pop("question_frequency")})
            except settings_store.SettingsError as e:
                raise HTTPException(422, str(e)) from e
        changes.pop("curiosity_level", None)  # derived from the curiosity trait; not directly editable
        try:
            svc.personality.update_profile(s, changes)
        except (TypeError, ValueError) as e:
            raise HTTPException(422, str(e)) from e
        return _personality(s, svc)


@router.get("/relationship")
def relationship(svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        r = svc.relationship.get(s)
        view = svc.relationship.view(r)
        return {
            "level": view.level,
            "score": view.score,
            "trust": round(r.trust, 1),
            "familiarity": round(r.familiarity, 1),
            "interaction_count": r.interaction_count,
            "shared_experiences": r.shared_experiences,
            "conversation_depth": round(r.conversation_depth, 1),
            "support_level": round(r.support_level, 1),
            "days_active": r.days_active,
            "shared_interests": [i.name for i in svc.profile.interests(s, limit=10)],
            "next_level": view.next_level,
            "progress_to_next": view.progress_to_next,
        }


def _profile(s, svc: Services) -> dict[str, Any]:
    return {
        "fields": {
            k: {"value": f.value, "confidence": round(f.confidence, 2), "source": f.source, "updated_at": iso(f.updated_at)}
            for k, f in svc.profile.fields(s).items()
        },
        "interests": [
            {
                "name": i.name,
                "category": i.category,
                "strength": round(i.strength, 1),
                "mention_count": i.mention_count,
                "last_mentioned": iso(i.last_mentioned),
            }
            for i in svc.profile.interests(s)
        ],
    }


@router.get("/profile")
def profile(svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        return _profile(s, svc)


@router.put("/profile")
def update_profile(body: ProfileUpdate, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        if not body.value.strip():
            row = svc.profile.fields(s).get(body.field)
            if row is not None:
                s.delete(row)
                s.flush()
            return _profile(s, svc)
        change = svc.profile.set_field(s, body.field, body.value, confidence=1.0, source="user_manual")
        if change.outcome == "rejected":
            raise HTTPException(422, f"invalid value for {body.field}")
        if change.field == "name":
            svc.knowledge.user_entity(s, change.value)
        return _profile(s, svc)
