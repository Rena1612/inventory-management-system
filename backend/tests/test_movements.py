from __future__ import annotations

import re
import uuid

import asyncpg
import pytest

from app.db import connection
from app.models.movement import MovementIn, TransferIn
from app.services import movement_service

# The service layer lets database constraint violations propagate as asyncpg
# errors; main.py maps them to {"error", "code"} at the HTTP boundary.


async def _stock(product_id: uuid.UUID, location_id: uuid.UUID) -> float:
    async with connection() as conn:
        value = await conn.fetchval(
            "SELECT quantity FROM stock_levels WHERE product_id = $1 AND location_id = $2",
            product_id,
            location_id,
        )
    return float(value) if value is not None else 0.0


async def _on_hand(product_id: uuid.UUID) -> float:
    async with connection() as conn:
        return float(
            await conn.fetchval(
                "SELECT COALESCE(SUM(quantity), 0) FROM stock_levels WHERE product_id = $1",
                product_id,
            )
        )


async def test_in_movement_creates_stock_level(org_and_user, product, location) -> None:
    org_id, user_id = org_and_user

    async with connection() as conn:
        movement = await movement_service.record_movement(
            conn,
            org_id,
            user_id,
            MovementIn(
                product_id=product,
                location_id=location,
                type="in",
                quantity=25,
                reference="PO-1001",
            ),
        )

    assert movement["type"] == "in"
    assert await _stock(product, location) == 25.0


async def test_out_movement_decrements_stock(org_and_user, product, location) -> None:
    org_id, user_id = org_and_user
    async with connection() as conn:
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="in", quantity=10),
        )
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="out", quantity=4),
        )

    assert await _stock(product, location) == 6.0


async def test_out_movement_beyond_stock_is_rejected(org_and_user, product, location) -> None:
    org_id, user_id = org_and_user
    async with connection() as conn:
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="in", quantity=3),
        )

    with pytest.raises(asyncpg.CheckViolationError, match="insufficient stock"):
        async with connection() as conn:
            await movement_service.record_movement(
                conn, org_id, user_id,
                MovementIn(product_id=product, location_id=location, type="out", quantity=10),
            )

    # The failed statement rolls back; derived state stays consistent.
    assert await _stock(product, location) == 3.0


async def test_adjust_accepts_signed_delta(org_and_user, product, location) -> None:
    org_id, user_id = org_and_user
    async with connection() as conn:
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="in", quantity=20),
        )
    async with connection() as conn:
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="adjust", quantity=-2),
        )

    assert await _stock(product, location) == 18.0


async def test_transfer_moves_quantity_between_locations(org_and_user, product, location) -> None:
    org_id, user_id = org_and_user
    destination = uuid.uuid4()
    async with connection() as conn:
        await conn.execute(
            "INSERT INTO locations (id, org_id, name, type) VALUES ($1,$2,'Destination','shelf')",
            destination,
            org_id,
        )
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="in", quantity=50),
        )

    async with connection() as conn:
        rows = await movement_service.record_transfer(
            conn, org_id, user_id,
            TransferIn(
                product_id=product,
                from_location_id=location,
                to_location_id=destination,
                quantity=12,
            ),
        )

    assert {r["type"] for r in rows} == {"transfer_out", "transfer_in"}
    # One shared reference ties the pair together.
    assert len({r["reference"] for r in rows}) == 1

    assert await _stock(product, location) == 38.0
    assert await _stock(product, destination) == 12.0
    assert await _on_hand(product) == 50.0


