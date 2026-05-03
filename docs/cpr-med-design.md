# CPR Med — product design

## Principles

- **White-first surfaces** — backgrounds stay white or near-white; color carries meaning (actions, links, focus), not decoration.
- **Minimal chrome** — clear hierarchy, generous spacing, restrained borders and shadows.
- **Professional clinical SaaS** — calm, readable, efficient; avoid loud gradients and novelty UI.

## Brand tokens

| Token | Hex | Role |
|--------|-----|------|
| Primary | `#7dd453` | Primary actions, key highlights, brand emphasis |
| Secondary | `#34b2f9` | Links, info accents, secondary CTAs, focus rings where appropriate |
| Canvas | `#ffffff` | Page and card backgrounds |
| Text | `#0f172a` (slate-900 scale in UI) | Body and headings |

Runtime CSS variables: `--color-primary`, `--color-accent` (secondary), aligned with clinic settings in `src/config/clinic.ts`.

## Typography

**UI (body, labels, tables): [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans)**  
Designed for interfaces and dense information; excellent legibility at small sizes; widely used in enterprise and health-adjacent products. Distinct from the common “startup template” stack (Inter, Plus Jakarta, Geist) while still feeling neutral and credible.

**Headings (h1–h4): [Source Serif 4](https://fonts.google.com/specimen/Source+Serif+4)**  
A contemporary serif for titles only—adds editorial clarity without decorative flair. Pairs cleanly with Plex and avoids overused display faces.

**Avoid** defaulting everything to one geometric sans (reads generic) or mixing too many families beyond this pair.

## Implementation

- Global font and token source: `src/index.css`
- Tailwind font stacks: `tailwind.config.js` (`font-sans`, `font-display` via theme extension if used)
- Per-clinic color overrides: `src/hooks/use-clinic-branding.ts` (maps `orange-*` utilities to the clinic primary for compatibility)
