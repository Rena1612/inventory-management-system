from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.deps import ConnectionDep, PageDep, WriterDep
from app.errors import not_found
from app.models.common import Message, Page, PageMeta
from app.models.purchase_order import (
    PurchaseOrderCreate,
    PurchaseOrderDetailOut,
    PurchaseOrderItemOut,
    PurchaseOrderOut,
    ReceiveRequest,
)
from app.services import purchase_order_service as po_service

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])


@router.post("", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    payload: PurchaseOrderCreate, conn: ConnectionDep, user: WriterDep
) -> PurchaseOrderOut:
    record = await po_service.create_purchase_order(conn, user.org_id, payload)
    return PurchaseOrderOut.model_validate(dict(record))


@router.get("", response_model=Page[PurchaseOrderOut])
async def list_purchase_orders(
    conn: ConnectionDep,
    user: WriterDep,
    page: PageDep,
    status_filter: str | None = Query(default=None, alias="status"),
    supplier_id: uuid.UUID | None = Query(default=None),
) -> Page[PurchaseOrderOut]:
    rows, total = await po_service.list_purchase_orders(
        conn, user.org_id, limit=page.limit, offset=page.offset,
        status=status_filter, supplier_id=supplier_id,
    )
    return Page(
        items=[PurchaseOrderOut.model_validate(dict(r)) for r in rows],
        meta=PageMeta(limit=page.limit, offset=page.offset, total=total,
                      has_more=page.offset + len(rows) < total),
    )


@router.get("/{po_id}", response_model=PurchaseOrderDetailOut)
async def get_purchase_order(po_id: uuid.UUID, conn: ConnectionDep, user: WriterDep) -> PurchaseOrderDetailOut:
    record = await po_service.get_purchase_order(conn, user.org_id, po_id)
    items = await conn.fetch(
        """
        SELECT i.*, p.sku AS product_sku, p.name AS product_name
        FROM purchase_order_items i
        JOIN products p ON p.id = i.product_id
        WHERE i.po_id = $1 ORDER BY p.sku
        """,
        po_id,
    )
    supplier_name = await conn.fetchval("SELECT name FROM suppliers WHERE id = $1", record["supplier_id"])
    detail = PurchaseOrderDetailOut(
        **PurchaseOrderOut.model_validate(dict(record)).model_dump(),
        items=[PurchaseOrderItemOut.model_validate(dict(r)) for r in items],
    )
    detail.supplier_name = supplier_name
    detail.item_count = len(items)
    return detail


@router.post("/{po_id}/receive", response_model=PurchaseOrderOut)
async def receive_purchase_order(
    po_id: uuid.UUID, payload: ReceiveRequest, conn: ConnectionDep, user: WriterDep
) -> PurchaseOrderOut:
    receipts = [
        (item.product_id, item.received_qty, item.location_id or payload.location_id)
        for item in payload.items
    ]
    if not receipts:
        raise not_found("no items to receive")

    record = await po_service.receive(
        conn, user.org_id, po_id,
        default_location_id=payload.location_id,
        receipts=receipts,
        user_id=user.id,
    )
    return PurchaseOrderOut.model_validate(dict(record))


@router.delete("/{po_id}", response_model=Message)
async def archive_purchase_order(po_id: uuid.UUID, conn: ConnectionDep, user: WriterDep) -> Message:
    await po_service.archive_purchase_order(conn, user.org_id, po_id)
    return Message(message="purchase order archived")