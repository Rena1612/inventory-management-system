from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, status

from app.deps import AdminDep, ConnectionDep, CurrentUserDep
from app.errors import conflict, not_found
from app.models.auth import OrganizationOut, UserOut
from app.models.common import Message

router = APIRouter(prefix="/api/orgs", tags=["orgs"])


@router.get("/me", response_model=OrganizationOut)
async def current_org(conn: ConnectionDep, user: CurrentUserDep) -> OrganizationOut:
    record = await conn.fetchrow("SELECT * FROM organizations WHERE id = $1", user.org_id)
    if record is None:
        raise not_found("organization")
    return OrganizationOut.model_validate(dict(record))


@router.patch("/me", response_model=OrganizationOut)
async def update_org(
    payload: dict, conn: ConnectionDep, user: AdminDep
) -> OrganizationOut:
    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        raise conflict("name is required")
    record = await conn.fetchrow(
        "UPDATE organizations SET name = $2 WHERE id = $1 RETURNING *", user.org_id, name.strip()
    )
    return OrganizationOut.model_validate(dict(record))


@router.get("/members", response_model=list[UserOut])
async def list_members(conn: ConnectionDep, user: AdminDep) -> list[UserOut]:
    rows = await conn.fetch(
        "SELECT * FROM users WHERE org_id = $1 AND archived_at IS NULL ORDER BY created_at",
        user.org_id,
    )
    return [UserOut.model_validate(dict(r)) for r in rows]


@router.post("/members", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def invite_member(payload: dict, conn: ConnectionDep, user: AdminDep) -> UserOut:
    email, password, role = payload.get("email"), payload.get("password"), payload.get("role", "member")
    if role not in {"owner", "admin", "member", "viewer"}:
        raise conflict(f"unknown role '{role}'")
    if await conn.fetchval("SELECT 1 FROM users WHERE email = $1", email):
        raise conflict("email already registered")

    from app.auth import hash_password

    record = await conn.fetchrow(
        """
        INSERT INTO users (org_id, email, password_hash, role)
        VALUES ($1,$2,$3,$4) RETURNING *
        """,
        user.org_id, email, hash_password(str(password)), role,
    )
    return UserOut.model_validate(dict(record))


@router.delete("/members/{user_id}", response_model=Message)
async def remove_member(user_id: uuid.UUID, conn: ConnectionDep, user: AdminDep) -> Message:
    if user_id == user.id:
        raise conflict("cannot remove yourself")
    await conn.execute(
        "UPDATE users SET archived_at = now(), is_active = FALSE WHERE id = $1 AND org_id = $2",
        user_id, user.org_id,
    )
    return Message(message="member removed")


@router.get("/stats")
async def usage_stats(conn: ConnectionDep, user: CurrentUserDep) -> dict:
    products = await conn.fetchval(
        "SELECT count(*) FROM products WHERE org_id = $1 AND archived_at IS NULL", user.org_id
    )
    locations = await conn.fetchval(
        "SELECT count(*) FROM locations WHERE org_id = $1 AND archived_at IS NULL", user.org_id
    )
    plan = await conn.fetchval("SELECT plan FROM organizations WHERE id = $1", user.org_id)
    limits = {
        "free": {"locations": 1, "products": 100},
        "starter": {"locations": 3, "products": 1000},
        "pro": {"locations": 10, "products": 10000},
        "business": {"locations": None, "products": None},
    }
    return {
        "plan": plan,
        "usage": {"products": int(products or 0), "locations": int(locations or 0)},
        "limits": limits.get(str(plan), limits["free"]),
    }


@router.get("/activity")
async def activity(conn: ConnectionDep, user: AdminDep, since: datetime | None = None) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT sm.id, sm.type, sm.quantity, sm.created_at, u.email,
               p.sku AS product_sku
        FROM stock_movements sm
        LEFT JOIN users u ON u.id = sm.user_id
        JOIN products p ON p.id = sm.product_id
        WHERE sm.org_id = $1 AND ($2::timestamptz IS NULL OR sm.created_at >= $2)
        ORDER BY sm.created_at DESC LIMIT 100
        """,
        user.org_id, since,
    )
    return [dict(row) for row in rows]