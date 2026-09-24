"""Static configuration, read from the environment (GENESIS_* variables) or a .env file.

Runtime-tunable behaviour (question frequency, model choice, toggles) lives in the
Settings table instead, so it can be changed from the UI without a restart.
See genesis.settings_store.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GENESIS_", env_file=".env", extra="ignore")

    data_dir: Path = Path("./data")
    database_url: str | None = None  # defaults to sqlite in data_dir

    host: str = "127.0.0.1"
    port: int = 8000
    api_token: str | None = None
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "app://genesis", "null"]

    # LLM runtime
    ollama_url: str = "http://127.0.0.1:11434"
    chat_model: str = "llama3.1:8b"
    fallback_models: list[str] = ["llama3", "mistral", "deepseek-r1:8b"]
    embed_model: str = "nomic-embed-text"
    vision_model: str = "llama3.2-vision"
    llm_timeout_seconds: float = 120.0
    context_messages: int = 20  # short-term memory window

    # Vector store: "chroma" or "memory" (in-process, for tests)
    vector_backend: str = "chroma"

    # Voice
    whisper_model: str = "base.en"
    whisper_device: str = "auto"
    piper_voice: str = "en_US-lessac-medium"
    piper_voices_dir: Path | None = None  # defaults to data_dir/voices
    piper_binary: str = "piper"

    # Tools
    file_tool_roots: list[Path] = []  # directories read_file may access (data_dir/files always allowed)
    searxng_url: str | None = None  # optional local metasearch for web_search

    # Automation
    scheduler_enabled: bool = True
    log_level: str = "INFO"
    log_json: bool = True

    @property
    def db_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///{(self.data_dir / 'genesis.db').as_posix()}"

    @property
    def chroma_dir(self) -> Path:
        return self.data_dir / "chroma"

    @property
    def voices_dir(self) -> Path:
        return self.piper_voices_dir or (self.data_dir / "voices")

    @property
    def files_dir(self) -> Path:
        return self.data_dir / "files"

    @property
    def backups_dir(self) -> Path:
        return self.data_dir / "backups"

    def ensure_dirs(self) -> None:
        for p in (self.data_dir, self.files_dir, self.backups_dir, self.voices_dir):
            p.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_config() -> Config:
    return Config()
