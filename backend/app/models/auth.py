from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.common import ORMModel

Role = Literal["owner", "admin", "member", "viewer"]


class SignupRequest(BaseModel):
    org_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("password must contain letters and digits")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OrganizationOut(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    created_at: datetime


class UserOut(ORMModel):
    id: uuid.UUID
    org_id: uuid.UUID
    email: str
    full_name: str | None
    role: Role
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
    organization: OrganizationOut