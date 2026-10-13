"""Creates a demo organization with locations, suppliers, categories and products."""

from __future__ import annotations

import asyncio
import os
import pathlib
import sys
from decimal import Decimal
from urllib.parse import urlsplit

import asyncpg

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.auth import hash_password
from app.config import get_settings

# Dev defaults. Override in any shared environment so the seeded account does
# not ship with a publicly known password.
DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@example.com")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "demo1234")

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "[::1]"}


def assert_local_database(database_url: str) -> str:
    """Refuse to seed anything that is not a developer's own machine.

    This writes an organization, users and a stock ledger behind a publicly known
    demo password. Against a shared or production database that is data loss, so
    the check fails loudly unless someone opts in explicitly.
    """
    host = urlsplit(database_url).hostname or ""
    if host.lower() in LOCAL_HOSTS:
        return host
    if os.environ.get("ALLOW_REMOTE_SEED") == "1":
        print(f"WARNING: seeding non-local database at {host} (ALLOW_REMOTE_SEED=1)")
        return host
    raise SystemExit(
        f"refusing to seed non-local database {host!r}. The seed writes demo data "
        "behind a known password. Point DATABASE_URL at localhost, or set "
        "ALLOW_REMOTE_SEED=1 if this really is a throwaway database."
    )


async def run() -> None:
    settings = get_settings()
    if not settings.is_dev:
        # The demo login uses a publicly documented password, so it must never
        # exist outside a developer's machine.
        raise SystemExit(
            f"refusing to seed demo data: ENVIRONMENT={settings.environment}. "
            "Run this only in dev."
        )

    assert_local_database(settings.database_url)
    conn = await asyncpg.connect(settings.database_url)
    try:
        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", DEMO_EMAIL)
        if existing:
            print(f"seed already present: {DEMO_EMAIL}")
            return

        org = await conn.fetchrow(
            """
            INSERT INTO organizations (name, slug, plan)
            VALUES ('Demo Warehouse', 'demo-warehouse', 'pro') RETURNING id, slug
            """
        )
        org_id = org["id"]
        await conn.execute(
            """
            INSERT INTO users (org_id, email, password_hash, full_name, role)
            VALUES ($1, $2, $3, 'Demo Owner', 'owner')
            """,
            org_id,
            DEMO_EMAIL,
            hash_password(DEMO_PASSWORD),
        )

        warehouse = await conn.fetchrow(
            """
            INSERT INTO locations (org_id, name, code, type)
            VALUES ($1,'Main Warehouse','WH-1','warehouse') RETURNING id
            """,
            org_id,
        )
        shelf_a = await conn.fetchrow(
            """
            INSERT INTO locations (org_id, name, code, type, parent_id)
            VALUES ($1,'Aisle A / Shelf 1','A-1','shelf',$2) RETURNING id
            """,
            org_id,
            warehouse["id"],
        )
        shelf_b = await conn.fetchrow(
            """
            INSERT INTO locations (org_id, name, code, type, parent_id)
            VALUES ($1,'Aisle A / Shelf 2','A-2','shelf',$2) RETURNING id
            """,
            org_id,
            warehouse["id"],
        )

        supplier = await conn.fetchrow(
            """
            INSERT INTO suppliers (org_id, name, email, phone)
            VALUES ($1,'Acme Supply','sales@acme.example','+1-555-0100') RETURNING id
            """,
            org_id,
        )
        category = await conn.fetchrow(
            "INSERT INTO categories (org_id, name) VALUES ($1,'Hardware') RETURNING id",
            org_id,
        )

        products = [
            ("WID-001", "Widget A", Decimal("12.50"), Decimal("24.99"), Decimal("10"), Decimal("50"), shelf_a["id"]),
            ("WID-002", "Widget B", Decimal("8.00"), Decimal("16.00"), Decimal("5"), Decimal("25"), shelf_a["id"]),
            ("GAD-100", "Gadget Pro", Decimal("45.00"), Decimal("89.00"), Decimal("4"), Decimal("10"), shelf_b["id"]),
        ]
        for sku, name, cost, sell, reorder_point, reorder_qty, location_id in products:
            product = await conn.fetchrow(
                """
                INSERT INTO products (org_id, sku, name, category_id, supplier_id,
                                      cost_price, sell_price, reorder_point, reorder_qty)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
                """,
                org_id, sku, name, category["id"], supplier["id"],
                cost, sell, reorder_point, reorder_qty,
            )
            await conn.execute(
                """
                INSERT INTO stock_movements (org_id, product_id, location_id, type, quantity, reference, note)
                VALUES ($1,$2,$3,'in',$4,'opening-balance','seed opening stock')
                """,
                org_id, product["id"], location_id, reorder_point * 2,
            )

        print(f"seeded org {org['slug']} ({DEMO_EMAIL} / {DEMO_PASSWORD})")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())