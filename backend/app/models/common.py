from __future__ import annotations

import uuid
from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PageMeta(BaseModel):
    limit: int
    offset: int
    total: int
    has_more: bool


class Page(BaseModel, Generic[T]):
    items: list[T]
    meta: PageMeta


class Message(BaseModel):
    message: str


class Timestamped(ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime | None = None
    archived_at: datetime | None = None