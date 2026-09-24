from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, Request

from genesis.services import Services


def get_svc(request: Request) -> Services:
    return request.app.state.svc


def require_token(request: Request, x_genesis_token: str | None = Header(default=None)) -> None:
    expected = request.app.state.svc.config.api_token
    if expected and not (x_genesis_token and hmac.compare_digest(x_genesis_token, expected)):
        raise HTTPException(status_code=401, detail="missing or invalid X-Genesis-Token")


def not_found(what: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{what} not found")
