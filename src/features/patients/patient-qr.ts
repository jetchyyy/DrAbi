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

  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get(QR_ROUTE_QUERY_KEY)?.trim().toUpperCase() ?? '';
  } catch {
    return trimmed.toUpperCase();
  }
}

