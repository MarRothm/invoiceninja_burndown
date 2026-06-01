# Implementation Plan: Improve Dashboard Icon Quality & Monochrome Design

**Branch**: `001-improve-dashboard-icon` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-improve-dashboard-icon/spec.md`

## Summary

Replace the current 32×32 px colored favicon with a black-and-white icon set at multiple
high-resolution sizes (32, 180, 192, 512 px). Update the SVG source to use only `#000000`
and `#ffffff`. Add an Apple Touch Icon for macOS Dock / Safari web-clip support. Generate
all PNG variants from the updated SVG using a one-time Node.js script leveraging `sharp`.
Update `frontend/index.html` to reference the new icon sizes.

## Technical Context

**Language/Version**: SVG 1.1 (icon source); Node.js 18+ (PNG conversion script)

**Primary Dependencies**: `sharp` npm package (SVG → PNG rasterization at arbitrary sizes)

**Storage**: Static files only — `frontend/public/` directory served by Nginx

**Testing**: Visual inspection at 32, 64, 128, 256, 512 px; automated color-palette check
via `sharp` metadata to confirm zero non-black-or-white pixels

**Target Platform**: macOS Safari (Dock / web-clip), modern browsers (Chrome, Firefox, Safari)

**Project Type**: Static asset update within an existing web-application frontend

**Performance Goals**: No runtime performance impact; one-time build-time conversion

**Constraints**: Colors MUST be pure `#000000` and `#ffffff` only — no opacity blending,
no semi-transparent values, no grey intermediates. The chart design (axes + burndown line)
MUST be preserved.

**Scale/Scope**: 5 output files (favicon.svg updated; favicon.png, favicon-192.png,
favicon-512.png, apple-touch-icon.png generated); 1 HTML file updated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Self-Hosted & Network-Boundary Security | ✅ Pass | Static asset change; no auth surface affected |
| II. InvoiceNinja Is the Single Source of Truth | ✅ Pass | Icon assets are not data — principle N/A |
| III. Layered Service Architecture | ✅ Pass | Changes stay within the Frontend layer (Nginx-served static files) |
| IV. Security Hygiene | ✅ Pass | `sharp` is a well-audited, widely-used package; pentest CI unaffected by icon changes |
| V. Simplicity & Observable Configuration | ✅ Pass | YAGNI respected — minimal file additions; design-system color override is a deliberate user requirement |

**Note on Principle V (InvoiceNinja design system)**: The constitution requires InvoiceNinja
design tokens for UI styling. This feature deliberately departs from the token palette
(`#6366f1` background) by user requirement. The departure is justified: the icon is an OS-
level affordance (Dock/browser tab), not an in-app UI element, and the user has explicitly
requested monochrome for OS integration purposes.

## Project Structure

### Documentation (this feature)

```text
specs/001-improve-dashboard-icon/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
frontend/
├── index.html                        # Updated: add apple-touch-icon link
├── public/
│   ├── favicon.svg                   # Updated: recolored to black & white
│   ├── favicon.png                   # Regenerated: 32×32 px, B&W
│   ├── favicon-192.png               # New: 192×192 px, B&W
│   ├── favicon-512.png               # New: 512×512 px, B&W
│   └── apple-touch-icon.png          # New: 180×180 px, B&W
└── scripts/
    └── generate-icons.mjs            # New: one-time PNG generation script
```

**Structure Decision**: Single-project web-app (Option 2 variant). All changes are
contained within `frontend/`. No backend or worker changes required. The generation
script lives at `frontend/scripts/generate-icons.mjs` and is a dev-time utility —
it does not run in production.

## Complexity Tracking

> No constitution violations to justify.