async def test_delta_reports_the_effect_on_stock(org_and_user, product, location) -> None:
    """Clients render `delta`; they must not re-derive the sign from the type.

    `quantity` is a positive magnitude for in/out/transfer_* and a signed delta
    for adjust (stock_movements_sign_by_type). `delta` is the only place that rule
    should live.
    """
    org_id, user_id = org_and_user
    destination = uuid.uuid4()
    async with connection() as conn:
        await conn.execute(
            "INSERT INTO locations (id, org_id, name, type) VALUES ($1,$2,'Destination','shelf')",
            destination,
            org_id,
        )
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="in", quantity=50),
        )
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="out", quantity=8),
        )
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="adjust", quantity=-2),
        )
        transferred = await movement_service.record_transfer(
            conn, org_id, user_id,
            TransferIn(
                product_id=product,
                from_location_id=location,
                to_location_id=destination,
                quantity=12,
            ),
        )

    by_type = {row["type"]: float(row["delta"]) for row in transferred}
    assert by_type == {"transfer_out": -12.0, "transfer_in": 12.0}

    async with connection() as conn:
        rows, _ = await movement_service.list_movements(
            conn, org_id,
            limit=50, offset=0,
            product_id=product, location_id=None, movement_type=None,
            date_from=None, date_to=None,
        )

    deltas = {row["type"]: float(row["delta"]) for row in rows}
    assert deltas["in"] == 50.0
    assert deltas["out"] == -8.0
    assert deltas["adjust"] == -2.0
    # The stored magnitude is untouched; only the new field carries the sign.
    assert float(next(r for r in rows if r["type"] == "out")["quantity"]) == 8.0


async def test_delta_is_correct_for_every_allowed_type(
    org_and_user, product, location
) -> None:
    """Every movement_type label must have an explicit delta rule.

    DELTA_SQL lists each type individually and falls through to NULL. A silent
    "otherwise positive" branch would report a type that removes stock as an
    increase, so this asserts the full set rather than a sample.
    """
    org_id, user_id = org_and_user
    destination = uuid.uuid4()
    async with connection() as conn:
        await conn.execute(
            "INSERT INTO locations (id, org_id, name, type) VALUES ($1,$2,'Destination','shelf')",
            destination,
            org_id,
        )
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="in", quantity=40),
        )
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="out", quantity=7),
        )
        # A positive adjustment as well as a negative one: both pass through.
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="adjust", quantity=-3),
        )
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="adjust", quantity=5),
        )
        await movement_service.record_transfer(
            conn, org_id, user_id,
            TransferIn(
                product_id=product,
                from_location_id=location,
                to_location_id=destination,
                quantity=9,
            ),
        )

    async with connection() as conn:
        rows, _ = await movement_service.list_movements(
            conn, org_id,
            limit=50, offset=0,
            product_id=product, location_id=None, movement_type=None,
            date_from=None, date_to=None,
        )

    by_type: dict[str, list[float]] = {}
    for row in rows:
        assert row["delta"] is not None, f"{row['type']} produced a null delta"
        by_type.setdefault(str(row["type"]), []).append(float(row["delta"]))

    assert by_type["in"] == [40.0]
    assert by_type["out"] == [-7.0]
    assert sorted(by_type["adjust"]) == [-3.0, 5.0]
    assert by_type["transfer_in"] == [9.0]
    assert by_type["transfer_out"] == [-9.0]
    assert set(by_type) == {"in", "out", "adjust", "transfer_in", "transfer_out"}


async def test_unknown_movement_type_is_rejected(org_and_user, product, location) -> None:
    """An unknown type must never reach the ledger.

    The `movement_type` enum rejects the label outright. stock_movements_type_known
    (migration 002) is defence in depth for the day someone commits
    `ALTER TYPE movement_type ADD VALUE`: Postgres would take the new label, the
    insert would succeed, and DELTA_SQL would report a NULL delta for it.

    That second path cannot be exercised here without permanently altering the
    enum, so it is asserted by definition rather than by execution: the constraint
    must exist and must enumerate exactly the labels the enum currently holds.
    """
    org_id, _ = org_and_user
    async with connection() as conn:
        definition = await conn.fetchval(
            """
            SELECT pg_get_constraintdef(oid) FROM pg_constraint
            WHERE conname = 'stock_movements_type_known'
              AND conrelid = 'stock_movements'::regclass
            """
        )
        assert definition is not None, "migration 002 has not been applied"

        labels = {
            row["enumlabel"]
            for row in await conn.fetch(
                "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'movement_type'::regtype"
            )
        }
        guarded = set(re.findall(r"'([a-z_]+)'::movement_type", definition))
        assert guarded == labels, (
            "stock_movements_type_known does not cover every enum label; a newly "
            "added movement type would pass the constraint with no delta rule"
        )

        # The enum itself refuses an unknown label today.
        with pytest.raises(asyncpg.PostgresError):
            await conn.execute(
                """
                INSERT INTO stock_movements
                    (org_id, product_id, location_id, type, quantity, reference)
                VALUES ($1,$2,$3,'wastage',1,'unknown-type-probe')
                """,
                org_id, product, location,
            )


