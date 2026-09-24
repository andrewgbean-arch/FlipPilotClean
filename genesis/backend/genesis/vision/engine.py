"""Vision engine: image understanding through a local multimodal model (e.g. llama3.2-vision, llava).

A single interface covers image upload, camera frames (the UI sends a still), OCR,
object recognition and scene description; the prompt selects the task. Descriptions
can be stored as episodic memories so the companion remembers what it was shown.

Face identification is intentionally left as a future, opt-in plugin.
"""

from __future__ import annotations

import base64
import logging
from typing import TYPE_CHECKING, Any

from genesis.llm.base import LLMUnavailable
from genesis.memory.engine import MemoryRejected
from genesis.safety.guard import sanitize

if TYPE_CHECKING:
    from genesis.services import Services

log = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 12 * 1024 * 1024
TASK_PROMPTS = {
    "describe": "Describe this image clearly and concisely: the scene, the main objects, any people (without identifying them), and anything notable.",
    "ocr": "Transcribe all readable text in this image exactly, preserving line breaks. If there's no text, say so.",
    "objects": "List the distinct objects you can see in this image, one per line, most prominent first.",
    "document": "This is a document. Summarise what it is and its key contents, and transcribe any important figures, dates or names.",
}


class VisionUnavailable(RuntimeError):
    pass


class VisionEngine:
    def __init__(self, svc: Services):
        self.svc = svc

    @property
    def model(self) -> str:
        return self.svc.config.vision_model

    def status(self) -> dict[str, Any]:
        models = self.svc.llm.list_models()
        base = self.model.split(":")[0]
        return {"available": any(m.split(":")[0] == base for m in models), "model": self.model}

    def analyze(self, image: bytes, prompt: str | None = None, *, remember: bool = False, task: str = "describe") -> dict[str, Any]:
        if not image:
            raise ValueError("empty image")
        if len(image) > MAX_IMAGE_BYTES:
            raise ValueError("image too large (12 MB limit)")
        instruction = TASK_PROMPTS.get(task, TASK_PROMPTS["describe"])
        if prompt:
            instruction += f'\nThe user asks: "{sanitize(prompt, 500)}"'
        describe = getattr(self.svc.llm, "describe_image", None)
        if describe is None:
            raise VisionUnavailable("the configured LLM runtime has no vision support")
        try:
            description = describe(base64.b64encode(image).decode(), instruction, self.model)
        except LLMUnavailable as e:
            raise VisionUnavailable(f"vision model unavailable ({self.model}): {e}") from e
        description = sanitize(description, 4000)
        memory_id = None
        if remember and description:
            with self.svc.db.session() as s:
                try:
                    m, _ = self.svc.memory.add(
                        s,
                        f"The user showed me an image: {description[:900]}",
                        title="Image the user shared",
                        memory_type="episodic",
                        category="event",
                        importance="medium",
                        confidence=0.7,
                        source="vision",
                        tags=["image"],
                    )
                    memory_id = m.id
                except MemoryRejected:
                    pass
        return {"description": description, "model": self.model, "memory_id": memory_id}
