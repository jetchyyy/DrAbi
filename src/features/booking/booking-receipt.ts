const RECEIPT_ROUTE_QUERY_KEY = 'receipt';

export function buildBookingReceiptLookupUrl(receiptCode: string) {
  if (typeof window === 'undefined') {
    return `/app/bookings/scan?${RECEIPT_ROUTE_QUERY_KEY}=${encodeURIComponent(receiptCode)}`;
  }

  return `${window.location.origin}/app/bookings/scan?${RECEIPT_ROUTE_QUERY_KEY}=${encodeURIComponent(receiptCode)}`;
}

export function extractBookingReceiptCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get(RECEIPT_ROUTE_QUERY_KEY)?.trim().toUpperCase() ?? '';
  } catch {
    return trimmed.toUpperCase();
  }
}
