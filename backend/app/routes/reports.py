from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Response

from app.deps import ConnectionDep, TimeRangeDep, WriterDep
from app.services import movement_service, report_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/valuation")
async def valuation(conn: ConnectionDep, user: WriterDep) -> dict:
    totals, by_location = await report_service.valuation(conn, user.org_id)
    return {
        "totals": dict(totals),
        "by_location": [dict(row) for row in by_location],
    }


@router.get("/low-stock")
async def low_stock(conn: ConnectionDep, user: WriterDep) -> dict:
    rows = await report_service.low_stock(conn, user.org_id)
    return {
        "items": [dict(row) for row in rows],
        "total": len(rows),
        "estimated_cost": str(
            sum(row["suggested_order_cost"] for row in rows if row["suggested_order_cost"] is not None)
        ),
    }


@router.get("/movement-summary")
async def movement_summary(
    conn: ConnectionDep, user: WriterDep, window: TimeRangeDep
) -> dict:
    rows = await report_service.movement_summary(
        conn, user.org_id, window.date_from, window.date_to
    )
    return {"items": [dict(row) for row in rows]}


@router.get("/dashboard")
async def dashboard(conn: ConnectionDep, user: WriterDep) -> dict:
    """Composite payload for the dashboard screen."""
    totals, _ = await report_service.valuation(conn, user.org_id)
    low = await report_service.low_stock(conn, user.org_id)
    recent = await conn.fetch(
        f"""
        SELECT sm.id, sm.type, sm.quantity, sm.created_at, sm.reference,
               {movement_service.DELTA_SQL},
               p.sku AS product_sku, p.name AS product_name,
               l.name AS location_name
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        JOIN locations l ON l.id = sm.location_id
        WHERE sm.org_id = $1
        ORDER BY sm.created_at DESC, sm.id DESC
        LIMIT 10
        """,
        user.org_id,
    )
    product_count = await conn.fetchval(
        "SELECT count(*) FROM products WHERE org_id = $1 AND archived_at IS NULL",
        user.org_id,
    )
    return {
        "totals": dict(totals),
        "product_count": int(product_count or 0),
        "low_stock_count": len(low),
        "recent_movements": [dict(row) for row in recent],
    }


@router.get("/export/valuation")
async def export_valuation_csv(conn: ConnectionDep, user: WriterDep) -> Response:
    _totals, by_location = await report_service.valuation(conn, user.org_id)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["location_id", "location_name", "type", "total_units",
         "total_cost_value", "total_retail_value"]
    )
    for row in by_location:
        writer.writerow(
            [row["location_id"], row["location_name"], row["location_type"],
             row["total_units"], row["total_cost_value"], row["total_retail_value"]]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=valuation.csv"},
    )