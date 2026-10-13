from __future__ import annotations

import uuid
from datetime import datetime

import asyncpg

LOW_STOCK_SQL = """
    SELECT p.id AS product_id, p.sku, p.name, sl.quantity, p.reorder_point, p.reorder_qty,
           p.unit, s.name AS supplier, s.id AS supplier_id,
           COALESCE(p.reorder_qty, 0) AS suggested_order_qty,
           COALESCE(p.cost_price, 0) * COALESCE(p.reorder_qty, 0) AS suggested_order_cost
    FROM stock_levels sl
    JOIN products p ON p.id = sl.product_id AND p.archived_at IS NULL
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE sl.org_id = $1
      AND p.reorder_point > 0
      AND sl.quantity <= p.reorder_point
    ORDER BY (sl.quantity - p.reorder_point) ASC, p.sku
"""

VALUATION_SQL = """
    SELECT COALESCE(SUM(sl.quantity), 0)                              AS total_units,
           COALESCE(SUM(sl.quantity * p.cost_price), 0)               AS total_cost_value,
           COALESCE(SUM(sl.quantity * p.sell_price), 0)               AS total_retail_value,
           COALESCE(SUM(sl.reserved), 0)                              AS total_reserved,
           COUNT(DISTINCT p.id)                                       AS product_count
    FROM stock_levels sl
    JOIN products p ON p.id = sl.product_id AND p.archived_at IS NULL
    WHERE p.org_id = $1
"""

VALUATION_BY_LOCATION_SQL = """
    SELECT l.id AS location_id, l.name AS location_name, l.type AS location_type,
           COALESCE(SUM(sl.quantity), 0)                AS total_units,
           COALESCE(SUM(sl.quantity * p.cost_price), 0) AS total_cost_value,
           COALESCE(SUM(sl.quantity * p.sell_price), 0) AS total_retail_value
    FROM locations l
    LEFT JOIN stock_levels sl ON sl.location_id = l.id
    LEFT JOIN products p ON p.id = sl.product_id AND p.archived_at IS NULL
    WHERE l.org_id = $1 AND l.archived_at IS NULL
    GROUP BY l.id, l.name, l.type
    ORDER BY total_cost_value DESC
"""

MOVEMENT_SUMMARY_SQL = """
    SELECT sm.type,
           COUNT(*)                        AS movement_count,
           COALESCE(SUM(ABS(sm.quantity)), 0) AS total_quantity,
           MIN(sm.created_at)              AS first_at,
           MAX(sm.created_at)              AS last_at
    FROM stock_movements sm
    WHERE sm.org_id = $1
      AND ($2::timestamptz IS NULL OR sm.created_at >= $2)
      AND ($3::timestamptz IS NULL OR sm.created_at <= $3)
    GROUP BY sm.type
    ORDER BY sm.type
"""


async def low_stock(conn: asyncpg.Connection, org_id: uuid.UUID) -> list[asyncpg.Record]:
    return await conn.fetch(LOW_STOCK_SQL, org_id)


async def valuation(
    conn: asyncpg.Connection, org_id: uuid.UUID
) -> tuple[asyncpg.Record, list[asyncpg.Record]]:
    totals = await conn.fetchrow(VALUATION_SQL, org_id)
    by_location = await conn.fetch(VALUATION_BY_LOCATION_SQL, org_id)
    if totals is None:  # pragma: no cover - aggregate always returns a row
        raise RuntimeError("valuation query returned no row")
    return totals, by_location


async def movement_summary(
    conn: asyncpg.Connection,
    org_id: uuid.UUID,
    date_from: datetime | None,
    date_to: datetime | None,
) -> list[asyncpg.Record]:
    return await conn.fetch(MOVEMENT_SUMMARY_SQL, org_id, date_from, date_to)