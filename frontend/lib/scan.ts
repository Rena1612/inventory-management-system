import { ApiError, api } from '@/lib/api';
import type { Page, Product, ProductDetail } from '@/lib/types';

/**
 * Resolve a scan to a product.
 *
 * Barcode scanners type fast and end with Enter, so this handles both the
 * barcode path (exact, indexed) and a SKU search fallback. Barcode lookup is
 * tried first because it is a single indexed read.
 */
export async function resolveScan(term: string): Promise<Product | null> {
  const trimmed = term.trim();
  if (trimmed.length === 0) return null;

  try {
    return await api<ProductDetail>(`/api/products/barcode/${encodeURIComponent(trimmed)}`);
  } catch (caught) {
    if (!(caught instanceof ApiError) || caught.status !== 404) throw caught;
  }

  const page = await api<Page<Product>>('/api/products', {
    query: { q: trimmed, limit: 20 },
  });
  const needle = trimmed.toLowerCase();
  return page.items.find((item) => item.sku.toLowerCase() === needle) ?? null;
}