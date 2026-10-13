from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.deps import ConnectionDep, PageDep, SearchDep, WriterDep
from app.errors import conflict, not_found
from app.models.common import Message, Page, PageMeta
from app.models.supplier import SupplierCreate, SupplierOut, SupplierUpdate
from app.sql import build_update

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(payload: SupplierCreate, conn: ConnectionDep, user: WriterDep) -> SupplierOut:
    record = await conn.fetchrow(
        """
        INSERT INTO suppliers (org_id, name, email, phone, address, notes)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
        """,
        user.org_id, payload.name, payload.email, payload.phone, payload.address, payload.notes,
    )
    return SupplierOut.model_validate(dict(record))


@router.get("", response_model=Page[SupplierOut])
async def list_suppliers(
    conn: ConnectionDep, user: WriterDep, page: PageDep, search: SearchDep
) -> Page[SupplierOut]:
    where = ["org_id = $1", "archived_at IS NULL"]
    args: list[object] = [user.org_id]
    if search.q:
        args.append(f"%{search.q}%")
        where.append(f"(name ILIKE ${len(args)} OR email ILIKE ${len(args)})")

    clause = " AND ".join(where)
    total = await conn.fetchval(f"SELECT count(*) FROM suppliers WHERE {clause}", *args)
    args.extend([page.limit, page.offset])
    rows = await conn.fetch(
        f"SELECT * FROM suppliers WHERE {clause} ORDER BY name LIMIT ${len(args)-1} OFFSET ${len(args)}",
        *args,
    )
    return Page(
        items=[SupplierOut.model_validate(dict(r)) for r in rows],
        meta=PageMeta(limit=page.limit, offset=page.offset, total=int(total or 0),
                      has_more=page.offset + len(rows) < int(total or 0)),
    )


@router.get("/{supplier_id}", response_model=SupplierOut)
async def get_supplier(supplier_id: uuid.UUID, conn: ConnectionDep, user: WriterDep) -> SupplierOut:
    record = await conn.fetchrow(
        "SELECT * FROM suppliers WHERE id = $1 AND org_id = $2", supplier_id, user.org_id
    )
    if record is None:
        raise not_found("supplier")
    return SupplierOut.model_validate(dict(record))


@router.patch("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: uuid.UUID, payload: SupplierUpdate, conn: ConnectionDep, user: WriterDep
) -> SupplierOut:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return await get_supplier(supplier_id, conn, user)

    query, args = build_update("suppliers", fields, row_id=supplier_id, org_id=user.org_id)
    record = await conn.fetchrow(query, *args)
    if record is None:
        raise not_found("supplier")
    return SupplierOut.model_validate(dict(record))


@router.delete("/{supplier_id}", response_model=Message)
async def archive_supplier(supplier_id: uuid.UUID, conn: ConnectionDep, user: WriterDep) -> Message:
    open_pos = await conn.fetchval(
        "SELECT count(*) FROM purchase_orders WHERE supplier_id = $1 AND status IN ('draft','open','partial')",
        supplier_id,
    )
    if open_pos:
        raise conflict("supplier has open purchase orders")

    result = await conn.execute(
        "UPDATE suppliers SET archived_at = now() WHERE id = $1 AND org_id = $2 AND archived_at IS NULL",
        supplier_id, user.org_id,
    )
    if result == "UPDATE 0":
        raise not_found("supplier")
    return Message(message="supplier archived")