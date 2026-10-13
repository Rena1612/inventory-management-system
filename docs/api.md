# API

Base URL `http://localhost:8000`. All request and response bodies are JSON.

## Conventions

**Auth** — `Authorization: Bearer <jwt>` on everything except `/api/health`,
`/api/auth/signup` and `/api/auth/login`.

**Errors** — every failure returns the same envelope:

```json
{ "error": "product not found", "code": "NOT_FOUND" }
```

| Code | Status | Meaning |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | Missing, malformed or expired token |
| `FORBIDDEN` | 403 | Role does not permit the action |
| `NOT_FOUND` | 404 | No such row in this organization |
| `CONFLICT` | 409 | Uniqueness or state conflict |
| `CONSTRAINT_VIOLATION` | 422 | Database check failed (e.g. insufficient stock) |
| `FOREIGN_KEY_VIOLATION` | 409 | Referenced row missing or belongs to another org |
| `RESTRICT_VIOLATION` | 409 | Row is still referenced (append-only ledger) |

Database errors are translated to these codes centrally, so a service never has
to catch them.

**Pagination** — `?limit=20&offset=0`. `limit` is capped at 200. List endpoints
return:

```json
{ "items": [...], "meta": { "limit": 20, "offset": 0, "total": 57, "has_more": true } }
```

**Search** — `?q=term`, a case-insensitive match on name (and SKU, email, or
both, depending on the resource).

**Money and quantities** — `NUMERIC`, serialized as strings to avoid float
drift. Parse on the client.

## Roles

`owner` · `admin` · `member` · `viewer`

Read endpoints accept any role. Writes require `member`, `admin` or `owner`.
Organization and member management require `admin` or `owner`.

---

## Auth

### `POST /api/auth/signup`

Creates an organization and its first user (role `owner`) in one transaction.

```json
{ "org_name": "Acme Logistics", "email": "owner@acme.com",
  "password": "sup3rsecret", "full_name": "Owner" }
```

Password must be at least 8 characters and contain letters and digits.

### `POST /api/auth/login`

```json
{ "email": "owner@acme.com", "password": "sup3rsecret" }
```

Returns `access_token`, `token_type`, `expires_in`, `user`, `organization`.
An unknown email and a wrong password produce the same `401` so the endpoint
is not a user-existence oracle.

### `GET /api/auth/me`

The current user, from the token.

---

## Products

### `POST /api/products`

```json
{ "sku": "WID-001", "name": "Widget A", "cost_price": "12.50",
  "sell_price": "24.99", "reorder_point": "10", "reorder_qty": "50",
  "opening_quantity": "20", "opening_location_id": "<uuid>" }
```

`opening_quantity` is written as an `in` movement with reference
`opening-balance`, never as a direct stock write. Requires both
`opening_quantity` and `opening_location_id` to take effect.

Rejected with `422` if `sell_price` is below `cost_price`.

### `GET /api/products`

`?q=` `?limit=` `?offset=` `?category_id=` `?supplier_id=` `?include_archived=`

### `GET /api/products/{id}`

Product plus a `stock` array with one entry per location.

### `GET /api/products/barcode/{barcode}`

Barcode lookup for scanners.

### `PATCH /api/products/{id}`

Only supplied fields are changed. Rejects a `sku` already used in the
organization, or a `barcode` used by any product.

### `DELETE /api/products/{id}`

Soft delete. `409` if the product still holds stock.
`POST /api/products/{id}/restore` undoes it.

---

## Movements

### `POST /api/movements`

```json
{ "product_id": "<uuid>", "location_id": "<uuid>",
  "type": "in", "quantity": "10", "reference": "PO-1001", "note": null }
```

`type` is `in`, `out` or `adjust`. `adjust` accepts a signed quantity; the
other two require a positive one.

Fails with `422 CONSTRAINT_VIOLATION` if the movement would drive stock below
zero or below the reserved amount. Nothing is written when it fails.

### `POST /api/movements/transfer`

```json
{ "product_id": "<uuid>", "from_location_id": "<uuid>",
  "to_location_id": "<uuid>", "quantity": "12" }
```

Returns both ledger rows, sharing a generated `reference`. Atomic: if the
source cannot cover the quantity, neither row is written.

### `GET /api/movements`

`?product_id=` `?location_id=` `?type=` `?date_from=` `?date_to=` `?limit=` `?offset=`

### `GET /api/movements/product/{product_id}`

Movement history for one product, newest first.

### `DELETE /api/movements/{id}`

Always returns `409 RESTRICT_VIOLATION`. The ledger is append-only; corrections
are posted as reversing `adjust` movements.

---

## Locations, categories, suppliers

Full CRUD for `/api/locations`, `/api/categories` and `/api/suppliers`.
`DELETE` soft-deletes in each case.

- Locations and categories form trees via `parent_id`. A location with stock
  cannot be archived.
- A supplier with open purchase orders cannot be archived.

---

## Purchase orders

### `POST /api/purchase-orders`

```json
{ "supplier_id": "<uuid>", "reference": "PO-2024-01",
  "expected_at": "2024-02-01T00:00:00Z",
  "items": [ { "product_id": "<uuid>", "quantity": "50",
               "unit_cost": "12.50", "location_id": "<uuid>" } ] }
```

Creates the order in status `open` and computes `total`. Duplicate products in
one order are rejected.

### `POST /api/purchase-orders/{id}/receive`

```json
{ "location_id": "<uuid>",
  "items": [ { "product_id": "<uuid>", "received_qty": "50" } ] }
```

Partial receipts are supported. Each received line writes an `in` movement
referencing the order, and the status advances to `partial` or `received`.

The receiving location resolves per line: the item's `location_id`, then the
request-level `location_id`, then the location the line was ordered to.
Omitting `items` receives nothing outstanding.

---

## Reports

### `GET /api/reports/valuation`

`totals` (cost, retail, units, reserved) plus `by_location`.

### `GET /api/reports/low-stock`

Every stock level at or below its product's reorder point, most urgent first,
with suggested order quantity and its cost at the product's `cost_price`.

Products with `reorder_point = 0` are excluded — they have no threshold to
breach, and including them would list the entire catalogue.

### `GET /api/reports/movement-summary`

Counts and quantities by movement type over `?date_from=` / `?date_to=`.

### `GET /api/reports/dashboard`

Composite payload for the dashboard screen: valuation totals, product count,
low-stock count, and the ten most recent movements.

---

## Organizations

`GET /api/orgs/me`, `PATCH /api/orgs/me`, `GET|POST /api/orgs/members`,
`DELETE /api/orgs/members/{id}`, `GET /api/orgs/stats` (usage against plan
limits), `GET /api/orgs/activity`. Member management requires `admin` or
`owner`.