export interface LabResultImageRecord {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface ParsedLabResultsContent {
  summary: string;
  images: LabResultImageRecord[];
}

const LAB_RESULTS_MEDIA_PREFIX = '__ODC_LAB_RESULTS_V1__:';

function isValidImageRecord(value: unknown): value is LabResultImageRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.dataUrl === 'string' &&
    candidate.dataUrl.startsWith('data:image/') &&
    typeof candidate.mimeType === 'string'
  );
}

export function parseLabResultsContent(rawValue: string | null | undefined): ParsedLabResultsContent {
  const value = rawValue?.trim() ?? '';
  if (!value) {
    return { summary: '', images: [] };
  }

  if (!value.startsWith(LAB_RESULTS_MEDIA_PREFIX)) {
    return { summary: value, images: [] };
  }

  try {
    const parsed = JSON.parse(value.slice(LAB_RESULTS_MEDIA_PREFIX.length)) as {
      summary?: unknown;
      images?: unknown;
    };

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      images: Array.isArray(parsed.images) ? parsed.images.filter(isValidImageRecord) : [],
    };
  } catch {
    return { summary: value, images: [] };
  }
}

export function serializeLabResultsContent(input: ParsedLabResultsContent): string {
  const summary = input.summary.trim();
  const images = input.images.filter((image) => image.dataUrl.startsWith('data:image/'));

  if (images.length === 0) {
    return summary;
  }

  return `${LAB_RESULTS_MEDIA_PREFIX}${JSON.stringify({
    summary,
    images,
  })}`;
}
