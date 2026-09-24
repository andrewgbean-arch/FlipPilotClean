from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from genesis.api import serializers as ser
from genesis.api.deps import get_svc, not_found
from genesis.api.schemas import GoalCreate, GoalUpdateRequest
from genesis.db.models import Goal
from genesis.services import Services

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("")
def list_goals(status: str | None = None, owner: str | None = None, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        return [ser.goal(g) for g in svc.goals.list(s, status=status, owner=owner)]


@router.post("")
def create_goal(body: GoalCreate, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        try:
            g, _ = svc.goals.create(
                s,
                body.title,
                description=body.description,
                goal_type=body.goal_type,
                horizon=body.horizon,
                owner=body.owner,
                follow_up_interval_days=body.follow_up_interval_days,
                source="user",
            )
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        svc.refresh_companion_goals(s)
        return ser.goal(g)


@router.get("/{goal_id}")
def get_goal(goal_id: int, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        g = s.get(Goal, goal_id)
        if g is None:
            raise not_found("goal")
        return {**ser.goal(g), "updates": [ser.goal_update(u) for u in g.updates]}


@router.post("/update")
def update_goal(body: GoalUpdateRequest, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        try:
            g, just_completed = svc.goals.update(s, body.goal_id, status=body.status, progress=body.progress, note=body.note, source="user")
        except KeyError as e:
            raise not_found("goal") from e
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        if just_completed and g.owner == "user":
            svc.learning.on_goal_completed(s, g.title)
        return ser.goal(g)
