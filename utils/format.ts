// ─── Shared Formatting Utilities ────────────────────────────────────────────
// Moved here from docService.ts (was duplicated with App.tsx inline usage).

export const SECURITY_DEPOSIT_RATE = 0.10; // 10% — change in one place

export type PaymentCurrency = 'IDR' | 'USD' | 'EUR' | 'USDT';

export const CURRENCY_SYMBOLS: Record<PaymentCurrency, string> = {
  IDR: 'Rp', USD: '$', EUR: '€', USDT: 'USDT',
};

/** Format a number for display based on selected currency */
export const formatCurrencyDisplay = (n: number, currency: PaymentCurrency): string => {
  if (currency === 'IDR') return formatIDR(n);
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${sym} ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

/** Parse an IDR-formatted string (e.g. "30.000.000" or "30,000,000") into a number */
export const parseIDRInput = (s: string): number => {
  const cleaned = s.replace(/\./g, '').replace(/,/g, '').replace(/[^0-9]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

export const formatIDR = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Fixed: always produces a consistent Indonesian date format regardless of
// the user's browser locale (was using toLocaleDateString() before, which
// could produce different formats on different machines).
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr; // fallback to raw string if date is malformed
  }
};
