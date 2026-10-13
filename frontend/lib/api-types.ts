/**
 * Response shapes for the read-only report endpoints.
 *
 * The dashboard and the reports screen both call `/api/reports/low-stock` and
 * both used to declare the payload independently. They drifted: the dashboard
 * claimed `unit: string | null` while the schema says `products.unit` is
 * `TEXT NOT NULL`. Declaring a shape once means a schema change breaks this
 * file instead of silently disagreeing in two places.
 *
 * Nullability notes, checked against migrations/001_initial.sql:
 * - `unit` is `TEXT NOT NULL DEFAULT 'each'` → string, never null.
 * - `supplier` comes from a LEFT JOIN with no COALESCE → genuinely nullable.
 * - `suggested_order_qty` / `suggested_order_cost` are `COALESCE(..., 0)` → string.
 */

export interface LowStockItem {
  product_id: string;
  sku: string;
  name: string;
  quantity: string;
  reorder_point: string;
  reorder_qty: string;
  unit: string;
  supplier: string | null;
  supplier_id: string | null;
  suggested_order_qty: string;
  suggested_order_cost: string;
}

export interface LowStockReport {
  items: LowStockItem[];
  total: number;
  estimated_cost: string;
}

export interface ValuationLocation {
  location_id: string;
  location_name: string;
  location_type: string;
  total_units: string;
  total_cost_value: string;
  total_retail_value: string;
}

export interface ValuationReport {
  totals: Record<string, string>;
  by_location: ValuationLocation[];
}

export interface MovementSummaryRow {
  type: string;
  movement_count: string;
  total_quantity: string;
  first_at: string | null;
  last_at: string | null;
}