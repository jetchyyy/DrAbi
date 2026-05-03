/**
 * Horizontal rhythm and ambient treatment aligned with portal hero (#portal-hero).
 */
export const PORTAL_SECTION_PX =
  'px-5 sm:px-8 lg:px-11 xl:px-14 2xl:px-20';

/** Use with PORTAL_SECTION_PX on portal home so edges align with #portal-hero (no inner max-width cap). */
export const PORTAL_SECTION_FULL_WIDTH = 'w-full max-w-none';

export const PORTAL_SECTION_PY = 'py-16 sm:py-20 lg:py-24';

/** Serif section title + subdued body - matches hero headline / subcopy weight. */
export function portalSectionTitleClassnames(extra = '') {
  return `font-display text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-[clamp(2.875rem,2.4vw+1.85rem,3.5rem)] ${extra}`.trim();
}

/** Matches hero portal subcopy line rhythm (#portal-herolead paragraph). */
export function portalSectionSubtitleClassnames(extra = '') {
  return `mt-5 max-w-2xl text-[1.0625rem] leading-relaxed tracking-tight text-slate-500 sm:max-w-[44rem] sm:text-[1.125rem] lg:text-[1.1875rem] xl:text-[1.25rem] ${extra}`.trim();
}

/** Lead under serif section title (ref: muted blue-grey, medium sans, 15-17px scale). */
export function portalSectionLeadClassnames(extra = '') {
  return `font-sans text-[15px] font-normal leading-[1.6] tracking-[0.01em] text-[var(--color-muted)] sm:text-[16px] sm:leading-[1.625] lg:text-[17px] lg:leading-[1.68] ${extra}`.trim();
}

type PortalSectionBackdropVariant = 'default' | 'wash-only';

/** Subtle sky wash + optional column grid. `wash-only` = wash without stripes (e.g. features bento). */
export function PortalSectionBackdrop({ variant = 'default' }: { variant?: PortalSectionBackdropVariant }) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top_left,rgba(52,178,249,0.16)_0%,rgba(199,236,253,0.065)_34%,rgba(255,255,255,0)_58%)]"
        aria-hidden
      />
      {variant === 'default' ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg,transparent,transparent 76px,rgba(148,163,184,0.055) 76px,rgba(148,163,184,0.055) 77px)',
          }}
          aria-hidden
        />
      ) : null}
    </>
  );
}
