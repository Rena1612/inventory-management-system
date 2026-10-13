-- migrations/001_initial.sql
-- Inventory Management System — initial schema
-- Requires PostgreSQL 15+ (NULLS NOT DISTINCT, ON CONFLICT ON CONSTRAINT)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email / sku
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram search for ?q=

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE org_plan      AS ENUM ('free', 'starter', 'pro', 'business');
CREATE TYPE user_role     AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE location_type AS ENUM ('warehouse', 'zone', 'shelf', 'bin', 'vehicle');
CREATE TYPE movement_type AS ENUM ('in', 'out', 'adjust', 'transfer_in', 'transfer_out');
CREATE TYPE po_status     AS ENUM ('draft', 'open', 'partial', 'received', 'cancelled');

-- ============================================================================
-- Shared trigger functions
-- ============================================================================

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- stock_movements is an append-only ledger.
CREATE FUNCTION block_movement_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- ============================================================================
-- organizations
-- ============================================================================

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (btrim(name) <> ''),
  slug        CITEXT NOT NULL UNIQUE,
  plan        org_plan NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- users (email unique globally — it is the login identifier)
-- ============================================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email         CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  role          user_role NOT NULL DEFAULT 'member',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX users_org_id_idx      ON users (org_id) WHERE archived_at IS NULL;
CREATE INDEX users_org_created_idx ON users (org_id, created_at DESC);

-- ============================================================================
-- categories (self-referencing tree)
-- ============================================================================

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (btrim(name) <> ''),
  description TEXT,
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX categories_org_parent_name_key
  ON categories (org_id, parent_id, name) NULLS NOT DISTINCT;
CREATE INDEX categories_org_id_idx    ON categories (org_id) WHERE archived_at IS NULL;
CREATE INDEX categories_parent_id_idx ON categories (parent_id);

-- ============================================================================
-- locations (warehouse -> zone -> shelf -> bin)
-- ============================================================================

CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (btrim(name) <> ''),
  code        TEXT,
  type        location_type NOT NULL DEFAULT 'shelf',
  address     TEXT,
  parent_id   UUID REFERENCES locations(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TRIGGER locations_set_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX locations_org_parent_name_key
  ON locations (org_id, parent_id, name) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX locations_org_code_key
  ON locations (org_id, code) WHERE code IS NOT NULL;
CREATE INDEX locations_org_id_idx    ON locations (org_id) WHERE archived_at IS NULL;
CREATE INDEX locations_parent_id_idx ON locations (parent_id);

-- ============================================================================
-- suppliers
-- ============================================================================

CREATE TABLE suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (btrim(name) <> ''),
  email       CITEXT,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX suppliers_org_id_idx     ON suppliers (org_id) WHERE archived_at IS NULL;
CREATE INDEX suppliers_org_name_idx   ON suppliers (org_id, name);
CREATE INDEX suppliers_name_trgm_idx  ON suppliers USING gin (name gin_trgm_ops);

-- ============================================================================
-- products
-- ============================================================================

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku           CITEXT NOT NULL,
  barcode       TEXT,
  name          TEXT NOT NULL CHECK (btrim(name) <> ''),
  description   TEXT,
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  unit          TEXT NOT NULL DEFAULT 'each',
  cost_price    NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sell_price    NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  reorder_point NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
  reorder_qty   NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (reorder_qty >= 0),
  track_serial  BOOLEAN NOT NULL DEFAULT FALSE,
  track_batch   BOOLEAN NOT NULL DEFAULT FALSE,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ
);

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX products_org_sku_key ON products (org_id, sku);
CREATE UNIQUE INDEX products_barcode_key  ON products (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX products_org_id_idx        ON products (org_id, created_at DESC) WHERE archived_at IS NULL;
CREATE INDEX products_org_archived_idx  ON products (org_id, archived_at);
CREATE INDEX products_category_id_idx   ON products (category_id);
CREATE INDEX products_supplier_id_idx   ON products (supplier_id);
CREATE INDEX products_search_trgm_idx  ON products USING gin ((name || ' ' || sku) gin_trgm_ops);
CREATE INDEX products_metadata_gin_idx  ON products USING gin (metadata jsonb_path_ops);

-- ============================================================================
-- stock_levels (derived state — one row per product/location pair)
-- ============================================================================

CREATE TABLE stock_levels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity    NUMERIC(14, 3) NOT NULL DEFAULT 0,
  reserved    NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_levels_product_location_key UNIQUE (product_id, location_id)
  -- reserved <= quantity is enforced in apply_stock_movement(), not as a CHECK:
  -- ON CONFLICT DO UPDATE evaluates CHECKs against the proposed (pre-update) row,
  -- so a table-level CHECK breaks every decrement below `reserved`.
);

CREATE TRIGGER stock_levels_set_updated_at
  BEFORE UPDATE ON stock_levels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX stock_levels_org_id_idx      ON stock_levels (org_id);
