# Henley Brand Kit

The shared, framework-agnostic visual system for **all** Henley products —
Henley Hub, Henley Tasks, and the client Design Discovery site — so every
surface looks like it was built by the same firm.

It is distilled from the Hub's own design system
(`apps/web/src/app/globals.css`), which stays the source of truth.

## Files

- **`henley-brand.css`** — drop-in stylesheet. No build step, no Tailwind.
  ```html
  <link rel="stylesheet" href="henley-brand.css">
  <body class="hh"> … </body>          <!-- dark (canonical) -->
  <body class="hh hh-light"> … </body> <!-- light -->
  ```
  Provides tokens (color, type, radius, motion) + base components:
  `.hh-btn` (`--primary/--secondary/--ghost/--destructive`), `.hh-input`,
  `.hh-panel`, `.hh-badge`, `.hh-chip`, `.hh-row`, `.hh-dot`, type helpers.

- **`brand-guide.html`** — one-page visual reference (palette, type scale,
  live components, ground rules). Open in a browser, or see the hosted
  version linked from the Henley Hub task board.

## Rules

- Blue `#4C7DFF` = primary actions & active nav only.
- Status colors (green/amber/red) carry meaning, never decoration.
- Reference every color through a token — no raw hex in product markup.
- Space Grotesk for headings & numbers; Inter for body.
- One system: evolve it for all three products together, never per-site forks.
