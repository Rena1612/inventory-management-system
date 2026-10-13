from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.common import ORMModel, Timestamped

POStatus = Literal["draft", "open", "partial", "received", "cancelled"]


class PurchaseOrderItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    unit_cost: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=4)
    location_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def unique_products(self) -> PurchaseOrderItemCreate:
        return self


class PurchaseOrderCreate(BaseModel):
    supplier_id: uuid.UUID
    reference: str | None = Field(default=None, max_length=120)
    expected_at: datetime | None = None
    notes: str | None = None
    items: list[PurchaseOrderItemCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def no_duplicate_products(self) -> PurchaseOrderCreate:
        ids = [item.product_id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate product in purchase order items")
        return self

    @property
    def total(self) -> Decimal:
        return sum((item.quantity * item.unit_cost for item in self.items), Decimal("0"))


class PurchaseOrderUpdate(BaseModel):
    reference: str | None = Field(default=None, max_length=120)
    expected_at: datetime | None = None
    notes: str | None = None


class ReceiveItem(BaseModel):
    product_id: uuid.UUID
    received_qty: Decimal = Field(ge=0, max_digits=14, decimal_places=3)
    location_id: uuid.UUID | None = None


class ReceiveRequest(BaseModel):
    location_id: uuid.UUID | None = None
    items: list[ReceiveItem] = Field(default_factory=list)
    note: str | None = None


class PurchaseOrderItemOut(ORMModel):
    id: uuid.UUID
    po_id: uuid.UUID
    product_id: uuid.UUID
    quantity: Decimal
    received_qty: Decimal
    unit_cost: Decimal
    location_id: uuid.UUID | None
    product_sku: str | None = None
    product_name: str | None = None


class PurchaseOrderOut(Timestamped):
    org_id: uuid.UUID
    supplier_id: uuid.UUID
    status: POStatus
    reference: str | None
    currency: str
    expected_at: datetime | None
    received_at: datetime | None
    total: Decimal
    notes: str | None
    supplier_name: str | None = None
    item_count: int = 0


class PurchaseOrderDetailOut(PurchaseOrderOut):
    items: list[PurchaseOrderItemOut] = []