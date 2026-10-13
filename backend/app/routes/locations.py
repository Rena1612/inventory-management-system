from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.deps import ConnectionDep, PageDep, SearchDep, WriterDep
from app.errors import conflict, not_found
from app.models.common import Message, Page, PageMeta
from app.models.location import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    LocationCreate,
    LocationOut,
    LocationUpdate,
)
from app.sql import build_update

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
async def create_location(payload: LocationCreate, conn: ConnectionDep, user: WriterDep) -> LocationOut:
    record = await conn.fetchrow(
        """
        INSERT INTO locations (org_id, name, code, type, address, parent_id)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
        """,
        user.org_id,
        payload.name,
        payload.code,
        payload.type,
        payload.address,
        payload.parent_id,
    )
    return LocationOut.model_validate(dict(record))


@router.get("", response_model=Page[LocationOut])
async def list_locations(
    conn: ConnectionDep, user: WriterDep, page: PageDep, search: SearchDep
) -> Page[LocationOut]:
    where = ["org_id = $1", "archived_at IS NULL"]
    args: list[object] = [user.org_id]
    if search.q:
        args.append(f"%{search.q}%")
        where.append(f"name ILIKE ${len(args)}")

    clause = " AND ".join(where)
    total = await conn.fetchval(f"SELECT count(*) FROM locations WHERE {clause}", *args)
    args.extend([page.limit, page.offset])
    rows = await conn.fetch(
        f"SELECT * FROM locations WHERE {clause} ORDER BY name LIMIT ${len(args)-1} OFFSET ${len(args)}",
        *args,
    )
    return Page(
        items=[LocationOut.model_validate(dict(r)) for r in rows],
        meta=PageMeta(limit=page.limit, offset=page.offset, total=int(total or 0),
                      has_more=page.offset + len(rows) < int(total or 0)),
    )


@router.get("/{location_id}", response_model=LocationOut)
async def get_location(location_id: uuid.UUID, conn: ConnectionDep, user: WriterDep) -> LocationOut:
    record = await conn.fetchrow(
        "SELECT * FROM locations WHERE id = $1 AND org_id = $2", location_id, user.org_id
    )
    if record is None:
        raise not_found("location")
    return LocationOut.model_validate(dict(record))


@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(
    location_id: uuid.UUID, payload: LocationUpdate, conn: ConnectionDep, user: WriterDep
) -> LocationOut:
    query, args = build_update(
        "locations",
        payload.model_dump(exclude_unset=True),
        row_id=location_id,
        org_id=user.org_id,
    )
    record = await conn.fetchrow(query, *args)
    if record is None:
        raise not_found("location")
    return LocationOut.model_validate(dict(record))


@router.delete("/{location_id}", response_model=Message)
async def archive_location(location_id: uuid.UUID, conn: ConnectionDep, user: WriterDep) -> Message:
    holding = await conn.fetchval(
        "SELECT COALESCE(SUM(quantity),0) FROM stock_levels WHERE location_id = $1", location_id
    )
    if holding and float(holding) != 0:
        raise conflict("cannot archive a location that still holds stock")

    result = await conn.execute(
        "UPDATE locations SET archived_at = now() WHERE id = $1 AND org_id = $2 AND archived_at IS NULL",
        location_id,
        user.org_id,
    )
    if result == "UPDATE 0":
        raise not_found("location")
    return Message(message="location archived")


categories_router = APIRouter(prefix="/api/categories", tags=["categories"])


@categories_router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(payload: CategoryCreate, conn: ConnectionDep, user: WriterDep) -> CategoryOut:
    record = await conn.fetchrow(
        "INSERT INTO categories (org_id, name, description, parent_id) VALUES ($1,$2,$3,$4) RETURNING *",
        user.org_id, payload.name, payload.description, payload.parent_id,
    )
    return CategoryOut.model_validate(dict(record))


@categories_router.get("", response_model=list[CategoryOut])
async def list_categories(conn: ConnectionDep, user: WriterDep) -> list[CategoryOut]:
    rows = await conn.fetch(
        "SELECT * FROM categories WHERE org_id = $1 AND archived_at IS NULL ORDER BY name",
        user.org_id,
    )
    return [CategoryOut.model_validate(dict(r)) for r in rows]


@categories_router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: uuid.UUID, payload: CategoryUpdate, conn: ConnectionDep, user: WriterDep
) -> CategoryOut:
    query, args = build_update(
        "categories",
        payload.model_dump(exclude_unset=True),
        row_id=category_id,
        org_id=user.org_id,
    )
    record = await conn.fetchrow(query, *args)
    if record is None:
        raise not_found("category")
    return CategoryOut.model_validate(dict(record))


@categories_router.delete("/{category_id}", response_model=Message)
async def archive_category(category_id: uuid.UUID, conn: ConnectionDep, user: WriterDep) -> Message:
    await conn.execute(
        "UPDATE categories SET archived_at = now() WHERE id = $1 AND org_id = $2",
        category_id, user.org_id,
    )
    return Message(message="category archived")