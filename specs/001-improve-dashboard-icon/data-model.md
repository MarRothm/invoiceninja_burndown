# Data Model: Improve Dashboard Icon Quality & Monochrome Design

**Feature**: 001-improve-dashboard-icon
**Date**: 2026-05-29

---

## Icon Asset Inventory

This feature involves static file assets, not database entities. The "data model" here
describes the complete set of icon artifacts, their properties, and their relationships.

---

### SVG Source

| Property | Value |
|----------|-------|
| File | `frontend/public/favicon.svg` |
| ViewBox | `0 0 32 32` |
| Background | `<rect>` fill `#ffffff`, rx `7` |
| Y-axis | `<line>` stroke `#000000`, width `1.5px` |
| X-axis | `<line>` stroke `#000000`, width `1.5px` |
| Ideal line | `<line>` stroke `#000000`, width `1px`, dasharray `2.5 2` |
| Burndown line | `<polyline>` stroke `#000000`, width `2.5px`, fill `none` |
| Color constraint | ONLY `#000000` and `#ffffff` — no rgba, no opacity, no named colors |

The SVG is the **single authoritative source** for all PNG variants. All PNGs are
generated from this SVG; the SVG must not be modified independently of the generation
script.

---

### PNG Variants

| File | Size | Purpose | Registered in |
|------|------|---------|---------------|
| `frontend/public/favicon.png` | 32×32 | Browser tab fallback (non-SVG browsers) | `index.html` `<link rel="icon">` |
| `frontend/public/apple-touch-icon.png` | 180×180 | Safari web-clip / macOS Dock | `index.html` `<link rel="apple-touch-icon">` |
| `frontend/public/favicon-192.png` | 192×192 | PWA manifest (standard size) | `site.webmanifest` icons array |
| `frontend/public/favicon-512.png` | 512×512 | PWA manifest (high-res) | `site.webmanifest` icons array |

All PNGs share the same color palette constraint as the SVG source: pure black and white only.

---

### Web App Manifest

| Property | Value |
|----------|-------|
| File | `frontend/public/site.webmanifest` |
| `name` | `Burndown` |
| `short_name` | `Burndown` |
| `display` | `standalone` |
| `background_color` | `#ffffff` |
| `theme_color` | `#000000` |
| `icons` | Array: 192×192 and 512×512 PNG entries |

---

### HTML Registration

File: `frontend/index.html`

| Tag | Attribute | Value |
|-----|-----------|-------|
| `<link>` | `rel="icon" href="/favicon.png" type="image/png"` | 32×32 fallback |
| `<link>` | `rel="icon" type="image/svg+xml" href="/favicon.svg"` | SVG (modern browsers) |
| `<link>` | `rel="apple-touch-icon" href="/apple-touch-icon.png"` | **New** — Safari/macOS Dock |
| `<link>` | `rel="manifest" href="/site.webmanifest"` | **New** — PWA manifest |

---

### Generation Script

| Property | Value |
|----------|-------|
| File | `frontend/scripts/generate-icons.mjs` |
| Runtime | Node.js (ESM module) |
| Dependency | `sharp` (dev-only, installed in `frontend/package.json`) |
| Input | `frontend/public/favicon.svg` |
| Outputs | The four PNG files listed above |
| Usage | `node frontend/scripts/generate-icons.mjs` (run once after SVG changes) |
| Included in build? | No — dev-time utility only; not imported by Vite |