CREATE INDEX stock_levels_location_id_idx ON stock_levels (location_id);
CREATE INDEX stock_levels_org_qty_idx     ON stock_levels (org_id, quantity);
CREATE INDEX stock_levels_product_id_idx  ON stock_levels (product_id);

-- ============================================================================
-- stock_movements (append-only ledger)
-- ============================================================================

CREATE TABLE stock_movements (
  id          BIGSERIAL PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  type        movement_type NOT NULL,
  quantity    NUMERIC(14, 3) NOT NULL,
  reference   TEXT,
  note        TEXT,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'in'/'transfer_in'/'transfer_out' store positive quantities, 'out' is positive,
  -- 'adjust' is a signed delta.
  CONSTRAINT stock_movements_qty_nonzero  CHECK (quantity <> 0),
  CONSTRAINT stock_movements_sign_by_type CHECK (
    (type IN ('in', 'out', 'transfer_in', 'transfer_out') AND quantity > 0)
    OR type = 'adjust'
  )
);

CREATE TRIGGER stock_movements_append_only
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION block_movement_mutation();

CREATE INDEX stock_movements_org_created_idx     ON stock_movements (org_id, created_at DESC);
CREATE INDEX stock_movements_product_created_idx ON stock_movements (product_id, created_at DESC);
CREATE INDEX stock_movements_location_created_idx ON stock_movements (location_id, created_at DESC);
CREATE INDEX stock_movements_org_type_idx        ON stock_movements (org_id, type);
CREATE INDEX stock_movements_user_id_idx         ON stock_movements (user_id);
CREATE INDEX stock_movements_reference_idx       ON stock_movements (reference)
  WHERE reference IS NOT NULL;

-- ============================================================================
-- apply_stock_movement() — keeps stock_levels in sync from the ledger
-- ============================================================================

CREATE FUNCTION apply_stock_movement() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_delta    NUMERIC(14, 3);
  v_qty      NUMERIC(14, 3);
  v_reserved NUMERIC(14, 3);
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'stock_movements is append-only; % is not permitted', TG_OP
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Guard tenancy: movement, product and location must all belong to one org.
  IF NOT EXISTS (SELECT 1 FROM products p WHERE p.id = NEW.product_id AND p.org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'product % does not belong to org %', NEW.product_id, NEW.org_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = NEW.location_id AND l.org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'location % does not belong to org %', NEW.location_id, NEW.org_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_delta := CASE NEW.type
    WHEN 'in'           THEN  NEW.quantity
    WHEN 'transfer_in'  THEN  NEW.quantity
    WHEN 'out'          THEN -NEW.quantity
    WHEN 'transfer_out' THEN -NEW.quantity
    WHEN 'adjust'       THEN  NEW.quantity  -- signed delta, may be negative
  END;

  INSERT INTO stock_levels (org_id, product_id, location_id, quantity)
  VALUES (NEW.org_id, NEW.product_id, NEW.location_id, v_delta)
  ON CONFLICT ON CONSTRAINT stock_levels_product_location_key DO UPDATE
    SET quantity = stock_levels.quantity + EXCLUDED.quantity,
        updated_at = now()
  RETURNING quantity, reserved INTO v_qty, v_reserved;

  IF v_qty < 0 THEN
    RAISE EXCEPTION
      'insufficient stock for product % at location %: would result in %',
      NEW.product_id, NEW.location_id, v_qty
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_reserved > v_qty THEN
    RAISE EXCEPTION
      'stock for product % at location % would fall below the % reserved',
      NEW.product_id, NEW.location_id, v_reserved
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_movements_apply AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

-- ============================================================================
-- purchase_orders
-- ============================================================================

CREATE TABLE purchase_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status      po_status NOT NULL DEFAULT 'draft',
  reference   TEXT,
  currency    TEXT NOT NULL DEFAULT 'USD',
  expected_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  total       NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TRIGGER purchase_orders_set_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX purchase_orders_org_status_idx  ON purchase_orders (org_id, status);
CREATE INDEX purchase_orders_supplier_id_idx ON purchase_orders (supplier_id);
CREATE INDEX purchase_orders_org_created_idx ON purchase_orders (org_id, created_at DESC);
CREATE UNIQUE INDEX purchase_orders_org_ref_key
  ON purchase_orders (org_id, reference) WHERE reference IS NOT NULL;

CREATE TABLE purchase_order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id        UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity     NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  received_qty NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  unit_cost    NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  location_id  UUID REFERENCES locations(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT purchase_order_items_po_product_key    UNIQUE (po_id, product_id),
  CONSTRAINT purchase_order_items_received_lte_qty CHECK (received_qty <= quantity)
);

CREATE TRIGGER purchase_order_items_set_updated_at
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX purchase_order_items_po_id_idx      ON purchase_order_items (po_id);
CREATE INDEX purchase_order_items_product_id_idx ON purchase_order_items (product_id);

COMMIT;