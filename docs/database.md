# Database

PostgreSQL 15+. Requires `pgcrypto`, `citext` and `pg_trgm`, all installed by
`001_initial.sql`.

## Design rules

1. **`stock_movements` is append-only.** A `BEFORE UPDATE OR DELETE` trigger
   raises on any attempt to rewrite history. Corrections are posted as reversing
   `adjust` movements, never as edits.
2. **`stock_levels` is derived.** The `apply_stock_movement()` trigger maintains
   it from the ledger. No application code writes to it.
3. **Everything is scoped by `org_id`.** Applied in the service layer. See
   [Optional: row level security](#optional-row-level-security).

## Tables

| Table | Notes |
| --- | --- |
| `organizations` | Tenant root. `slug` unique, `plan` for the pricing tiers. |
| `users` | `email` is unique **globally** — it is the login identifier. |
| `categories` | Self-referencing tree. |
| `locations` | Self-referencing tree: warehouse → zone → shelf → bin. |
| `suppliers` | Free-form contact records. |
| `products` | `UNIQUE (org_id, sku)`, partial unique on `barcode`. |
| `stock_levels` | `UNIQUE (product_id, location_id)`, one row per pair. |
| `stock_movements` | `BIGSERIAL` id, append-only, carries `org_id` for tenant scoping. |
| `purchase_orders` | Status flows draft → open → partial → received. |
| `purchase_order_items` | Tracks `received_qty` against ordered `quantity`. |

`stock_levels` carries a denormalized `org_id` (populated by the trigger). It is
not in the original field list, but without it the low-stock report cannot be
scoped to a tenant without joining back through `products`.

## Movement types

| Type | Quantity sign | Effect |
| --- | --- | --- |
| `in` | positive | `+quantity` |
| `out` | positive | `-quantity` |
| `adjust` | **signed** | `+quantity` (may be negative) |
| `transfer_in` | positive | `+quantity` |
| `transfer_out` | positive | `-quantity` |

A transfer is **two rows** sharing a `reference`, inserted in a single
statement: `transfer_out` at the source, `transfer_in` at the destination. If
the source cannot cover it the whole statement fails, so neither leg survives
and total units on hand never change.

`adjust` carries a signed delta rather than a target level, so every movement
type reduces to one `+quantity` / `-quantity` decision in the trigger.

## The trigger

`apply_stock_movement()` runs `AFTER INSERT` on `stock_movements` and:

1. Verifies the product and the location both belong to the movement's `org_id`
   — a second line of defence behind every scoped query.
2. Computes the signed delta from the movement type.
3. Upserts `stock_levels` and reads back the resulting quantity and reserved.
4. Raises if the quantity would go negative, or below what is reserved.

Raising inside the trigger rolls back the whole transaction, so the ledger and
the derived state are always consistent.

### Why there is no `CHECK (reserved <= quantity)`

`ON CONFLICT DO UPDATE` evaluates table CHECK constraints against the
*proposed* row before conflict resolution. With an insert-then-update pattern,
decrementing from 10 to 6 proposes a row of `quantity = -4`, which fails
`0 <= -4` even though the final state is valid. The check therefore lives in the
trigger, where the post-update values are actually available.

## Migrations

Plain `.sql` in `backend/migrations`, applied in filename order and recorded in
`schema_migrations`. Each file is a single transaction.

```bash
python scripts/migrate.py
```

There is no down-migration mechanism. Rolling back means writing a new forward
migration.

## Soft delete

`products`, `locations`, `categories`, `suppliers` and `purchase_orders` soft
delete via `archived_at`. The ledger (`stock_movements`) has no soft delete —
rows there are permanent by design.

Products and locations holding non-zero stock cannot be archived; the API
returns `409 CONFLICT`.

## Optional: row level security

Tenant scoping currently lives in the service layer. To harden it at the
database, add policies that read a transaction-local setting:

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_tenant ON products
  USING (org_id = current_setting('app.current_org')::uuid);
```

Then issue `SET LOCAL app.current_org = $1` at the top of every transaction in
`app/db.py`. The pooling is safe because `SET LOCAL` is scoped to the
transaction.