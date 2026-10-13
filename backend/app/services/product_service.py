from __future__ import annotations

import uuid
from decimal import Decimal

import asyncpg

from app.errors import conflict, not_found
from app.models.product import ProductCreate, ProductUpdate

PRODUCT_COLUMNS = """
    id, org_id, sku, barcode, name, description, category_id, supplier_id, unit,
    cost_price, sell_price, reorder_point, reorder_qty, track_serial, track_batch,
    metadata, created_at, updated_at, archived_at
"""


async def _assert_sku_free(
    conn: asyncpg.Connection, org_id: uuid.UUID, sku: str, exclude_id: uuid.UUID | None = None
) -> None:
    query = "SELECT 1 FROM products WHERE org_id = $1 AND sku = $2 AND archived_at IS NULL"
    args: list[object] = [org_id, sku]
    if exclude_id is not None:
        query += " AND id <> $3"
        args.append(exclude_id)
    if await conn.fetchrow(query, *args):
        raise conflict(f"sku '{sku}' already exists in this organization")


async def _assert_references_in_org(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    *,
    category_id: uuid.UUID | None,
    supplier_id: uuid.UUID | None,
) -> None:
    if category_id is not None and not await conn.fetchval(
        "SELECT 1 FROM categories WHERE id = $1 AND org_id = $2 AND archived_at IS NULL",
        category_id,
        org_id,
    ):
        raise not_found("category")
    if supplier_id is not None and not await conn.fetchval(
        "SELECT 1 FROM suppliers WHERE id = $1 AND org_id = $2 AND archived_at IS NULL",
        supplier_id,
        org_id,
    ):
        raise not_found("supplier")


async def create_product(
    conn: asyncpg.Connection, org_id: uuid.UUID, payload: ProductCreate
) -> asyncpg.Record:
    await _assert_sku_free(conn, org_id, payload.sku)
    await _assert_references_in_org(
        conn, org_id, category_id=payload.category_id, supplier_id=payload.supplier_id
    )

    record = await conn.fetchrow(
        f"""
        INSERT INTO products (
            org_id, sku, barcode, name, description, category_id, supplier_id, unit,
            cost_price, sell_price, reorder_point, reorder_qty,
            track_serial, track_batch, metadata
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING {PRODUCT_COLUMNS}
        """,
        org_id,
        payload.sku,
        payload.barcode,
        payload.name,
        payload.description,
        payload.category_id,
        payload.supplier_id,
        payload.unit,
        payload.cost_price,
        payload.sell_price,
        payload.reorder_point,
        payload.reorder_qty,
        payload.track_serial,
        payload.track_batch,
        payload.metadata,
    )
    if record is None:  # pragma: no cover - INSERT ... RETURNING always yields a row
        raise RuntimeError("product insert returned no row")

    # Opening balance is written through the ledger, never straight into stock_levels.
    if payload.opening_quantity > 0 and payload.opening_location_id is not None:
        await conn.execute(
            """
            INSERT INTO stock_movements
                (org_id, product_id, location_id, type, quantity, reference, note)
            VALUES ($1, $2, $3, 'in', $4, 'opening-balance', 'opening balance')
            """,
            org_id,
            record["id"],
            payload.opening_location_id,
            payload.opening_quantity,
        )

    return record


async def list_products(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
    q: str | None,
    category_id: uuid.UUID | None,
    supplier_id: uuid.UUID | None,
    include_archived: bool,
) -> tuple[list[asyncpg.Record], int]:
    where = ["p.org_id = $1"]
    args: list[object] = [org_id]

    if not include_archived:
        where.append("p.archived_at IS NULL")
    if q:
        args.append(f"%{q}%")
        where.append(f"(p.name ILIKE ${len(args)} OR p.sku ILIKE ${len(args)})")
    if category_id:
        args.append(category_id)
        where.append(f"p.category_id = ${len(args)}")
    if supplier_id:
        args.append(supplier_id)
        where.append(f"p.supplier_id = ${len(args)}")

    clause = " AND ".join(where)
    total = await conn.fetchval(f"SELECT count(*) FROM products p WHERE {clause}", *args)
    args.extend([limit, offset])
    rows = await conn.fetch(
        f"""
        SELECT {PRODUCT_COLUMNS},
               COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl
                         WHERE sl.product_id = p.id), 0) AS total_quantity
        FROM products p
        WHERE {clause}
        ORDER BY p.created_at DESC, p.id
        LIMIT ${len(args) - 1} OFFSET ${len(args)}
        """,
        *args,
    )
    return rows, int(total or 0)


