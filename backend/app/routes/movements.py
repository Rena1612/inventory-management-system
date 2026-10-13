from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status

from app.deps import ConnectionDep, PageDep, TimeRangeDep, WriterDep
from app.errors import ApiError, not_found
from app.models.common import Message, Page, PageMeta
from app.models.movement import (
    MovementIn,
    MovementOut,
    TransferIn,
)
from app.services import movement_service

router = APIRouter(prefix="/api/movements", tags=["movements"])


@router.post("", response_model=MovementOut, status_code=status.HTTP_201_CREATED)
async def create_movement(payload: MovementIn, conn: ConnectionDep, user: WriterDep) -> MovementOut:
    record = await movement_service.record_movement(conn, user.org_id, user.id, payload)
    return MovementOut.model_validate(dict(record))


@router.post("/transfer", response_model=list[MovementOut], status_code=status.HTTP_201_CREATED)
async def create_transfer(
    payload: TransferIn, conn: ConnectionDep, user: WriterDep
) -> list[MovementOut]:
    rows = await movement_service.record_transfer(conn, user.org_id, user.id, payload)
    out: list[MovementOut] = []
    for row in rows:
        hydrated = await movement_service.get_movement(conn, user.org_id, row["id"])
        out.append(MovementOut.model_validate(dict(hydrated)))
    return out


@router.get("", response_model=Page[MovementOut])
async def list_movements(
    conn: ConnectionDep,
    user: WriterDep,
    page: PageDep,
    window: TimeRangeDep,
    product_id: uuid.UUID | None = Query(default=None),
    location_id: uuid.UUID | None = Query(default=None),
    type: str | None = Query(default=None),
) -> Page[MovementOut]:
    rows, total = await movement_service.list_movements(
        conn,
        user.org_id,
        limit=page.limit,
        offset=page.offset,
        product_id=product_id,
        location_id=location_id,
        movement_type=type,
        date_from=window.date_from,
        date_to=window.date_to,
    )
    return Page(
        items=[MovementOut.model_validate(dict(r)) for r in rows],
        meta=PageMeta(
            limit=page.limit,
            offset=page.offset,
            total=total,
            has_more=page.offset + len(rows) < total,
        ),
    )


@router.get("/product/{product_id}", response_model=Page[MovementOut])
async def product_history(
    product_id: uuid.UUID, conn: ConnectionDep, user: WriterDep, page: PageDep
) -> Page[MovementOut]:
    # Declared before /{movement_id} so the literal segment wins the match.
    if not await conn.fetchval(
        "SELECT 1 FROM products WHERE id = $1 AND org_id = $2", product_id, user.org_id
    ):
        raise not_found("product")

    rows, total = await movement_service.product_history(
        conn, user.org_id, product_id, limit=page.limit, offset=page.offset
    )
    return Page(
        items=[MovementOut.model_validate(dict(r)) for r in rows],
        meta=PageMeta(
            limit=page.limit,
            offset=page.offset,
            total=total,
            has_more=page.offset + len(rows) < total,
        ),
    )


@router.get("/{movement_id}", response_model=MovementOut)
async def get_movement(movement_id: int, conn: ConnectionDep, user: WriterDep) -> MovementOut:
    record = await movement_service.get_movement(conn, user.org_id, movement_id)
    return MovementOut.model_validate(dict(record))


@router.delete("/{movement_id}", response_model=Message)
async def delete_movement(movement_id: int, conn: ConnectionDep, user: WriterDep) -> Message:
    """Always 405. The ledger is append-only; corrections are reversing adjustments."""
    raise ApiError(
        "movements cannot be deleted; post a reversing adjustment",
        "RESTRICT_VIOLATION",
        409,
    )