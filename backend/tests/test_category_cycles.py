from __future__ import annotations

import httpx


async def _make(client: httpx.AsyncClient, name: str, parent_id: str | None = None) -> str:
    resp = await client.post("/api/categories", json={"name": name, "parent_id": parent_id})
    assert resp.status_code == 201, resp.text
    return str(resp.json()["id"])


async def test_self_parent_rejected(auth: httpx.AsyncClient) -> None:
    a = await _make(auth, "A")
    resp = await auth.patch(f"/api/categories/{a}", json={"parent_id": a})
    assert resp.status_code == 409, resp.text
    assert "own parent" in resp.text


async def test_direct_cycle_rejected(auth: httpx.AsyncClient) -> None:
    a = await _make(auth, "A")
    b = await _make(auth, "B", a)
    resp = await auth.patch(f"/api/categories/{a}", json={"parent_id": b})
    assert resp.status_code == 409, resp.text
    assert "descendants" in resp.text


async def test_three_level_cycle_rejected(auth: httpx.AsyncClient) -> None:
    a = await _make(auth, "A")
    b = await _make(auth, "B", a)
    c = await _make(auth, "C", b)
    resp = await auth.patch(f"/api/categories/{a}", json={"parent_id": c})
    assert resp.status_code == 409, resp.text
    assert "descendants" in resp.text
    # Nothing was written: A is still a root.
    listed = {x["name"]: x["parent_id"] for x in (await auth.get("/api/categories")).json()}
    assert listed["A"] is None


async def test_valid_reparent_still_works(auth: httpx.AsyncClient) -> None:
    a = await _make(auth, "A")
    b = await _make(auth, "B", a)
    c = await _make(auth, "C")
    resp = await auth.patch(f"/api/categories/{b}", json={"parent_id": c})
    assert resp.status_code == 200, resp.text
    assert resp.json()["parent_id"] == c


async def test_create_with_unknown_parent_is_404(auth: httpx.AsyncClient) -> None:
    resp = await auth.post(
        "/api/categories",
        json={"name": "X", "parent_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert resp.status_code == 404, resp.text


async def test_cross_tenant_parent_is_404(auth: httpx.AsyncClient, rival: httpx.AsyncClient) -> None:
    foreign = await _make(rival, "Foreign")
    created = await auth.post("/api/categories", json={"name": "Mine", "parent_id": foreign})
    assert created.status_code == 404, created.text

    mine = await _make(auth, "Mine")
    patched = await auth.patch(f"/api/categories/{mine}", json={"parent_id": foreign})
    assert patched.status_code == 404, patched.text
