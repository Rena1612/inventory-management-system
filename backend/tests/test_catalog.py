from __future__ import annotations

import uuid

import httpx


async def _make_supplier(auth: httpx.AsyncClient, name: str = "Acme Supply") -> dict:
    created = await auth.post(
        "/api/suppliers", json={"name": name, "email": "sales@acme-inventory.com"}
    )
    assert created.status_code == 201, created.text
    return created.json()


async def test_supplier_list_serializes_org_id(auth: httpx.AsyncClient) -> None:
    """Regression: org_id is a UUID column and must not be typed as str."""
    await _make_supplier(auth)

    listed = await auth.get("/api/suppliers")
    assert listed.status_code == 200, listed.text
    supplier = listed.json()["items"][0]
    assert uuid.UUID(supplier["org_id"])
    assert supplier["name"] == "Acme Supply"


async def test_supplier_search(auth: httpx.AsyncClient) -> None:
    await _make_supplier(auth, "Acme Supply")
    await _make_supplier(auth, "Globex Parts")

    found = await auth.get("/api/suppliers", params={"q": "globex"})
    assert found.status_code == 200
    assert [s["name"] for s in found.json()["items"]] == ["Globex Parts"]


async def test_supplier_update_and_archive(auth: httpx.AsyncClient) -> None:
    supplier = await _make_supplier(auth)

    patched = await auth.patch(f"/api/suppliers/{supplier['id']}", json={"phone": "+1-555-0100"})
    assert patched.status_code == 200, patched.text
    assert patched.json()["phone"] == "+1-555-0100"
    assert patched.json()["name"] == "Acme Supply"

    removed = await auth.delete(f"/api/suppliers/{supplier['id']}")
    assert removed.status_code == 200
    assert (await auth.get("/api/suppliers")).json()["items"] == []


async def test_supplier_with_open_orders_cannot_be_archived(
    auth: httpx.AsyncClient, product: uuid.UUID
) -> None:
    supplier = await _make_supplier(auth)

    created = await auth.post(
        "/api/purchase-orders",
        json={
            "supplier_id": supplier["id"],
            "items": [{"product_id": str(product), "quantity": "5", "unit_cost": "1.00"}],
        },
    )
    assert created.status_code == 201, created.text

    blocked = await auth.delete(f"/api/suppliers/{supplier['id']}")
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "CONFLICT"


async def test_locations_crud(auth: httpx.AsyncClient) -> None:
    warehouse = await auth.post(
        "/api/locations", json={"name": "Main Warehouse", "type": "warehouse", "code": "WH-1"}
    )
    assert warehouse.status_code == 201, warehouse.text
    parent_id = warehouse.json()["id"]

    shelf = await auth.post(
        "/api/locations",
        json={"name": "Aisle A", "type": "shelf", "parent_id": parent_id},
    )
    assert shelf.status_code == 201

    patched = await auth.patch(f"/api/locations/{shelf.json()['id']}", json={"code": "A-1"})
    assert patched.status_code == 200
    assert patched.json()["code"] == "A-1"
    assert patched.json()["parent_id"] == parent_id

    removed = await auth.delete(f"/api/locations/{shelf.json()['id']}")
    assert removed.status_code == 200
    assert len((await auth.get("/api/locations")).json()["items"]) == 1


async def test_location_holding_stock_cannot_be_archived(
    auth: httpx.AsyncClient, product: uuid.UUID, location: uuid.UUID
) -> None:
    movement = await auth.post(
        "/api/movements",
        json={"product_id": str(product), "location_id": str(location), "type": "in", "quantity": "5"},
    )
    assert movement.status_code == 201, movement.text

    blocked = await auth.delete(f"/api/locations/{location}")
    assert blocked.status_code == 409


