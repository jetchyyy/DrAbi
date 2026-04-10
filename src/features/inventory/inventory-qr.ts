const QR_ROUTE_QUERY_KEY = 'qr';

export function buildInventoryItemQrValue(qrCode: string) {
  if (typeof window === 'undefined') {
    return `/app/inventory?${QR_ROUTE_QUERY_KEY}=${encodeURIComponent(qrCode)}`;
  }

  return `${window.location.origin}/app/inventory?${QR_ROUTE_QUERY_KEY}=${encodeURIComponent(qrCode)}`;
}

export function extractInventoryItemQrCode(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    return (url.searchParams.get(QR_ROUTE_QUERY_KEY) ?? url.pathname.split('/').pop() ?? '').trim().toUpperCase();
  } catch {
    return trimmed.toUpperCase();
  }
}
