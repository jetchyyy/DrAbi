const QR_ROUTE_QUERY_KEY = 'qr';

export function buildPatientQrLookupUrl(qrCode: string) {
  if (typeof window === 'undefined') {
    return `/app/patients/scan?${QR_ROUTE_QUERY_KEY}=${encodeURIComponent(qrCode)}`;
  }

  return `${window.location.origin}/app/patients/scan?${QR_ROUTE_QUERY_KEY}=${encodeURIComponent(qrCode)}`;
}

export function extractPatientQrCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const asQueryString = trimmed.startsWith('?') ? trimmed : trimmed.includes('?') && !trimmed.includes('://') ? trimmed.slice(trimmed.indexOf('?')) : '';

  if (asQueryString) {
    const params = new URLSearchParams(asQueryString);
    const qrFromQuery = params.get(QR_ROUTE_QUERY_KEY)?.trim().toUpperCase();
    if (qrFromQuery) {
      return qrFromQuery;
    }
  }

  try {
    const parsed = new URL(trimmed);
    const fromAbsoluteUrl = parsed.searchParams.get(QR_ROUTE_QUERY_KEY)?.trim().toUpperCase();
    if (fromAbsoluteUrl) {
      return fromAbsoluteUrl;
    }
  } catch {
    // Continue to relative URL parsing.
  }

  try {
    const parsedRelative = new URL(trimmed, 'http://localhost');
    const fromRelativeUrl = parsedRelative.searchParams.get(QR_ROUTE_QUERY_KEY)?.trim().toUpperCase();
    if (fromRelativeUrl) {
      return fromRelativeUrl;
    }
  } catch {
    // Fall through to raw value normalization.
  }

  return trimmed.toUpperCase();
}

