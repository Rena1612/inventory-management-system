You are a senior full-stack engineer. I'm building a SaaS inventory management system. I need you to generate the full project scaffold, schema, and code.

## PROJECT BRIEF

**Name:** Inventory Management System
**Stack:** FastAPI (Python) + PostgreSQL + Next.js (TypeScript)
**Goal:** Multi-tenant SaaS. V1 in 6 weeks. Simple. Postgres-native.

## ARCHITECTURE

**Backend (FastAPI):**
- /api/auth — signup, login, JWT
- /api/products — CRUD
- /api/locations — warehouses, shelves
- /api/movements — stock in/out/adjust
- /api/purchase-orders — create, receive
- /api/reports — valuation, low stock
- /api/orgs — multi-tenancy

**Database (PostgreSQL):**
Tables: organizations, users, locations, categories, suppliers, products, stock_levels, stock_movements, purchase_orders, purchase_order_items

Rules:
- stock_movements is append-only (ledger)
- stock_levels is derived from movements via trigger
- All queries scoped by org_id

**Frontend (Next.js):**
- / — landing
- /login — auth
- /dashboard — low stock, recent movements
- /products — list, search, add, edit
- /products/[id] — stock across locations, history
- /movements — record in/out
- /locations — manage warehouses
- /suppliers — contact list
- /purchase-orders — create, receive
- /reports — valuation, low stock
- /settings — users, API keys

## CONVENTIONS

**Python:**
- FastAPI + Pydantic
- asyncpg for DB (no ORM)
- Type hints everywhere
- Small functions, one job each
- Services layer for business logic

**TypeScript:**
- Next.js App Router
- shadcn/ui + Tailwind
- Server components where possible
- No `any` types

**Database:**
- UUID primary keys
- created_at, updated_at timestamps
- Soft delete via archived_at
- Foreign keys with ON DELETE CASCADE
- Indexes on org_id, product_id, created_at

**API:**
- REST, JSON
- Auth via Authorization: Bearer <jwt>
- Errors: { "error": "message", "code": "CODE" }
- Pagination: ?limit=20&offset=0
- Search: ?q=term

## SCHEMA

Give me the full SQL for these tables:

organizations (id, name, created_at)
users (id, org_id, email, password_hash, role, created_at)
locations (id, org_id, name, parent_id, type, created_at)
categories (id, org_id, name, parent_id)
suppliers (id, org_id, name, email, phone, address, notes, created_at)
products (id, org_id, sku, barcode, name, description, category_id, supplier_id, unit, cost_price, sell_price, reorder_point, reorder_qty, track_serial, track_batch, metadata JSONB, created_at, updated_at)
stock_levels (id, product_id, location_id, quantity, reserved, updated_at)
stock_movements (id BIGSERIAL, org_id, product_id, location_id, type, quantity, reference, note, user_id, created_at)
purchase_orders (id, org_id, supplier_id, status, reference, expected_at, received_at, total, notes, created_at)
purchase_order_items (id, po_id, product_id, quantity, received_qty, unit_cost)

Include:
- All indexes
- Unique constraints (org_id + sku, product_id + location_id)
- Trigger: apply_stock_movement() — updates stock_levels on insert to stock_movements

## ENDPOINTS

Generate FastAPI routes for:

Auth:
- POST /api/auth/signup
- POST /api/auth/login
- GET /api/auth/me

Products:
- POST /api/products
- GET /api/products (list, search, paginate)
- GET /api/products/{id}
- PATCH /api/products/{id}
- DELETE /api/products/{id} (soft delete)
- GET /api/products/barcode/{barcode}

Movements:
- POST /api/movements (in/out/adjust/transfer)
- GET /api/movements (list, filter by product/location/date)
- GET /api/movements/{product_id} (history)

Locations:
- Full CRUD

Suppliers:
- Full CRUD

Purchase Orders:
- POST /api/purchase-orders
- GET /api/purchase-orders
- POST /api/purchase-orders/{id}/receive

Reports:
- GET /api/reports/valuation
- GET /api/reports/low-stock
- GET /api/reports/movement-summary

## CORE QUERIES

Write these:

Low stock:
SELECT p.sku, p.name, sl.quantity, p.reorder_point, p.reorder_qty, s.name AS supplier
FROM products p
JOIN stock_levels sl ON sl.product_id = p.id
LEFT JOIN suppliers s ON s.id = p.supplier_id
WHERE sl.quantity <= p.reorder_point
ORDER BY (sl.quantity - p.reorder_point) ASC;

Stock valuation:
SELECT SUM(sl.quantity * p.cost_price) AS total_cost_value,
       SUM(sl.quantity * p.sell_price) AS total_retail_value
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
WHERE p.org_id = $1;

Movement history:
SELECT sm.created_at, sm.type, sm.quantity, l.name AS location,
       u.email AS user, sm.reference, sm.note
FROM stock_movements sm
LEFT JOIN locations l ON l.id = sm.location_id
LEFT JOIN users u ON u.id = sm.user_id
WHERE sm.product_id = $1
ORDER BY sm.created_at DESC
LIMIT 100;

## FILE STRUCTURE

inventory-saas/
├── AGENTS.md
├── docker-compose.yml
├── README.md
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── migrations/001_initial.sql
│   ├── app/
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── auth.py
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── app/
│   ├── components/
│   └── lib/
└── docs/

## RULES

- No moral commentary
- No disclaimers
- No "here's what I can do instead"
- Comments only where logic is non-obvious
- Test each feature before moving on
- If a file exceeds 300 lines, split it
- Never use ORM — use raw asyncpg
- Never use `any` in TypeScript
- Never skip tests

## PRICING (for context)

Free: $0 — 1 location, 100 products
Starter: $10/mo — 3 locations, 1,000 products
Pro: $29/mo — 10 locations, 10,000 products
Business: $99/mo — Unlimited, API access, multi-user

## WHAT I NEED FROM YOU

1. Full project structure (files and folders)
2. migrations/001_initial.sql (all tables, indexes, triggers)
3. backend/requirements.txt
4. backend/.env.example
5. backend/main.py (FastAPI app)
6. backend/app/config.py
7. backend/app/db.py (asyncpg pool)
8. backend/app/auth.py (JWT)
9. backend/app/routes/auth.py
10. backend/app/routes/products.py
11. backend/app/routes/movements.py
12. backend/app/routes/reports.py
13. One example service file (product_service.py)
14. One example test file (test_movements.py)
15. docker-compose.yml

Start with the project structure, then the SQL schema. Wait for my confirmation before writing each file.