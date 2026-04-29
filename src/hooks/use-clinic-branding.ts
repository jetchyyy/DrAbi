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

/**
 * Returns the hue (0-360) of a hex color.
 * Used to derive a harmonious dark panel background from the primary color.
 */
function hexToHue(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(x => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0; // achromatic
  const d = max - min;
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }
  return Math.round(h * 360);
}

function lighten(r: number, g: number, b: number, t: number): [number, number, number] {
  return [
    Math.round(r * t + 255 * (1 - t)),
    Math.round(g * t + 255 * (1 - t)),
    Math.round(b * t + 255 * (1 - t)),
  ];
}

function darken(r: number, g: number, b: number, t: number): [number, number, number] {
  return [Math.round(r * t), Math.round(g * t), Math.round(b * t)];
}

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

// ── CSS override builder ──────────────────────────────────────────────────────

/**
 * Opacity fractions used in Tailwind JIT slash-notation classes, e.g.
 * shadow-orange-300/55 → shadow-color with 0.55 opacity.
 * We cover every opacity variant that appears in the portal sections.
 */
const OPACITY_VARIANTS = [5, 10, 15, 20, 25, 30, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90];

/**
 * Escape a CSS class name so forward slashes in JIT slash-notation variants
 * (e.g. "shadow-orange-300/55") are valid CSS selectors (".shadow-orange-300\/55").
 */
