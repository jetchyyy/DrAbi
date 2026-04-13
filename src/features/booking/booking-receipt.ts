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

  const asQueryString = trimmed.startsWith('?') ? trimmed : trimmed.includes('?') && !trimmed.includes('://') ? trimmed.slice(trimmed.indexOf('?')) : '';

  if (asQueryString) {
    const params = new URLSearchParams(asQueryString);
    const receiptFromQuery = params.get(RECEIPT_ROUTE_QUERY_KEY)?.trim().toUpperCase();
    if (receiptFromQuery) {
      return receiptFromQuery;
    }
  }

  try {
    const parsed = new URL(trimmed);
    const fromAbsoluteUrl = parsed.searchParams.get(RECEIPT_ROUTE_QUERY_KEY)?.trim().toUpperCase();
    if (fromAbsoluteUrl) {
      return fromAbsoluteUrl;
    }
  } catch {
    // Continue to relative URL parsing.
  }

  try {
    const parsedRelative = new URL(trimmed, 'http://localhost');
    const fromRelativeUrl = parsedRelative.searchParams.get(RECEIPT_ROUTE_QUERY_KEY)?.trim().toUpperCase();
    if (fromRelativeUrl) {
      return fromRelativeUrl;
    }
  } catch {
    // Fall through to raw value normalization.
  }

  return trimmed.toUpperCase();
}
