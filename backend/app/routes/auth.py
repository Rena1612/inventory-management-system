from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.config import get_settings
from app.deps import ConnectionDep, CurrentUserDep
from app.models.auth import LoginRequest, OrganizationOut, SignupRequest, TokenResponse, UserOut
from app.models.common import Message
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, conn: ConnectionDep) -> TokenResponse:
    org, user = await auth_service.signup(conn, payload)
    token = await auth_service.issue_token(user, dict(org))
    return TokenResponse(
        **token,
        user=UserOut.model_validate(dict(user)),
        organization=OrganizationOut.model_validate(dict(org)),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, conn: ConnectionDep) -> TokenResponse:
    org, user = await auth_service.login(conn, payload)
    token = await auth_service.issue_token(user, org)
    return TokenResponse(
        **token,
        user=UserOut.model_validate(dict(user)),
        organization=OrganizationOut.model_validate(org),
    )


@router.get("/me")
async def me(user: CurrentUserDep, conn: ConnectionDep) -> dict:
    row = await auth_service.get_user(conn, user.id)
    return {"user": UserOut.model_validate(dict(row)).model_dump(mode="json")}


@router.post("/logout", response_model=Message)
async def logout(_user: CurrentUserDep) -> Message:
    # Tokens are stateless; the client discards it. Revocation lands with API keys.
    return Message(message="logged out")


auth_router = router
settings_dep = Annotated[object, Depends(get_settings)]