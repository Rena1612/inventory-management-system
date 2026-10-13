from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.models.common import Timestamped

LocationType = Literal["warehouse", "zone", "shelf", "bin", "vehicle"]


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=64)
    type: LocationType = "shelf"
    address: str | None = None
    parent_id: uuid.UUID | None = None


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=64)
    type: LocationType | None = None
    address: str | None = None
    parent_id: uuid.UUID | None = None


class LocationOut(Timestamped):
    org_id: uuid.UUID
    name: str
    code: str | None
    type: LocationType
    address: str | None
    parent_id: uuid.UUID | None


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    parent_id: uuid.UUID | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    parent_id: uuid.UUID | None = None


class CategoryOut(Timestamped):
    org_id: uuid.UUID
    name: str
    description: str | None
    parent_id: uuid.UUID | None