async def test_delta_sql_lists_every_type_in_the_enum(
    org_and_user, product, location
) -> None:
    """The SQL rule and the database enum must not drift apart.

    If someone adds an enum value, this fails until DELTA_SQL learns the sign,
    which is exactly the moment to update it.
    """
    org_id, _ = org_and_user
    async with connection() as conn:
        labels = await conn.fetch(
            "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'movement_type'::regtype"
        )

    listed = set(re.findall(r"WHEN\s+'([a-z_]+)'", movement_service.DELTA_SQL))
    assert {row["enumlabel"] for row in labels} == listed, (
        "movement_type and DELTA_SQL disagree; add the new type to DELTA_SQL "
        "and to stock_movements_type_known before using it"
    )


async def test_transfer_is_atomic_when_source_is_short(org_and_user, product, location) -> None:
    org_id, user_id = org_and_user
    destination = uuid.uuid4()
    async with connection() as conn:
        await conn.execute(
            "INSERT INTO locations (id, org_id, name, type) VALUES ($1,$2,'Destination','shelf')",
            destination,
            org_id,
        )
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="in", quantity=5),
        )

    with pytest.raises(asyncpg.CheckViolationError):
        async with connection() as conn:
            await movement_service.record_transfer(
                conn, org_id, user_id,
                TransferIn(
                    product_id=product,
                    from_location_id=location,
                    to_location_id=destination,
                    quantity=10,
                ),
            )

    # Neither leg survives.
    assert await _stock(product, destination) == 0.0
    assert await _stock(product, location) == 5.0


async def test_movement_rejects_cross_org_location(
    org_and_user, product, rival, db_pool
) -> None:
    org_id, user_id = org_and_user
    _rival_client = rival

    foreign_location = uuid.uuid4()
    async with connection() as conn:
        rival_org_id = await conn.fetchval(
            "SELECT id FROM organizations WHERE slug LIKE 'rival-%'"
        )
        await conn.execute(
            "INSERT INTO locations (id, org_id, name, type) VALUES ($1,$2,'Rival Shelf','shelf')",
            foreign_location,
            rival_org_id,
        )

    with pytest.raises(asyncpg.ForeignKeyViolationError, match="does not belong to org"):
        async with connection() as conn:
            await movement_service.record_movement(
                conn, org_id, user_id,
                MovementIn(product_id=product, location_id=foreign_location, type="in", quantity=5),
            )


async def test_movements_are_append_only(org_and_user, product, location) -> None:
    org_id, user_id = org_and_user
    async with connection() as conn:
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="in", quantity=7),
        )

    with pytest.raises(asyncpg.RestrictViolationError, match="append-only"):
        async with connection() as conn:
            await conn.execute(
                "UPDATE stock_movements SET quantity = 999 WHERE org_id = $1", org_id
            )

    with pytest.raises(asyncpg.RestrictViolationError, match="append-only"):
        async with connection() as conn:
            await conn.execute("DELETE FROM stock_movements WHERE org_id = $1", org_id)

    # The ledger is untouched.
    assert await _stock(product, location) == 7.0


async def test_history_is_scoped_to_org(org_and_user, product, location) -> None:
    org_id, user_id = org_and_user
    async with connection() as conn:
        await movement_service.record_movement(
            conn, org_id, user_id,
            MovementIn(product_id=product, location_id=location, type="in", quantity=1),
        )
        rows, total = await movement_service.product_history(
            conn, org_id, product, limit=20, offset=0
        )

    assert total == 1
    assert rows[0]["product_sku"] == "TEST-001"
    assert rows[0]["user_email"] is not None