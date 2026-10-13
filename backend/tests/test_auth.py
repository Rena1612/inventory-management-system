from __future__ import annotations

import httpx


async def test_signup_returns_token_and_tenant(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/auth/signup",
        json={
            "org_name": "Acme Logistics",
            "email": "owner@acme-inventory.com",
            "password": "sup3rsecret",
            "full_name": "Owner",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "owner@acme-inventory.com"
    # First user of a new org owns it.
    assert body["user"]["role"] == "owner"
    assert body["organization"]["name"] == "Acme Logistics"
    assert body["organization"]["slug"] == "acme-logistics"
    assert body["organization"]["plan"] == "free"


async def test_signup_rejects_duplicate_email(client: httpx.AsyncClient) -> None:
    payload = {
        "org_name": "First Co",
        "email": "dup@acme-inventory.com",
        "password": "sup3rsecret",
    }
    assert (await client.post("/api/auth/signup", json=payload)).status_code == 201

    second = await client.post(
        "/api/auth/signup",
        json={"org_name": "Second Co", "email": "dup@acme-inventory.com", "password": "sup3rsecret"},
    )
    assert second.status_code == 409
    assert second.json()["code"] == "CONFLICT"


async def test_signup_rejects_weak_password(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/api/auth/signup",
        json={"org_name": "Acme", "email": "weak@acme-inventory.com", "password": "allletters"},
    )
    assert response.status_code == 422


async def test_login_and_me_round_trip(client: httpx.AsyncClient) -> None:
    await client.post(
        "/api/auth/signup",
        json={"org_name": "Acme", "email": "me@acme-inventory.com", "password": "sup3rsecret"},
    )

    bad = await client.post(
        "/api/auth/login", json={"email": "me@acme-inventory.com", "password": "wrongpassword"}
    )
    assert bad.status_code == 401

    login = await client.post(
        "/api/auth/login", json={"email": "me@acme-inventory.com", "password": "sup3rsecret"}
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "me@acme-inventory.com"


async def test_protected_route_requires_bearer_token(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/products")
    assert response.status_code == 401
    body = response.json()
    assert set(body) == {"error", "code"}
    assert body["code"] == "UNAUTHORIZED"


async def test_rejects_garbage_token(client: httpx.AsyncClient) -> None:
    response = await client.get(
        "/api/products", headers={"Authorization": "Bearer not-a-real-jwt"}
    )
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


async def test_health_is_public(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "up"}