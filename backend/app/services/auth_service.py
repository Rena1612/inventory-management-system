from __future__ import annotations

import re
import uuid

import asyncpg

from app.auth import create_access_token, hash_password, verify_password
from app.config import get_settings
from app.errors import conflict, unauthorized
from app.models.auth import LoginRequest, SignupRequest

SLUG_STRIP = re.compile(r"[^a-z0-9]+")


async def _slugify(name: str) -> str:
    base = SLUG_STRIP.sub("-", name.lower()).strip("-") or "org"
    candidate = base
    suffix = 1
    while await _slug_taken(candidate):
        suffix += 1
        candidate = f"{base}-{suffix}"
    return candidate


async def _slug_taken(slug: str) -> bool:
    return bool(await get_pool_fetchval(slug))


async def get_pool_fetchval(slug: str) -> object | None:
    from app.db import fetchval

    return await fetchval("SELECT 1 FROM organizations WHERE slug = $1", slug)


async def signup(conn: asyncpg.Connection, payload: SignupRequest) -> tuple[asyncpg.Record, asyncpg.Record]:
    slug = await _slugify(payload.org_name)

    if await conn.fetchval("SELECT 1 FROM users WHERE email = $1", payload.email):
        raise conflict("email already registered")

    org = await conn.fetchrow(
        "INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING *",
        payload.org_name,
        slug,
    )
    user = await conn.fetchrow(
        """
        INSERT INTO users (org_id, email, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4, 'owner')
        RETURNING *
        """,
        org["id"],
        payload.email,
        hash_password(payload.password),
        payload.full_name,
    )
    if user is None or org is None:  # pragma: no cover
        raise RuntimeError("signup insert returned no row")
    return org, user


async def login(conn: asyncpg.Connection, payload: LoginRequest) -> tuple[asyncpg.Record, asyncpg.Record]:
    row = await conn.fetchrow(
        """
        SELECT u.*, o.name AS org_name, o.slug AS org_slug, o.plan AS org_plan,
               o.created_at AS org_created_at
        FROM users u
        JOIN organizations o ON o.id = u.org_id
        WHERE u.email = $1 AND u.archived_at IS NULL AND u.is_active
        """,
        payload.email,
    )
    # Same error for unknown user and bad password so the endpoint is not an oracle.
    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise unauthorized("invalid email or password")

    org = {
        "id": row["org_id"],
        "name": row["org_name"],
        "slug": row["org_slug"],
        "plan": row["org_plan"],
        "created_at": row["org_created_at"],
    }
    return org, row


async def issue_token(user: asyncpg.Record, org: dict) -> dict:
    settings = get_settings()
    return {
        "access_token": create_access_token(user["id"], user["org_id"], user["role"]),
        "token_type": "bearer",
        "expires_in": settings.access_token_ttl_minutes * 60,
    }


async def get_user(conn: asyncpg.Connection, user_id: uuid.UUID) -> asyncpg.Record:
    row = await conn.fetchrow(
        "SELECT * FROM users WHERE id = $1 AND archived_at IS NULL", user_id
    )
    if row is None:
        raise unauthorized("user no longer exists")
    return row


async def get_org(conn: asyncpg.Connection, org_id: uuid.UUID) -> asyncpg.Record:
    row = await conn.fetchrow("SELECT * FROM organizations WHERE id = $1", org_id)
    if row is None:
        raise unauthorized("organization no longer exists")
    return row