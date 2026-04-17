const LAB_RECEIPT_QUERY_KEY = 'request';

export function buildLabServiceReceiptLookupUrl(requestId: string) {
  if (typeof window === 'undefined') {
    return `/app/laboratory/scan?${LAB_RECEIPT_QUERY_KEY}=${encodeURIComponent(requestId)}`;
  }

  return `${window.location.origin}/app/laboratory/scan?${LAB_RECEIPT_QUERY_KEY}=${encodeURIComponent(requestId)}`;
}

export function extractLabServiceReceiptRequestId(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return '';
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    const queryValue = (parsedUrl.searchParams.get(LAB_RECEIPT_QUERY_KEY) ?? '').trim();
    return queryValue || normalizedValue;
  } catch {
    try {
      const parsedRelativeUrl = new URL(normalizedValue, 'https://odyssey-clinic.local');
      const queryValue = (parsedRelativeUrl.searchParams.get(LAB_RECEIPT_QUERY_KEY) ?? '').trim();
      return queryValue || normalizedValue;
    } catch {
      return normalizedValue;
    }
  }
}