async def get_product(
    conn: asyncpg.Connection, org_id: uuid.UUID, product_id: uuid.UUID
) -> asyncpg.Record:
    record = await conn.fetchrow(
        f"SELECT {PRODUCT_COLUMNS} FROM products WHERE id = $1 AND org_id = $2",
        product_id,
        org_id,
    )
    if record is None:
        raise not_found("product")
    return record


async def get_product_stock(
    conn: asyncpg.Connection, org_id: uuid.UUID, product_id: uuid.UUID
) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT sl.location_id, l.name AS location_name, l.type AS location_type,
               sl.quantity, sl.reserved, sl.updated_at
        FROM stock_levels sl
        JOIN locations l ON l.id = sl.location_id
        WHERE sl.product_id = $1 AND sl.org_id = $2 AND l.archived_at IS NULL
        ORDER BY l.name
        """,
        product_id,
        org_id,
    )


async def update_product(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    product_id: uuid.UUID,
    payload: ProductUpdate,
) -> asyncpg.Record:
    existing = await get_product(conn, org_id, product_id)

    if payload.sku is not None and payload.sku != existing["sku"]:
        await _assert_sku_free(conn, org_id, payload.sku, exclude_id=product_id)

    if payload.category_id is not None or payload.supplier_id is not None:
        await _assert_references_in_org(
            conn,
            org_id,
            category_id=payload.category_id
            if payload.category_id is not None
            else existing["category_id"],
            supplier_id=payload.supplier_id
            if payload.supplier_id is not None
            else existing["supplier_id"],
        )

    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return existing

    if "barcode" in fields and fields["barcode"]:
        clash = await conn.fetchval(
            "SELECT 1 FROM products WHERE barcode = $1 AND id <> $2", fields["barcode"], product_id
        )
        if clash:
            raise conflict(f"barcode '{fields['barcode']}' already in use")

    assignments = []
    args: list[object] = []
    for column, value in fields.items():
        args.append(value)
        assignments.append(f"{column} = ${len(args)}")

    args.extend([product_id, org_id])
    record = await conn.fetchrow(
        f"""
        UPDATE products
        SET {', '.join(assignments)}
        WHERE id = ${len(args) - 1} AND org_id = ${len(args)}
        RETURNING {PRODUCT_COLUMNS}
        """,
        *args,
    )
    if record is None:
        raise not_found("product")
    return record


async def archive_product(
    conn: asyncpg.Connection, org_id: uuid.UUID, product_id: uuid.UUID
) -> None:
    on_hand = await conn.fetchval(
        "SELECT COALESCE(SUM(quantity), 0) FROM stock_levels WHERE product_id = $1",
        product_id,
    )
    if on_hand and Decimal(on_hand) != 0:
        raise conflict("cannot archive a product that still holds stock")

    result = await conn.execute(
        """
        UPDATE products SET archived_at = now()
        WHERE id = $1 AND org_id = $2 AND archived_at IS NULL
        """,
        product_id,
        org_id,
    )
    if result == "UPDATE 0":
        raise not_found("product")


async def get_by_barcode(
    conn: asyncpg.Connection, org_id: uuid.UUID, barcode: str
) -> asyncpg.Record:
    record = await conn.fetchrow(
        f"""
        SELECT {PRODUCT_COLUMNS} FROM products
        WHERE barcode = $1 AND org_id = $2 AND archived_at IS NULL
        """,
        barcode,
        org_id,
    )
    if record is None:
        raise not_found("product")
    return record