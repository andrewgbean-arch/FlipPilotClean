"""Voice (Whisper / Piper) and vision endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from genesis.api.deps import get_svc
from genesis.api.schemas import SpeakRequest
from genesis.services import Services
from genesis.vision.engine import MAX_IMAGE_BYTES, VisionUnavailable
from genesis.voice.engine import VoiceUnavailable

router = APIRouter(tags=["media"])

MAX_AUDIO_BYTES = 25 * 1024 * 1024


@router.get("/voice/status")
def voice_status(svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        voice = svc.settings(s).get("tts_voice") or None
    return {"stt": svc.stt.status(), "tts": svc.tts.status(voice)}


@router.post("/voice/transcribe")
async def transcribe(audio: UploadFile = File(...), svc: Services = Depends(get_svc)):
    data = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "audio too large")
    if not data:
        raise HTTPException(400, "empty audio")
    ctype = (audio.content_type or "").lower()
    suffix = ".wav" if "wav" in ctype else ".ogg" if "ogg" in ctype else ".mp4" if "mp4" in ctype else ".webm"
    try:
        return await run_in_threadpool(svc.stt.transcribe, data, suffix)
    except VoiceUnavailable as e:
        raise HTTPException(503, str(e)) from e


@router.post("/voice/speak")
def speak(body: SpeakRequest, svc: Services = Depends(get_svc)):
    with svc.db.session() as s:
        voice = body.voice or svc.settings(s).get("tts_voice") or None
    try:
        wav = svc.tts.speak(body.text, voice)
    except VoiceUnavailable as e:
        raise HTTPException(503, str(e)) from e
    return Response(content=wav, media_type="audio/wav")


@router.post("/vision/analyze")
async def analyze(
    image: UploadFile = File(...),
    prompt: str | None = Form(None),
    remember: str = Form("false"),
    task: str = Form("describe"),
    svc: Services = Depends(get_svc),
):
    data = await image.read(MAX_IMAGE_BYTES + 1)
    try:
        return await run_in_threadpool(svc.vision.analyze, data, prompt, remember=remember.lower() == "true", task=task)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    except VisionUnavailable as e:
        raise HTTPException(503, str(e)) from e
