from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.common import ORMModel

MovementType = Literal["in", "out", "adjust", "transfer_in", "transfer_out"]


class MovementIn(BaseModel):
    product_id: uuid.UUID
    location_id: uuid.UUID
    type: Literal["in", "out", "adjust"]
    quantity: Decimal = Field(max_digits=14, decimal_places=3)
    reference: str | None = Field(default=None, max_length=120)
    note: str | None = None

    @model_validator(mode="after")
    def validate_quantity(self) -> MovementIn:
        if self.type == "adjust":
            return self
        if self.quantity <= 0:
            raise ValueError("quantity must be positive for 'in' and 'out'")
        return self


class TransferIn(BaseModel):
    product_id: uuid.UUID
    from_location_id: uuid.UUID
    to_location_id: uuid.UUID
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    reference: str | None = Field(default=None, max_length=120)
    note: str | None = None

    @model_validator(mode="after")
    def distinct_locations(self) -> TransferIn:
        if self.from_location_id == self.to_location_id:
            raise ValueError("from_location_id and to_location_id must differ")
        return self


class MovementOut(ORMModel):
    id: int
    org_id: uuid.UUID
    product_id: uuid.UUID
    location_id: uuid.UUID
    type: MovementType
    quantity: Decimal
    reference: str | None
    note: str | None
    user_id: uuid.UUID | None
    created_at: datetime
    product_sku: str | None = None
    product_name: str | None = None
    location_name: str | None = None
    user_email: str | None = None