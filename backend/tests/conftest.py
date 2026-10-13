from __future__ import annotations

import os
import pathlib
import sys
import uuid
from collections.abc import AsyncIterator

import asyncpg
import httpx
import pytest_asyncio

os.environ.setdefault(
    "DATABASE_URL", "postgresql://inventory:inventory@localhost:5433/inventory_test"
)
os.environ.setdefault("JWT_SECRET", "test-secret-that-is-at-least-32-characters-long")

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.auth import create_access_token, hash_password  # noqa: E402
from app.db import close_pool, connection, create_pool, get_pool  # noqa: E402

TRUNCATE = """
TRUNCATE organizations, users, locations, categories, suppliers, products
RESTART IDENTITY CASCADE
"""


@pytest_asyncio.fixture(autouse=True)
async def db_pool() -> AsyncIterator[asyncpg.Pool]:
    """Pool per test so it lives on that test's event loop; truncate afterwards."""
    await create_pool()
    yield get_pool()
    try:
        async with connection() as conn:
            await conn.execute(TRUNCATE)
    finally:
        await close_pool()


@pytest_asyncio.fixture
async def client(db_pool: asyncpg.Pool) -> AsyncIterator[httpx.AsyncClient]:
    """Unauthenticated ASGI client driving the real app and its exception handlers."""
    from main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


def _authenticated(token: str) -> httpx.AsyncClient:
    from main import app

    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://test",
                             headers={"Authorization": f"Bearer {token}"})


@pytest_asyncio.fixture
async def org_and_user(db_pool: asyncpg.Pool) -> tuple[uuid.UUID, uuid.UUID]:
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    async with connection() as conn:
        await conn.execute(
            "INSERT INTO organizations (id, name, slug) VALUES ($1, 'Test Org', $2)",
            org_id,
            f"test-{org_id.hex[:8]}",
        )
        await conn.execute(
            """
            INSERT INTO users (id, org_id, email, password_hash, role)
            VALUES ($1, $2, $3, $4, 'owner')
            """,
            user_id,
            org_id,
            f"owner-{user_id.hex[:8]}@test.local",
            hash_password("password123"),
        )
    return org_id, user_id


@pytest_asyncio.fixture
async def token(org_and_user: tuple[uuid.UUID, uuid.UUID]) -> str:
    org_id, user_id = org_and_user
    return create_access_token(user_id, org_id, "owner")


@pytest_asyncio.fixture
async def auth(client: httpx.AsyncClient, token: str) -> AsyncIterator[httpx.AsyncClient]:
    """Its own client carrying a bearer token for the seeded owner."""
    async with _authenticated(token) as http:
        yield http


@pytest_asyncio.fixture
async def rival(db_pool: asyncpg.Pool) -> AsyncIterator[httpx.AsyncClient]:
    """A separate organization and client, for tenancy assertions."""
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    async with connection() as conn:
        await conn.execute(
            "INSERT INTO organizations (id, name, slug) VALUES ($1, 'Rival Org', $2)",
            org_id,
            f"rival-{org_id.hex[:8]}",
        )
        await conn.execute(
            """
            INSERT INTO users (id, org_id, email, password_hash, role)
            VALUES ($1, $2, $3, $4, 'owner')
            """,
            user_id,
            org_id,
            f"rival-{user_id.hex[:8]}@test.local",
            hash_password("password123"),
        )
    async with _authenticated(create_access_token(user_id, org_id, "owner")) as http:
        yield http


@pytest_asyncio.fixture
async def location(org_and_user: tuple[uuid.UUID, uuid.UUID]) -> uuid.UUID:
    org_id, _ = org_and_user
    location_id = uuid.uuid4()
    async with connection() as conn:
        await conn.execute(
            "INSERT INTO locations (id, org_id, name, type) VALUES ($1,$2,'Test Shelf','shelf')",
            location_id,
            org_id,
        )
    return location_id


@pytest_asyncio.fixture
async def product(org_and_user: tuple[uuid.UUID, uuid.UUID]) -> uuid.UUID:
    org_id, _ = org_and_user
    product_id = uuid.uuid4()
    async with connection() as conn:
        await conn.execute(
            """
            INSERT INTO products (id, org_id, sku, name, cost_price, sell_price,
                                  reorder_point, reorder_qty)
            VALUES ($1,$2,'TEST-001','Test Product',10.00,20.00,5,10)
            """,
            product_id,
            org_id,
        )
    return product_id