// ─── Shared Formatting Utilities ────────────────────────────────────────────
// Moved here from docService.ts (was duplicated with App.tsx inline usage).

export const SECURITY_DEPOSIT_RATE = 0.10; // 10% — change in one place

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
