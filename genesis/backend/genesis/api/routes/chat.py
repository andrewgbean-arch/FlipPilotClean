from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from starlette.background import BackgroundTask

from genesis.api import serializers as ser
from genesis.api.deps import get_svc, not_found
from genesis.api.schemas import ChatRequest
from genesis.db.models import Conversation, Message
from genesis.services import Services

router = APIRouter(tags=["chat"])


@router.post("/chat")
def chat(body: ChatRequest, background: BackgroundTasks, svc: Services = Depends(get_svc)):
    try:
        resp = svc.conversation.chat(body.message, body.conversation_id, learn=False)
    except KeyError as e:
        raise not_found("conversation") from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    # Learning runs after the reply is sent, so it never slows the conversation down.
    user_msg_id = _user_message_before(svc, resp["message_id"])
    if user_msg_id:
        background.add_task(svc.conversation.learn, user_msg_id)
    return resp


@router.post("/chat/stream")
def chat_stream(body: ChatRequest, svc: Services = Depends(get_svc)):
    try:
        with svc.db.session() as s:
            turn = svc.conversation.prepare(s, body.message, body.conversation_id)
    except KeyError as e:
        raise not_found("conversation") from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    def events():
        try:
            for event, data in svc.conversation.stream(turn):
                yield f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
        except Exception as e:  # surface failures to the client instead of a silent broken stream
            yield f"event: error\ndata: {json.dumps({'detail': type(e).__name__})}\n\n"
            raise

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        background=BackgroundTask(svc.conversation.learn, turn.user_message_id),
    )


@router.post("/chat/greeting")
def greeting(svc: Services = Depends(get_svc)):
    return svc.conversation.greeting()


@router.get("/conversations")
def conversations(limit: int = 100, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        rows = s.scalars(
            select(Conversation).where(Conversation.message_count > 0).order_by(Conversation.last_message_at.desc()).limit(min(limit, 500))
        ).all()
        return [ser.conversation(c) for c in rows]


@router.get("/conversations/{conversation_id}")
def conversation(conversation_id: int, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        c = s.get(Conversation, conversation_id)
        if c is None:
            raise not_found("conversation")
        msgs = s.scalars(
            select(Message).where(Message.conversation_id == c.id, Message.role.in_(("user", "assistant"))).order_by(Message.id)
        ).all()
        return {**ser.conversation(c), "messages": [ser.message(m) for m in msgs]}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, svc: Services = Depends(get_svc)):
    """Deletes the transcript. Memories already learned from it are kept (delete them individually)."""
    with svc.db.session() as s:
        c = s.get(Conversation, conversation_id)
        if c is None:
            raise not_found("conversation")
        s.delete(c)
    return {"deleted": True}


def _user_message_before(svc: Services, assistant_message_id: int) -> int | None:
    with svc.db.session() as s:
        a = s.get(Message, assistant_message_id)
        if a is None:
            return None
        return s.scalars(
            select(Message.id)
            .where(Message.conversation_id == a.conversation_id, Message.id < a.id, Message.role == "user")
            .order_by(Message.id.desc())
            .limit(1)
        ).first()
