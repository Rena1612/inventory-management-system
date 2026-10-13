from __future__ import annotations

import uuid

import httpx


async def test_create_and_fetch_product(auth: httpx.AsyncClient, location: uuid.UUID) -> None:
    created = await auth.post(
        "/api/products",
        json={
            "sku": "WID-001",
            "name": "Widget A",
            "cost_price": "12.50",
            "sell_price": "24.99",
            "reorder_point": "10",
            "reorder_qty": "50",
            "barcode": "9312345678907",
            "opening_quantity": "20",
            "opening_location_id": str(location),
        },
    )
    assert created.status_code == 201, created.text
    product = created.json()
    assert product["sku"] == "WID-001"
    # The opening balance flows through the ledger, so it shows up in derived stock.
    assert float(product["total_quantity"]) == 20.0

    detail = await auth.get(f"/api/products/{product['id']}")
    assert detail.status_code == 200
    body = detail.json()
    assert len(body["stock"]) == 1
    assert body["stock"][0]["location_name"] == "Test Shelf"
    assert float(body["stock"][0]["quantity"]) == 20.0


async def test_duplicate_sku_is_rejected(auth: httpx.AsyncClient) -> None:
    payload = {"sku": "DUP-1", "name": "First"}
    assert (await auth.post("/api/products", json=payload)).status_code == 201

    second = await auth.post("/api/products", json={"sku": "DUP-1", "name": "Second"})
    assert second.status_code == 409
    assert second.json()["code"] == "CONFLICT"


async def test_sell_price_below_cost_is_rejected(auth: httpx.AsyncClient) -> None:
    response = await auth.post(
        "/api/products",
        json={
            "sku": "BAD-1",
            "name": "Bad pricing",
            "cost_price": "100",
            "sell_price": "50",
        },
    )
    assert response.status_code == 422


async def test_search_and_pagination(auth: httpx.AsyncClient) -> None:
    for index in range(5):
        await auth.post("/api/products", json={"sku": f"SEARCH-{index}", "name": f"Widget {index}"})

    hits = await auth.get("/api/products", params={"q": "Widget 3"})
    assert hits.status_code == 200
    assert hits.json()["meta"]["total"] == 1

    page = await auth.get("/api/products", params={"limit": 2, "offset": 0})
    body = page.json()
    assert len(body["items"]) == 2
    assert body["meta"]["total"] == 5
    assert body["meta"]["has_more"] is True

    tail = await auth.get("/api/products", params={"limit": 2, "offset": 4})
    assert len(tail.json()["items"]) == 1
    assert tail.json()["meta"]["has_more"] is False


async def test_limit_is_capped(auth: httpx.AsyncClient) -> None:
    response = await auth.get("/api/products", params={"limit": 5000})
    assert response.status_code == 422


async def test_lookup_by_barcode(auth: httpx.AsyncClient) -> None:
    created = await auth.post(
        "/api/products",
        json={"sku": "BAR-1", "name": "Barcoded", "barcode": "5012345678900"},
    )
    product_id = created.json()["id"]

    found = await auth.get("/api/products/barcode/5012345678900")
    assert found.status_code == 200
    assert found.json()["id"] == product_id

    missing = await auth.get("/api/products/barcode/0000000000000")
    assert missing.status_code == 404
    assert missing.json()["code"] == "NOT_FOUND"


async def test_patch_updates_only_supplied_fields(auth: httpx.AsyncClient) -> None:
    created = await auth.post("/api/products", json={"sku": "PATCH-1", "name": "Original"})
    product_id = created.json()["id"]

    patched = await auth.patch(f"/api/products/{product_id}", json={"name": "Renamed"})
    assert patched.status_code == 200
    assert patched.json()["name"] == "Renamed"
    assert patched.json()["sku"] == "PATCH-1"


async def test_delete_is_a_soft_delete(auth: httpx.AsyncClient) -> None:
    created = await auth.post("/api/products", json={"sku": "GONE-1", "name": "Doomed"})
    product_id = created.json()["id"]

    deleted = await auth.delete(f"/api/products/{product_id}")
    assert deleted.status_code == 200
    assert deleted.json() == {"message": "product archived"}

    listed = await auth.get("/api/products", params={"include_archived": True})
    assert product_id in [item["id"] for item in listed.json()["items"]]

    default_list = await auth.get("/api/products")
    assert product_id not in [item["id"] for item in default_list.json()["items"]]


async def test_cannot_archive_product_holding_stock(
    auth: httpx.AsyncClient, location: uuid.UUID
) -> None:
    created = await auth.post(
        "/api/products",
        json={
            "sku": "HELD-1",
            "name": "Holding stock",
            "opening_quantity": "5",
            "opening_location_id": str(location),
        },
    )
    response = await auth.delete(f"/api/products/{created.json()['id']}")
    assert response.status_code == 409
    assert response.json()["code"] == "CONFLICT"


async def test_products_are_isolated_between_tenants(
    auth: httpx.AsyncClient, rival: httpx.AsyncClient
) -> None:
    mine = await auth.post("/api/products", json={"sku": "PRIVATE-1", "name": "Secret"})
    product_id = mine.json()["id"]

    # Same SKU is fine in a different org: uniqueness is per (org_id, sku).
    theirs = await rival.post("/api/products", json={"sku": "PRIVATE-1", "name": "Theirs"})
    assert theirs.status_code == 201
    assert theirs.json()["id"] != product_id

    # But the other org cannot read or mutate the first org's row.
    assert (await rival.get(f"/api/products/{product_id}")).status_code == 404
    assert (await rival.patch(f"/api/products/{product_id}", json={"name": "Hijack"})).status_code == 404

    listed = await rival.get("/api/products")
    assert [item["id"] for item in listed.json()["items"]] == [theirs.json()["id"]]


async def test_insufficient_stock_maps_to_error_envelope(
    auth: httpx.AsyncClient, location: uuid.UUID
) -> None:
    created = await auth.post(
        "/api/products",
        json={"sku": "LOW-1", "name": "Low stock"},
    )
    product_id = created.json()["id"]

    response = await auth.post(
        "/api/movements",
        json={
            "product_id": product_id,
            "location_id": str(location),
            "type": "out",
            "quantity": "5",
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"error", "code"}
    assert body["code"] == "CONSTRAINT_VIOLATION"
    assert "insufficient stock" in body["error"]