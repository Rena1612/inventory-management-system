from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.common import Timestamped


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    address: str | None = None
    notes: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=64)
    address: str | None = None
    notes: str | None = None


class SupplierOut(Timestamped):
    org_id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    address: str | None
    notes: str | None