async def test_categories_crud(auth: httpx.AsyncClient) -> None:
    parent = await auth.post("/api/categories", json={"name": "Hardware"})
    assert parent.status_code == 201, parent.text

    child = await auth.post(
        "/api/categories", json={"name": "Fasteners", "parent_id": parent.json()["id"]}
    )
    assert child.status_code == 201

    listed = await auth.get("/api/categories")
    assert {c["name"] for c in listed.json()} == {"Hardware", "Fasteners"}

    renamed = await auth.patch(f"/api/categories/{child.json()['id']}", json={"name": "Screws"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Screws"

    assert (await auth.delete(f"/api/categories/{child.json()['id']}")).status_code == 200
    assert len((await auth.get("/api/categories")).json()) == 1


async def test_purchase_order_receipt_creates_stock(
    auth: httpx.AsyncClient, product: uuid.UUID, location: uuid.UUID
) -> None:
    supplier = await _make_supplier(auth)

    order = await auth.post(
        "/api/purchase-orders",
        json={
            "supplier_id": supplier["id"],
            "reference": "PO-2026-01",
            "items": [
                {
                    "product_id": str(product),
                    "quantity": "40",
                    "unit_cost": "9.00",
                    "location_id": str(location),
                }
            ],
        },
    )
    assert order.status_code == 201, order.text
    body = order.json()
    assert body["status"] == "open"
    assert float(body["total"]) == 360.0

    received = await auth.post(
        f"/api/purchase-orders/{body['id']}/receive",
        json={
            "location_id": str(location),
            "items": [{"product_id": str(product), "received_qty": "40"}],
        },
    )
    assert received.status_code == 200, received.text
    assert received.json()["status"] == "received"
    assert received.json()["received_at"] is not None

    detail = await auth.get(f"/api/products/{product}")
    assert float(detail.json()["total_quantity"]) == 40.0


async def test_partial_receipt_leaves_order_partial(
    auth: httpx.AsyncClient, product: uuid.UUID, location: uuid.UUID
) -> None:
    supplier = await _make_supplier(auth)
    order = await auth.post(
        "/api/purchase-orders",
        json={
            "supplier_id": supplier["id"],
            "items": [
                {
                    "product_id": str(product),
                    "quantity": "10",
                    "unit_cost": "2.00",
                    "location_id": str(location),
                }
            ],
        },
    )
    po_id = order.json()["id"]

    received = await auth.post(
        f"/api/purchase-orders/{po_id}/receive",
        json={"items": [{"product_id": str(product), "received_qty": "4"}]},
    )
    assert received.status_code == 200, received.text
    assert received.json()["status"] == "partial"

    detail = await auth.get(f"/api/purchase-orders/{po_id}")
    assert float(detail.json()["items"][0]["received_qty"]) == 4.0
    # Receipt omitted a location; the line's own destination is used.
    assert detail.json()["items"][0]["location_id"] == str(location)
    # And the stock actually landed there.
    product_detail = await auth.get(f"/api/products/{product}")
    assert float(product_detail.json()["total_quantity"]) == 4.0


async def test_purchase_order_rejects_unknown_supplier(
    auth: httpx.AsyncClient, product: uuid.UUID
) -> None:
    response = await auth.post(
        "/api/purchase-orders",
        json={
            "supplier_id": str(uuid.uuid4()),
            "items": [{"product_id": str(product), "quantity": "1"}],
        },
    )
    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


async def test_purchase_order_rejects_duplicate_products(
    auth: httpx.AsyncClient, product: uuid.UUID
) -> None:
    supplier = await _make_supplier(auth)
    response = await auth.post(
        "/api/purchase-orders",
        json={
            "supplier_id": supplier["id"],
            "items": [
                {"product_id": str(product), "quantity": "1"},
                {"product_id": str(product), "quantity": "2"},
            ],
        },
    )
    assert response.status_code == 422


async def test_reports_reflect_movements(
    auth: httpx.AsyncClient, product: uuid.UUID, location: uuid.UUID
) -> None:
    await auth.post(
        "/api/movements",
        json={
            "product_id": str(product),
            "location_id": str(location),
            "type": "in",
            "quantity": "10",
        },
    )

    valuation = await auth.get("/api/reports/valuation")
    assert valuation.status_code == 200, valuation.text
    totals = valuation.json()["totals"]
    # cost_price 10.00 x 10 units
    assert float(totals["total_cost_value"]) == 100.0
    assert float(totals["total_retail_value"]) == 200.0
    assert any(row["location_id"] == str(location) for row in valuation.json()["by_location"])

    summary = await auth.get("/api/reports/movement-summary")
    assert summary.status_code == 200
    rows = {row["type"]: row for row in summary.json()["items"]}
    assert rows["in"]["movement_count"] == 1
    assert float(rows["in"]["total_quantity"]) == 10.0


async def test_low_stock_report_lists_below_threshold(
    auth: httpx.AsyncClient, product: uuid.UUID, location: uuid.UUID
) -> None:
    # The seeded product has reorder_point 5.
    await auth.post(
        "/api/movements",
        json={"product_id": str(product), "location_id": str(location), "type": "in", "quantity": "3"},
    )

    report = await auth.get("/api/reports/low-stock")
    assert report.status_code == 200, report.text
    rows = report.json()["items"]
    assert len(rows) == 1
    assert rows[0]["sku"] == "TEST-001"
    assert float(rows[0]["quantity"]) == 3.0
    assert float(rows[0]["reorder_point"]) == 5.0
    assert float(rows[0]["suggested_order_qty"]) == 10.0


async def test_dashboard_payload(auth: httpx.AsyncClient) -> None:
    response = await auth.get("/api/reports/dashboard")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["product_count"] == 0
    assert body["low_stock_count"] == 0
    assert body["recent_movements"] == []


async def test_valuation_csv_export(auth: httpx.AsyncClient, location: uuid.UUID) -> None:
    response = await auth.get("/api/reports/export/valuation")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/csv")
    header, *rows = response.text.strip().splitlines()
    assert header.startswith("location_id,location_name")
    assert any(str(location) in row for row in rows)


async def test_org_stats_reports_plan_limits(auth: httpx.AsyncClient) -> None:
    response = await auth.get("/api/orgs/stats")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["plan"] == "free"
    assert body["limits"] == {"locations": 1, "products": 100}
    assert body["usage"] == {"products": 0, "locations": 0}


async def test_cross_tenant_access_is_refused(
    auth: httpx.AsyncClient, rival: httpx.AsyncClient
) -> None:
    supplier = await _make_supplier(auth)

    assert (await rival.get(f"/api/suppliers/{supplier['id']}")).status_code == 404
    assert (await rival.patch(f"/api/suppliers/{supplier['id']}", json={"name": "X"})).status_code == 404
    # Listings never leak across the boundary.
    assert (await rival.get("/api/suppliers")).json()["items"] == []


async def test_archived_purchase_order_404s_by_direct_link(
    auth: httpx.AsyncClient, product: uuid.UUID
) -> None:
    """Soft-deleted orders must be unreachable, not just hidden from the list."""
    supplier = await _make_supplier(auth)
    order = await auth.post(
        "/api/purchase-orders",
        json={
            "supplier_id": supplier["id"],
            "items": [{"product_id": str(product), "quantity": "1"}],
        },
    )
    po_id = order.json()["id"]

    assert (await auth.get(f"/api/purchase-orders/{po_id}")).status_code == 200

    assert (await auth.delete(f"/api/purchase-orders/{po_id}")).status_code == 200

    gone = await auth.get(f"/api/purchase-orders/{po_id}")
    assert gone.status_code == 404
    assert gone.json()["code"] == "NOT_FOUND"

    # And it is gone from the list too.
    listed = await auth.get("/api/purchase-orders")
    assert po_id not in [o["id"] for o in listed.json()["items"]]


async def test_movement_delta_reaches_the_http_response(
    auth: httpx.AsyncClient, product: uuid.UUID, location: uuid.UUID
) -> None:
    """Regression: MovementOut lacked `delta`, so FastAPI stripped it.

    The service computed the signed effect but the response model did not
    declare it, so every client received no `delta` at all. This asserts on
    the serialised JSON, not the service return value.
    """
    await auth.post("/api/locations", json={"name": "Delta Destination", "type": "shelf"})
    locations = (await auth.get("/api/locations", params={"limit": 100})).json()["items"]
    destination_id = next(item["id"] for item in locations if item["name"] == "Delta Destination")

    for kind, quantity in (("in", 30), ("out", 6), ("adjust", -3)):
        created = await auth.post(
            "/api/movements",
            json={
                "product_id": str(product),
                "location_id": str(location),
                "type": kind,
                "quantity": str(quantity),
            },
        )
        assert created.status_code == 201, created.text

    moved = await auth.post(
        "/api/movements/transfer",
        json={
            "product_id": str(product),
            "from_location_id": str(location),
            "to_location_id": destination_id,
            "quantity": "5",
        },
    )
    assert moved.status_code == 201, moved.text

    listed = await auth.get("/api/movements", params={"limit": 100})
    assert listed.status_code == 200
    rows = listed.json()["items"]

    # Present on the wire, not just in the service layer.
    assert all("delta" in row for row in rows), "delta missing from the JSON payload"

    by_type: dict[str, float] = {}
    for row in rows:
        by_type.setdefault(row["type"], float(row["delta"]))

    assert by_type["in"] > 0
    assert by_type["out"] < 0
    assert by_type["transfer_out"] < 0
    assert by_type["transfer_in"] > 0
    assert by_type["adjust"] < 0

    # `quantity` stays a positive magnitude; only `delta` carries the sign.
    out_row = next(row for row in rows if row["type"] == "out")
    assert float(out_row["quantity"]) == 6.0
    assert float(out_row["delta"]) == -6.0


async def test_unknown_ids_return_404(auth: httpx.AsyncClient) -> None:
    missing = str(uuid.uuid4())
    assert (await auth.patch(f"/api/suppliers/{missing}", json={"name": "X"})).status_code == 404
    assert (await auth.delete(f"/api/suppliers/{missing}")).status_code == 404