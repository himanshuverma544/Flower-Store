/**
 * Currency helpers — all prices in the store are in Indian Rupees (INR).
 */

export const CURRENCY_CODE = 'INR';
export const CURRENCY_SYMBOL = '₹';

/** Orders with a subtotal above this amount get free delivery. */
export const FREE_SHIPPING_THRESHOLD = 2999;

/** Standard courier delivery fee. */
export const STANDARD_SHIPPING_FEE = 149;

/** Flat discount (in ₹) applied by the BLOOM10 coupon. */
export const BLOOM10_FLAT_DISCOUNT = 200;

const wholeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: CURRENCY_CODE,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const fractionalFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a number as Indian Rupees using Indian digit grouping.
 * e.g. formatINR(124999) → "₹1,24,999", formatINR(359.8) → "₹359.80"
 */
export function formatINR(amount: number): string {
  const value = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
  return Number.isInteger(value)
    ? wholeFormatter.format(value)
    : fractionalFormatter.format(value);
}
