/** Domain types mirroring the backend Pydantic schemas. */

export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export type MovementType = 'in' | 'out' | 'adjust' | 'transfer_in' | 'transfer_out';

export type PoStatus = 'draft' | 'open' | 'partial' | 'received' | 'cancelled';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
  organization: Organization;
}

export interface StockLevel {
  location_id: string;
  location_name: string;
  location_type: string | null;
  quantity: string;
  reserved: string;
  updated_at: string;
}

export interface Product {
  id: string;
  org_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  supplier_id: string | null;
  unit: string;
  cost_price: string;
  sell_price: string;
  reorder_point: string;
  reorder_qty: string;
  track_serial: boolean;
  track_batch: boolean;
  metadata: Record<string, unknown>;
  total_quantity: string;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
}

export interface ProductDetail extends Product {
  stock: StockLevel[];
  category_name: string | null;
  supplier_name: string | null;
}

export interface Location {
  id: string;
  org_id: string;
  name: string;
  code: string | null;
  type: 'warehouse' | 'zone' | 'shelf' | 'bin' | 'vehicle';
  address: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
}

export interface Supplier {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
}

export interface Category {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
}

export interface Movement {
  id: number;
  product_id: string;
  location_id: string;
  type: MovementType;
  quantity: string;
  /** Signed effect on stock. Computed by the ledger; never derive it from `type`. */
  delta: string;
  reference: string | null;
  note: string | null;
  user_id: string | null;
  created_at: string;
  product_sku: string | null;
  product_name: string | null;
  location_name: string | null;
  user_email: string | null;
}

export interface PurchaseOrder {
  id: string;
  org_id: string;
  supplier_id: string;
  status: PoStatus;
  reference: string | null;
  currency: string;
  expected_at: string | null;
  received_at: string | null;
  total: string;
  notes: string | null;
  supplier_name: string | null;
  item_count: number;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  product_id: string;
  quantity: string;
  received_qty: string;
  unit_cost: string;
  location_id: string | null;
  product_sku: string | null;
  product_name: string | null;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderItem[];
}

/** Quantity on a line still outstanding: ordered minus already received. */
export function outstandingQuantity(item: PurchaseOrderItem): number {
  return Math.max(0, Number(item.quantity) - Number(item.received_qty));
}

export interface PageMeta {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export interface ApiErrorBody {
  error: string;
  code: string;
}