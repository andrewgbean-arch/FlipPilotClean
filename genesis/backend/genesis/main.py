"""FastAPI application. Run with:

uvicorn genesis.main:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from genesis import __version__
from genesis.api.deps import require_token
from genesis.api.routes import (
    chat,
    companion,
    goals,
    journal,
    knowledge,
    media,
    memory,
    system,
)
from genesis.config import Config, get_config
from genesis.logging_setup import setup_logging
from genesis.services import Services

log = logging.getLogger(__name__)


def create_app(config: Config | None = None, services: Services | None = None, *, start_scheduler: bool | None = None) -> FastAPI:
    config = config or (services.config if services else get_config())
    setup_logging(config.log_level, config.log_json)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        svc = services or Services(config)
        svc.startup(start_scheduler=start_scheduler)
        app.state.svc = svc
        log.info("Genesis started", extra={"event": "app.started", "version": __version__})
        yield
        svc.shutdown()

    app = FastAPI(title="Genesis", version=__version__, description="A local-first AI companion.", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "internal error"})

    deps = [Depends(require_token)]
    for r in (chat.router, memory.router, companion.router, goals.router, knowledge.router, journal.router, system.router, media.router):
        app.include_router(r, prefix="/api", dependencies=deps)

    @app.get("/")
    def root():
        return {"name": "Genesis", "version": __version__, "docs": "/docs", "api": "/api"}

    return app


app = create_app()
