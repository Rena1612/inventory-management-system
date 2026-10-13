import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StockGauge, stockLevel } from './StockGauge';

/**
 * The bar is decorative; these assertions are what actually communicate the
 * stock position. A colour alone fails anyone who cannot see it, so every case
 * here pins both the meter semantics and the readable text.
 */
function render(props: Parameters<typeof StockGauge>[0]): string {
  return renderToStaticMarkup(<StockGauge {...props} />);
}

function attr(html: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(html);
  return match?.[1] ?? null;
}

describe('stockLevel', () => {
  it('treats zero or less as out of stock', () => {
    expect(stockLevel(0, 10)).toBe('out');
    expect(stockLevel(-1, 10)).toBe('out');
  });

  it('treats at or below the reorder point as low', () => {
    expect(stockLevel(10, 10)).toBe('low');
    expect(stockLevel(9, 10)).toBe('low');
  });

  it('treats above the reorder point as healthy', () => {
    expect(stockLevel(11, 10)).toBe('ok');
  });

  it('ignores a reorder point of zero rather than flagging everything', () => {
    expect(stockLevel(5, 0)).toBe('ok');
  });
});

describe('StockGauge accessibility', () => {
  it('exposes meter semantics', () => {
    const html = render({ quantity: 29, reorderPoint: 80, reorderQty: 400, label: '29', unit: 'each' });
    expect(attr(html, 'role')).toBe('meter');
    expect(attr(html, 'aria-label')).toBe('Stock on hand');
    expect(attr(html, 'aria-valuemin')).toBe('0');
    expect(attr(html, 'aria-valuenow')).toBe('29');
    // The track spans reorder point + reorder qty.
    expect(attr(html, 'aria-valuemax')).toBe('480');
  });

  it('never reports a maximum below the current value', () => {
    const html = render({ quantity: 900, reorderPoint: 5, reorderQty: 10, label: '900' });
    expect(Number(attr(html, 'aria-valuemax'))).toBeGreaterThanOrEqual(
      Number(attr(html, 'aria-valuenow')),
    );
  });

  describe('healthy', () => {
    const html = render({
      quantity: 184,
      reorderPoint: 6,
      reorderQty: 20,
      label: '184',
      unit: 'each',
    });

    it('spells out the status ahead of the figures', () => {
      expect(attr(html, 'aria-valuetext')).toBe(
        'In stock: 184 each on hand, reorder point 6',
      );
    });

    it('shows the on-hand figure', () => {
      expect(html).toContain('184');
    });

    it('hides the status word so healthy rows stay quiet', () => {
      expect(html).toContain('In stock');
      expect(html).toMatch(/invisible[^"]*"[^>]*>In stock</);
    });
  });

  describe('low', () => {
    const html = render({ quantity: 29, reorderPoint: 80, reorderQty: 400, label: '29', unit: 'each' });

    it('names the shortfall in the spoken text', () => {
      expect(attr(html, 'aria-valuetext')).toBe('Low stock: 29 each on hand, reorder point 80');
    });

    it('renders the status word visibly, not hidden', () => {
      expect(html).toContain('>Low<');
      expect(html).not.toMatch(/invisible[^"]*"[^>]*>Low</);
    });
  });

  describe('out', () => {
    const html = render({ quantity: 0, reorderPoint: 40, reorderQty: 200, label: '0', unit: 'each' });

    it('names the shortfall in the spoken text', () => {
      expect(attr(html, 'aria-valuetext')).toBe('Out of stock: 0 each on hand, reorder point 40');
      expect(attr(html, 'aria-valuenow')).toBe('0');
    });

    it('renders the status word visibly', () => {
      expect(html).toContain('>Out<');
    });
  });

  it('omits the unit from the spoken text when there is none', () => {
    const html = render({ quantity: 4, reorderPoint: 2, reorderQty: 3, label: '4' });
    expect(attr(html, 'aria-valuetext')).toBe('In stock: 4 on hand, reorder point 2');
  });

  it('leaves the threshold tick out of the accessibility tree', () => {
    const html = render({ quantity: 5, reorderPoint: 10, reorderQty: 10, label: '5' });
    expect(html).toContain('aria-hidden="true"');
  });
});