function esc(cls: string) {
  return cls.replace(/\//g, '\\/').replace(/:/g, '\\:');
}

function buildOverrideCSS(shades: Record<string, string>): string {
  const levels = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  const lines: string[] = [];

  for (const level of levels) {
    const s = shades[level];
    if (!s) continue;

    // ── Base utilities ───────────────────────────────────────────────────────
    lines.push(
      `.bg-orange-${level}{background-color:rgb(${s}/var(--tw-bg-opacity,1))!important}`,
      `.text-orange-${level}{color:rgb(${s}/var(--tw-text-opacity,1))!important}`,
      `.border-orange-${level}{border-color:rgb(${s}/var(--tw-border-opacity,1))!important}`,
      `.ring-orange-${level}{--tw-ring-color:rgb(${s}/var(--tw-ring-opacity,0.5))!important}`,
      `.divide-orange-${level}>:not([hidden])~:not([hidden]){border-color:rgb(${s}/var(--tw-divide-opacity,1))!important}`,
      `.from-orange-${level}{--tw-gradient-from:rgb(${s}) var(--tw-gradient-from-position)!important;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)!important}`,
      `.to-orange-${level}{--tw-gradient-to:rgb(${s}) var(--tw-gradient-to-position)!important}`,
      `.via-orange-${level}{--tw-gradient-stops:var(--tw-gradient-from),rgb(${s}) var(--tw-gradient-via-position),var(--tw-gradient-to)!important}`,
      `.shadow-orange-${level}{--tw-shadow-color:rgb(${s})!important;--tw-shadow:var(--tw-shadow-colored)!important}`,
      `.fill-orange-${level}{fill:rgb(${s})!important}`,
      `.stroke-orange-${level}{stroke:rgb(${s})!important}`,
      `.outline-orange-${level}{outline-color:rgb(${s})!important}`,
      `.decoration-orange-${level}{text-decoration-color:rgb(${s})!important}`,
      `.caret-orange-${level}{caret-color:rgb(${s})!important}`,
      `.accent-orange-${level}{accent-color:rgb(${s})!important}`,
      `.placeholder-orange-${level}::placeholder{color:rgb(${s}/var(--tw-placeholder-opacity,1))!important}`,
    );

    // ── Opacity slash-variants (bg, border, ring, shadow, divide) ────────────
    for (const pct of OPACITY_VARIANTS) {
      const alpha = (pct / 100).toFixed(2);
      lines.push(
        // background with opacity: bg-orange-100/40
        `.${esc(`bg-orange-${level}/${pct}`)}{background-color:rgb(${s}/${alpha})!important}`,
        // border with opacity: border-orange-200/60
        `.${esc(`border-orange-${level}/${pct}`)}{border-color:rgb(${s}/${alpha})!important}`,
        // ring with opacity: ring-orange-200/70, ring-orange-300/60
        `.${esc(`ring-orange-${level}/${pct}`)}{--tw-ring-color:rgb(${s}/${alpha})!important}`,
        // shadow with opacity: shadow-orange-200/50, shadow-orange-300/55
        `.${esc(`shadow-orange-${level}/${pct}`)}{--tw-shadow-color:rgb(${s}/${alpha})!important;--tw-shadow:var(--tw-shadow-colored)!important}`,
        // divide with opacity
        `.${esc(`divide-orange-${level}/${pct}`)}>:not([hidden])~:not([hidden]){border-color:rgb(${s}/${alpha})!important}`,
      );
    }

    // ── hover: prefix ────────────────────────────────────────────────────────
    lines.push(
      `.${esc(`hover:bg-orange-${level}`)}:hover{background-color:rgb(${s}/var(--tw-bg-opacity,1))!important}`,
      `.${esc(`hover:text-orange-${level}`)}:hover{color:rgb(${s}/var(--tw-text-opacity,1))!important}`,
      `.${esc(`hover:border-orange-${level}`)}:hover{border-color:rgb(${s}/var(--tw-border-opacity,1))!important}`,
      `.${esc(`hover:ring-orange-${level}`)}:hover{--tw-ring-color:rgb(${s}/0.5)!important}`,
      `.${esc(`hover:shadow-orange-${level}`)}:hover{--tw-shadow-color:rgb(${s})!important;--tw-shadow:var(--tw-shadow-colored)!important}`,
      `.${esc(`hover:from-orange-${level}`)}:hover{--tw-gradient-from:rgb(${s}) var(--tw-gradient-from-position)!important;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)!important}`,
      `.${esc(`hover:to-orange-${level}`)}:hover{--tw-gradient-to:rgb(${s}) var(--tw-gradient-to-position)!important}`,
      `.${esc(`hover:text-orange-${level}`)}:hover{color:rgb(${s}/var(--tw-text-opacity,1))!important}`,
    );

    // hover + opacity slash-variants: hover:shadow-orange-400/55, hover:bg-orange-100/80
    for (const pct of OPACITY_VARIANTS) {
      const alpha = (pct / 100).toFixed(2);
      lines.push(
        `.${esc(`hover:shadow-orange-${level}/${pct}`)}:hover{--tw-shadow-color:rgb(${s}/${alpha})!important;--tw-shadow:var(--tw-shadow-colored)!important}`,
        `.${esc(`hover:bg-orange-${level}/${pct}`)}:hover{background-color:rgb(${s}/${alpha})!important}`,
        `.${esc(`hover:border-orange-${level}/${pct}`)}:hover{border-color:rgb(${s}/${alpha})!important}`,
        `.${esc(`hover:ring-orange-${level}/${pct}`)}:hover{--tw-ring-color:rgb(${s}/${alpha})!important}`,
      );
    }

    // ── focus-visible: prefix ────────────────────────────────────────────────
    lines.push(
      `.${esc(`focus-visible:ring-orange-${level}`)}:focus-visible{--tw-ring-color:rgb(${s}/0.5)!important}`,
      `.${esc(`focus-visible:ring-offset-orange-${level}`)}:focus-visible{--tw-ring-offset-color:rgb(${s})!important}`,
    );

    // ── group-hover: prefix ──────────────────────────────────────────────────
    lines.push(
      `.group:hover .${esc(`group-hover:text-orange-${level}`)}{color:rgb(${s}/var(--tw-text-opacity,1))!important}`,
      `.group:hover .${esc(`group-hover:bg-orange-${level}`)}{background-color:rgb(${s}/var(--tw-bg-opacity,1))!important}`,
    );
  }

  return lines.join('\n');
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const STYLE_ID = 'odc-primary-color-override';

export function useClinicBranding() {
  const { data: clinic } = useClinicSettingsData();

  useEffect(() => {
    const primary = clinic?.primaryColor ?? defaultClinicSettings.primaryColor;
    const accent  = clinic?.accentColor  ?? defaultClinicSettings.accentColor;
    const root    = document.documentElement;

    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-accent',  accent);

    const rgb = hexToRgb(primary);
    if (rgb) {
      const [r, g, b] = rgb;
      root.style.setProperty('--primary-r', String(r));
      root.style.setProperty('--primary-g', String(g));
      root.style.setProperty('--primary-b', String(b));
    }

    // Derive a harmonious dark panel background from the primary hue:
    //   hsl(<primary-hue>, 28%, 9%)  — deep-panel (admin login)
    //   hsl(<primary-hue>, 35%, 6%)  — deeper-panel (portal login / register)
    const hue = hexToHue(primary);
    if (hue !== null) {
      root.style.setProperty('--primary-hue', String(hue));
      root.style.setProperty('--color-panel-bg',      `hsl(${hue}, 28%, 9%)`);
      root.style.setProperty('--color-panel-bg-deep', `hsl(${hue}, 35%, 6%)`);
    }

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
      root.style.removeProperty('--primary-hue');
      root.style.removeProperty('--color-panel-bg');
      root.style.removeProperty('--color-panel-bg-deep');
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [clinic?.primaryColor, clinic?.accentColor]);
}
