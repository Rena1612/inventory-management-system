from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.models.common import ORMModel, Timestamped

JsonDict = dict[str, Any]


class ProductBase(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    barcode: str | None = Field(default=None, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    unit: str = Field(default="each", max_length=32)
    cost_price: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=4)
    sell_price: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=4)
    reorder_point: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=3)
    reorder_qty: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=3)
    track_serial: bool = False
    track_batch: bool = False
    metadata: JsonDict = Field(default_factory=dict)

    @model_validator(mode="after")
    def price_sanity(self) -> ProductBase:
        if self.sell_price > 0 and self.sell_price < self.cost_price:
            raise ValueError("sell_price cannot be below cost_price")
        return self


class ProductCreate(ProductBase):
    opening_quantity: Decimal = Field(
        default=Decimal("0"), ge=0, max_digits=14, decimal_places=3
    )
    opening_location_id: uuid.UUID | None = None


class ProductUpdate(BaseModel):
    sku: str | None = Field(default=None, min_length=1, max_length=64)
    barcode: str | None = Field(default=None, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    unit: str | None = Field(default=None, max_length=32)
    cost_price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=4)
    sell_price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=4)
    reorder_point: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    reorder_qty: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    track_serial: bool | None = None
    track_batch: bool | None = None
    metadata: JsonDict | None = None


class StockLevelOut(ORMModel):
    location_id: uuid.UUID
    location_name: str
    location_type: str | None
    quantity: Decimal
    reserved: Decimal
    updated_at: datetime


class ProductOut(Timestamped):
    org_id: uuid.UUID
    sku: str
    barcode: str | None
    name: str
    description: str | None
    category_id: uuid.UUID | None
    supplier_id: uuid.UUID | None
    unit: str
    cost_price: Decimal
    sell_price: Decimal
    reorder_point: Decimal
    reorder_qty: Decimal
    track_serial: bool
    track_batch: bool
    metadata: JsonDict
    total_quantity: Decimal = Decimal("0")


class ProductDetailOut(ProductOut):
    stock: list[StockLevelOut] = []
    category_name: str | None = None
    supplier_name: str | None = None