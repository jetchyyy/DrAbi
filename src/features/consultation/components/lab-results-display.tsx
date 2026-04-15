import { ImageIcon } from 'lucide-react';

import { parseLabResultsContent } from '../lab-results-media';

interface LabResultsDisplayProps {
  value: string | null | undefined;
  emptyLabel?: string;
}

export function LabResultsDisplay({
  value,
  emptyLabel = 'No lab results recorded.',
}: LabResultsDisplayProps) {
  const parsed = parseLabResultsContent(value);

  if (!parsed.summary && parsed.images.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {parsed.summary ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {parsed.summary}
        </p>
      ) : null}

      {parsed.images.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
            <ImageIcon className="size-3.5" />
            Attached lab images
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {parsed.images.map((image) => (
              <a
                key={image.id}
                className="block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-sm"
                href={image.dataUrl}
                rel="noreferrer"
                target="_blank"
              >
                <img
                  alt={image.name}
                  className="aspect-[4/3] w-full object-cover"
                  src={image.dataUrl}
                />
                <div className="border-t border-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                  {image.name}
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
