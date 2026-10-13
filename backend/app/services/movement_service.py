from __future__ import annotations

import uuid

import asyncpg

from app.errors import conflict, not_found
from app.models.movement import MovementIn, TransferIn

# The effect of a movement on stock, defined once. 'out'/'transfer_out' are stored
# as positive magnitudes (stock_movements_sign_by_type); 'adjust' is already a
# signed delta. Clients render `delta` rather than re-deriving the sign themselves,
# so the rule cannot drift between the ledger and the UI.
DELTA_SQL = """
    CASE WHEN sm.type IN ('out', 'transfer_out') THEN -sm.quantity
         ELSE sm.quantity
    END AS delta
"""

MOVEMENT_SELECT = f"""
    SELECT sm.id, sm.org_id, sm.product_id, sm.location_id, sm.type, sm.quantity,
           {DELTA_SQL},
           sm.reference, sm.note, sm.user_id, sm.created_at,
           p.sku AS product_sku, p.name AS product_name,
           l.name AS location_name, u.email AS user_email
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    JOIN locations l ON l.id = sm.location_id
    LEFT JOIN users u ON u.id = sm.user_id
"""


async def record_movement(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: MovementIn,
) -> asyncpg.Record:
    if payload.type != "adjust" and payload.quantity <= 0:
        raise conflict("quantity must be positive for 'in' and 'out'")

    movement_id = await conn.fetchval(
        """
        INSERT INTO stock_movements
            (org_id, product_id, location_id, type, quantity, reference, note, user_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
        """,
        org_id,
        payload.product_id,
        payload.location_id,
        payload.type,
        payload.quantity,
        payload.reference,
        payload.note,
        user_id,
    )
    # Raise from the trigger (insufficient stock, cross-tenant refs) surfaces here.
    return await get_movement(conn, org_id, movement_id)


async def record_transfer(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: TransferIn,
) -> list[asyncpg.Record]:
    reference = payload.reference or f"transfer:{uuid.uuid4().hex[:12]}"

    rows = await conn.fetch(
        f"""
        WITH moved AS (
            INSERT INTO stock_movements
                (org_id, product_id, location_id, type, quantity, reference, note, user_id)
            VALUES
                ($1,$2,$3,'transfer_out',$5,$6,$7,$8),
                ($1,$2,$4,'transfer_in', $5,$6,$7,$8)
            RETURNING *
        )
        SELECT sm.id, sm.org_id, sm.product_id, sm.location_id, sm.type, sm.quantity,
               {DELTA_SQL},
               sm.reference, sm.note, sm.user_id, sm.created_at
        FROM moved sm
        ORDER BY sm.type  -- transfer_out first
        """,
        org_id,
        payload.product_id,
        payload.from_location_id,
        payload.to_location_id,
        payload.quantity,
        reference,
        payload.note,
        user_id,
    )
    return list(rows)


async def list_movements(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
    product_id: uuid.UUID | None,
    location_id: uuid.UUID | None,
    movement_type: str | None,
    date_from,
    date_to,
) -> tuple[list[asyncpg.Record], int]:
    where = ["sm.org_id = $1"]
    args: list[object] = [org_id]

    if product_id:
        args.append(product_id)
        where.append(f"sm.product_id = ${len(args)}")
    if location_id:
        args.append(location_id)
        where.append(f"sm.location_id = ${len(args)}")
    if movement_type:
        args.append(movement_type)
        where.append(f"sm.type = ${len(args)}")
    if date_from:
        args.append(date_from)
        where.append(f"sm.created_at >= ${len(args)}")
    if date_to:
        args.append(date_to)
        where.append(f"sm.created_at <= ${len(args)}")

    clause = " AND ".join(where)
    total = await conn.fetchval(
        f"SELECT count(*) FROM stock_movements sm WHERE {clause}", *args
    )

    args.extend([limit, offset])
    rows = await conn.fetch(
        f"""
        {MOVEMENT_SELECT}
        WHERE {clause}
        ORDER BY sm.created_at DESC, sm.id DESC
        LIMIT ${len(args) - 1} OFFSET ${len(args)}
        """,
        *args,
    )
    return rows, int(total or 0)


async def product_history(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    product_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
) -> tuple[list[asyncpg.Record], int]:
    where = "sm.org_id = $1 AND sm.product_id = $2"
    args: list[object] = [org_id, product_id]

    total = await conn.fetchval(
        f"SELECT count(*) FROM stock_movements sm WHERE {where}", *args
    )
    args.extend([limit, offset])
    rows = await conn.fetch(
        f"""
        {MOVEMENT_SELECT}
        WHERE {where}
        ORDER BY sm.created_at DESC, sm.id DESC
        LIMIT ${len(args) - 1} OFFSET ${len(args)}
        """,
        *args,
    )
    return rows, int(total or 0)


async def get_movement(
    conn: asyncpg.Connection, org_id: uuid.UUID, movement_id: int
) -> asyncpg.Record:
    record = await conn.fetchrow(
        f"{MOVEMENT_SELECT} WHERE sm.org_id = $1 AND sm.id = $2", org_id, movement_id
    )
    if record is None:
        raise not_found("movement")
    return record