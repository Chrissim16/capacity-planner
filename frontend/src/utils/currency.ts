import type { CurrencyCode } from '../types';

export const CURRENCY_CODES: CurrencyCode[] = ['EUR', 'GBP', 'USD'];

export const CURRENCY_OPTIONS = CURRENCY_CODES.map((currency) => ({
  value: currency,
  label: currency,
}));

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
