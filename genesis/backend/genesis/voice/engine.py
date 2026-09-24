"""Voice engine: Whisper speech-to-text and Piper text-to-speech, both fully local.

Both are optional installs (`pip install -r requirements-voice.txt`). When one isn't
available, the API reports it and the UI falls back to the browser's speech APIs.

Pipeline: microphone → Whisper → conversation engine → Piper → speaker.
The UI streams the reply text and speaks it sentence by sentence to keep latency low.
"""

from __future__ import annotations

import io
import logging
import shutil
import subprocess
import tempfile
import threading
import wave
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


class VoiceUnavailable(RuntimeError):
    pass


class SpeechToText:
    def __init__(self, model_size: str = "base.en", device: str = "auto"):
        self.model_size = model_size
        self.device = device
        self._model = None
        self._lock = threading.Lock()
        self._error: str | None = None

    def status(self) -> dict[str, Any]:
        try:
            import faster_whisper  # noqa: F401
        except ImportError:
            return {
                "available": False,
                "model": self.model_size,
                "detail": "faster-whisper is not installed (pip install -r requirements-voice.txt)",
            }
        return {
            "available": self._error is None,
            "model": self.model_size,
            "detail": self._error or ("loaded" if self._model else "loads on first use"),
        }

    def _load(self):
        if self._model is not None:
            return self._model
        with self._lock:
            if self._model is None:
                try:
                    from faster_whisper import WhisperModel
                except ImportError as e:
                    raise VoiceUnavailable("faster-whisper is not installed") from e
                try:
                    compute = "int8" if self.device in ("cpu", "auto") else "float16"
                    self._model = WhisperModel(self.model_size, device=self.device, compute_type=compute)
                except Exception as e:  # model download or backend failure
                    self._error = str(e)
                    raise VoiceUnavailable(f"could not load Whisper: {e}") from e
        return self._model

    def transcribe(self, audio: bytes, suffix: str = ".webm") -> dict[str, Any]:
        model = self._load()
        # faster-whisper decodes webm/ogg/wav through PyAV, so browser recordings work directly.
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as f:
            f.write(audio)
            f.flush()
            segments, info = model.transcribe(f.name, beam_size=1, vad_filter=True)
            text = " ".join(seg.text.strip() for seg in segments).strip()
        return {"text": text, "language": getattr(info, "language", "en")}


class TextToSpeech:
    """Piper TTS via the `piper-tts` Python package, or the `piper` binary as a fallback."""

    def __init__(self, voices_dir: Path, voice: str, binary: str = "piper"):
        self.voices_dir = voices_dir
        self.voice = voice
        self.binary = binary
        self._voices: dict[str, Any] = {}
        self._lock = threading.Lock()

    def model_path(self, voice: str | None = None) -> Path:
        return self.voices_dir / f"{voice or self.voice}.onnx"

    def status(self, voice: str | None = None) -> dict[str, Any]:
        path = self.model_path(voice)
        if not path.exists():
            return {
                "available": False,
                "voice": voice or self.voice,
                "detail": f"voice model not found at {path} (run scripts/download_voice.py)",
            }
        try:
            import piper  # noqa: F401

            return {"available": True, "voice": voice or self.voice, "detail": "piper-tts"}
        except ImportError:
            pass
        if shutil.which(self.binary):
            return {"available": True, "voice": voice or self.voice, "detail": "piper binary"}
        return {
            "available": False,
            "voice": voice or self.voice,
            "detail": "piper-tts is not installed (pip install -r requirements-voice.txt)",
        }

    def speak(self, text: str, voice: str | None = None) -> bytes:
        text = " ".join(text.split())[:2000]
        if not text:
            raise VoiceUnavailable("nothing to say")
        path = self.model_path(voice)
        if not path.exists():
            raise VoiceUnavailable(f"voice model not found: {path.name}")
        try:
            return self._speak_python(text, path)
        except ImportError:
            return self._speak_binary(text, path)

    def _speak_python(self, text: str, path: Path) -> bytes:
        from piper import PiperVoice  # raises ImportError if not installed

        key = str(path)
        with self._lock:
            if key not in self._voices:
                self._voices[key] = PiperVoice.load(str(path))
            v = self._voices[key]
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            if hasattr(v, "synthesize_wav"):  # piper-tts >= 1.3
                v.synthesize_wav(text, wf)
            else:  # older piper-tts
                v.synthesize(text, wf)
        return buf.getvalue()

    def _speak_binary(self, text: str, path: Path) -> bytes:
        exe = shutil.which(self.binary)
        if not exe:
            raise VoiceUnavailable("Piper is not installed")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as out:
            proc = subprocess.run(
                [exe, "--model", str(path), "--output_file", out.name],
                input=text.encode(),
                capture_output=True,
                timeout=60,
                check=False,
            )
            if proc.returncode != 0:
                raise VoiceUnavailable(proc.stderr.decode(errors="replace")[:300])
            return Path(out.name).read_bytes()
