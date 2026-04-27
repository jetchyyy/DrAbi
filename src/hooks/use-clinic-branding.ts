import { useEffect } from 'react';

import { defaultClinicSettings } from '../config/clinic';
import { useClinicSettingsData } from './use-clinic-data';

// ── Color helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix rgb toward white (t=1 → original, t=0 → white) */
function lighten(r: number, g: number, b: number, t: number): [number, number, number] {
  return [
    Math.round(r * t + 255 * (1 - t)),
    Math.round(g * t + 255 * (1 - t)),
    Math.round(b * t + 255 * (1 - t)),
  ];
}

/** Darken rgb toward black (t=1 → original, t=0 → black) */
function darken(r: number, g: number, b: number, t: number): [number, number, number] {
  return [Math.round(r * t), Math.round(g * t), Math.round(b * t)];
}

/**
 * Returns 10 shades for the given hex, each as a space-separated
 * "r g b" string for use inside `rgb(X / alpha)` expressions.
 */
function generateShades(hex: string): Record<string, string> | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;

  const raw: Record<string, [number, number, number]> = {
    '50':  lighten(r, g, b, 0.06),
    '100': lighten(r, g, b, 0.14),
    '200': lighten(r, g, b, 0.30),
    '300': lighten(r, g, b, 0.52),
    '400': lighten(r, g, b, 0.75),
    '500': [r, g, b],
    '600': darken(r, g, b, 0.83),
    '700': darken(r, g, b, 0.68),
    '800': darken(r, g, b, 0.52),
    '900': darken(r, g, b, 0.37),
  };

  const result: Record<string, string> = {};
  for (const [k, [sr, sg, sb]] of Object.entries(raw)) {
    result[k] = `${sr} ${sg} ${sb}`;
  }
  return result;
}

/**
 * Builds a CSS string that overrides every Tailwind `orange-*` utility class
 * with the equivalent shade of the current primary color.
 */
function buildOverrideCSS(shades: Record<string, string>): string {
  const levels = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  const lines: string[] = [];

  for (const level of levels) {
    const s = shades[level];
    if (!s) continue;
    lines.push(
      /* background */
      `.bg-orange-${level}{background-color:rgb(${s}/var(--tw-bg-opacity,1))!important}`,
      /* text */
      `.text-orange-${level}{color:rgb(${s}/var(--tw-text-opacity,1))!important}`,
      /* border */
      `.border-orange-${level}{border-color:rgb(${s}/var(--tw-border-opacity,1))!important}`,
      /* ring */
      `.ring-orange-${level}{--tw-ring-color:rgb(${s}/var(--tw-ring-opacity,0.5))!important}`,
      /* divide */
      `.divide-orange-${level}>:not([hidden])~:not([hidden]){border-color:rgb(${s}/var(--tw-divide-opacity,1))!important}`,
      /* gradient from */
      `.from-orange-${level}{--tw-gradient-from:rgb(${s}) var(--tw-gradient-from-position)!important;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)!important}`,
      /* gradient to */
      `.to-orange-${level}{--tw-gradient-to:rgb(${s}) var(--tw-gradient-to-position)!important}`,
      /* gradient via */
      `.via-orange-${level}{--tw-gradient-stops:var(--tw-gradient-from),rgb(${s}) var(--tw-gradient-via-position),var(--tw-gradient-to)!important}`,
      /* shadow color */
      `.shadow-orange-${level}{--tw-shadow-color:rgb(${s})!important;--tw-shadow:var(--tw-shadow-colored)!important}`,
      /* fill / stroke */
      `.fill-orange-${level}{fill:rgb(${s})!important}`,
      `.stroke-orange-${level}{stroke:rgb(${s})!important}`,
      /* outline / decoration / caret */
      `.outline-orange-${level}{outline-color:rgb(${s})!important}`,
      `.decoration-orange-${level}{text-decoration-color:rgb(${s})!important}`,
      `.caret-orange-${level}{caret-color:rgb(${s})!important}`,
      `.accent-orange-${level}{accent-color:rgb(${s})!important}`,
      `.placeholder-orange-${level}::placeholder{color:rgb(${s}/var(--tw-placeholder-opacity,1))!important}`,
    );
  }
  return lines.join('\n');
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const STYLE_ID = 'odc-primary-color-override';

/**
 * Mounts the clinic branding system-wide:
 * 1. Sets --color-primary / --color-accent CSS variables on :root
 * 2. Sets --primary-r / -g / -b channels for use in rgba() inline styles
 * 3. Injects a <style> tag that overrides ALL Tailwind orange-* classes
 *    with computed shades of the current primary color.
 *
 * Mount once near the top of the component tree (e.g. App.tsx).
 */
export function useClinicBranding() {
  const { data: clinic } = useClinicSettingsData();

  useEffect(() => {
    const primary = clinic?.primaryColor ?? defaultClinicSettings.primaryColor;
    const accent  = clinic?.accentColor  ?? defaultClinicSettings.accentColor;
    const root    = document.documentElement;

    // 1. CSS variables
    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-accent',  accent);

    // 2. Individual RGB channels (for rgba() in inline styles)
    const rgb = hexToRgb(primary);
    if (rgb) {
      const [r, g, b] = rgb;
      root.style.setProperty('--primary-r', String(r));
      root.style.setProperty('--primary-g', String(g));
      root.style.setProperty('--primary-b', String(b));
    }

    // 3. Inject Tailwind class overrides
    const shades = generateShades(primary);
    if (shades) {
      let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = buildOverrideCSS(shades);
    }

    return () => {
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-accent');
      root.style.removeProperty('--primary-r');
      root.style.removeProperty('--primary-g');
      root.style.removeProperty('--primary-b');
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [clinic?.primaryColor, clinic?.accentColor]);
}
