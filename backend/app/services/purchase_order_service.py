from __future__ import annotations

import uuid

import asyncpg

from app.errors import conflict, not_found
from app.models.purchase_order import PurchaseOrderCreate


async def create_purchase_order(
    conn: asyncpg.Connection, org_id: uuid.UUID, payload: PurchaseOrderCreate
) -> asyncpg.Record:
    if not await conn.fetchval(
        "SELECT 1 FROM suppliers WHERE id = $1 AND org_id = $2 AND archived_at IS NULL",
        payload.supplier_id,
        org_id,
    ):
        raise not_found("supplier")

    for item in payload.items:
        if not await conn.fetchval(
            "SELECT 1 FROM products WHERE id = $1 AND org_id = $2 AND archived_at IS NULL",
            item.product_id,
            org_id,
        ):
            raise not_found("product")

    total = payload.total
    record = await conn.fetchrow(
        """
        INSERT INTO purchase_orders
            (org_id, supplier_id, status, reference, expected_at, total, notes)
        VALUES ($1, $2, 'open', $3, $4, $5, $6)
        RETURNING *
        """,
        org_id,
        payload.supplier_id,
        payload.reference,
        payload.expected_at,
        total,
        payload.notes,
    )
    if record is None:  # pragma: no cover
        raise RuntimeError("purchase order insert returned no row")

    for item in payload.items:
        await conn.execute(
            """
            INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_cost, location_id)
            VALUES ($1, $2, $3, $4, $5)
            """,
            record["id"],
            item.product_id,
            item.quantity,
            item.unit_cost,
            item.location_id,
        )
    return record


async def get_purchase_order(
    conn: asyncpg.Connection, org_id: uuid.UUID, po_id: uuid.UUID
) -> asyncpg.Record:
    record = await conn.fetchrow(
        # archived_at is filtered so a soft-deleted order 404s by direct link,
        # matching what the list endpoint already hides.
        "SELECT * FROM purchase_orders WHERE id = $1 AND org_id = $2 AND archived_at IS NULL",
        po_id,
        org_id,
    )
    if record is None:
        raise not_found("purchase order")
    return record


async def list_purchase_orders(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
    status: str | None,
    supplier_id: uuid.UUID | None,
) -> tuple[list[asyncpg.Record], int]:
    where = ["po.org_id = $1", "po.archived_at IS NULL"]
    args: list[object] = [org_id]

    if status:
        args.append(status)
        where.append(f"po.status = ${len(args)}")
    if supplier_id:
        args.append(supplier_id)
        where.append(f"po.supplier_id = ${len(args)}")

    clause = " AND ".join(where)
    total = await conn.fetchval(f"SELECT count(*) FROM purchase_orders po WHERE {clause}", *args)

    args.extend([limit, offset])
    rows = await conn.fetch(
        f"""
        SELECT po.*, s.name AS supplier_name,
               (SELECT count(*) FROM purchase_order_items i WHERE i.po_id = po.id) AS item_count
        FROM purchase_orders po
        LEFT JOIN suppliers s ON s.id = po.supplier_id
        WHERE {clause}
        ORDER BY po.created_at DESC
        LIMIT ${len(args) - 1} OFFSET ${len(args)}
        """,
        *args,
    )
    return rows, int(total or 0)


async def receive(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    po_id: uuid.UUID,
    *,
    default_location_id: uuid.UUID | None,
    receipts: list[tuple[uuid.UUID, object, uuid.UUID | None]],
    user_id: uuid.UUID,
) -> asyncpg.Record:
    po = await get_purchase_order(conn, org_id, po_id)
    if po["status"] in ("received", "cancelled"):
        raise conflict(f"purchase order is already {po['status']}")

    reference = f"po:{po['reference'] or po_id}"

    for product_id, qty, location_id in receipts:
        item = await conn.fetchrow(
            "SELECT * FROM purchase_order_items WHERE po_id = $1 AND product_id = $2",
            po_id,
            product_id,
        )
        if item is None:
            raise not_found(f"product {product_id} on this purchase order")

        # Request location, then the request default, then where the line was ordered to.
        target_location = location_id or default_location_id or item["location_id"]
        if target_location is None:
            raise conflict(f"no receiving location supplied for product {product_id}")

        item = await conn.fetchrow(
            """
            UPDATE purchase_order_items
            SET received_qty = received_qty + $3
            WHERE po_id = $1 AND product_id = $2
            RETURNING *
            """,
            po_id,
            product_id,
            qty,
        )
        if item is None:  # pragma: no cover - row was just read
            raise not_found(f"product {product_id} on this purchase order")

        await conn.execute(
            """
            INSERT INTO stock_movements
                (org_id, product_id, location_id, type, quantity, reference, note, user_id)
            VALUES ($1, $2, $3, 'in', $4, $5, 'purchase order receipt', $6)
            """,
            org_id,
            product_id,
            target_location,
            qty,
            reference,
            user_id,
        )

    status_row = await conn.fetchrow(
        """
        SELECT
            CASE
                WHEN bool_and(received_qty >= quantity) THEN 'received'
                WHEN bool_or(received_qty > 0)        THEN 'partial'
                ELSE 'open'
            END AS next_status
        FROM purchase_order_items WHERE po_id = $1
        """,
        po_id,
    )

    updated = await conn.fetchrow(
        """
        UPDATE purchase_orders
        SET status = $3::po_status,
            received_at = CASE WHEN $3::text = 'received' THEN now() ELSE received_at END
        WHERE id = $1 AND org_id = $2
        RETURNING *
        """,
        po_id,
        org_id,
        status_row["next_status"] if status_row else "open",
    )
    if updated is None:  # pragma: no cover
        raise not_found("purchase order")
    return updated


async def archive_purchase_order(
    conn: asyncpg.Connection, org_id: uuid.UUID, po_id: uuid.UUID
) -> None:
    result = await conn.execute(
        "UPDATE purchase_orders SET archived_at = now() WHERE id = $1 AND org_id = $2",
        po_id,
        org_id,
    )
    if result == "UPDATE 0":
        raise not_found("purchase order")