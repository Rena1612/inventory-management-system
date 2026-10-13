from __future__ import annotations

import uuid
from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Query, status

from app.deps import ConnectionDep, PageDep, SearchDep, WriterDep
from app.errors import not_found
from app.models.common import Message, Page, PageMeta
from app.models.product import (
    ProductCreate,
    ProductDetailOut,
    ProductOut,
    ProductUpdate,
    StockLevelOut,
)
from app.services import product_service

router = APIRouter(prefix="/api/products", tags=["products"])


@router.post("", response_model=ProductDetailOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate, conn: ConnectionDep, user: WriterDep
) -> ProductDetailOut:
    record = await product_service.create_product(conn, user.org_id, payload)
    product_id = record["id"]
    stock = await product_service.get_product_stock(conn, user.org_id, product_id)
    return _detail(conn, user.org_id, product_id, record, stock)


def _detail(
    conn: ConnectionDep,
    org_id: uuid.UUID,
    product_id: uuid.UUID,
    record: asyncpg.Record,
    stock: list[asyncpg.Record],
) -> ProductDetailOut:
    """Build the detail payload with the stock total derived from stock_levels."""
    detail = ProductDetailOut(
        **ProductOut.model_validate(dict(record)).model_dump(),
        stock=[StockLevelOut.model_validate(dict(row)) for row in stock],
    )
    detail.total_quantity = sum((row["quantity"] for row in stock), Decimal("0"))
    return detail


@router.get("", response_model=Page[ProductOut])
async def list_products(
    conn: ConnectionDep,
    user: WriterDep,
    page: PageDep,
    search: SearchDep,
    category_id: uuid.UUID | None = Query(default=None),
    supplier_id: uuid.UUID | None = Query(default=None),
    include_archived: bool = Query(default=False),
) -> Page[ProductOut]:
    rows, total = await product_service.list_products(
        conn,
        user.org_id,
        limit=page.limit,
        offset=page.offset,
        q=search.q,
        category_id=category_id,
        supplier_id=supplier_id,
        include_archived=include_archived,
    )
    return Page(
        items=[ProductOut.model_validate(dict(r)) for r in rows],
        meta=PageMeta(
            limit=page.limit,
            offset=page.offset,
            total=total,
            has_more=page.offset + len(rows) < total,
        ),
    )


@router.get("/barcode/{barcode}", response_model=ProductDetailOut)
async def get_by_barcode(barcode: str, conn: ConnectionDep, user: WriterDep) -> ProductDetailOut:
    record = await product_service.get_by_barcode(conn, user.org_id, barcode)
    stock = await product_service.get_product_stock(conn, user.org_id, record["id"])
    return _detail(conn, user.org_id, record["id"], record, stock)


@router.get("/{product_id}", response_model=ProductDetailOut)
async def get_product(product_id: uuid.UUID, conn: ConnectionDep, user: WriterDep) -> ProductDetailOut:
    record = await product_service.get_product(conn, user.org_id, product_id)
    stock = await product_service.get_product_stock(conn, user.org_id, product_id)
    detail = _detail(conn, user.org_id, product_id, record, stock)

    if record["category_id"]:
        detail.category_name = await conn.fetchval(
            "SELECT name FROM categories WHERE id = $1", record["category_id"]
        )
    if record["supplier_id"]:
        detail.supplier_name = await conn.fetchval(
            "SELECT name FROM suppliers WHERE id = $1", record["supplier_id"]
        )
    return detail


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: uuid.UUID, payload: ProductUpdate, conn: ConnectionDep, user: WriterDep
) -> ProductOut:
    record = await product_service.update_product(conn, user.org_id, product_id, payload)
    return ProductOut.model_validate(dict(record))


@router.delete("/{product_id}", response_model=Message)
async def delete_product(product_id: uuid.UUID, conn: ConnectionDep, user: WriterDep) -> Message:
    await product_service.archive_product(conn, user.org_id, product_id)
    return Message(message="product archived")


@router.post("/{product_id}/restore", response_model=ProductOut)
async def restore_product(product_id: uuid.UUID, conn: ConnectionDep, user: WriterDep) -> ProductOut:
    record = await conn.fetchrow(
        """
        UPDATE products SET archived_at = NULL
        WHERE id = $1 AND org_id = $2
        RETURNING id
        """,
        product_id,
        user.org_id,
    )
    if record is None:
        raise not_found("product")
    row = await product_service.get_product(conn, user.org_id, product_id)
    return ProductOut.model_validate(dict(row))