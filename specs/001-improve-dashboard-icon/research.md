# Research: Improve Dashboard Icon Quality & Monochrome Design

**Feature**: 001-improve-dashboard-icon
**Date**: 2026-05-29

---

## Decision 1: PNG Generation Tool

**Decision**: Use `sharp` (npm) as a dev-dependency in `frontend/` to rasterize the
updated SVG to PNG at multiple sizes.

**Rationale**: `sharp` is the de-facto standard Node.js image-processing library, based
on libvips. It handles SVG input natively (via librsvg), supports exact pixel-size output,
and is already in the Node.js ecosystem the project uses. The conversion is a one-time
dev-time operation — `sharp` does not appear in the production bundle.

**Alternatives considered**:
- `svgexport` (npm): Simpler API but uses PhantomJS/Chrome headlessly — heavier to install
  and less portable.
- Inkscape CLI: Excellent quality but requires a system dependency not present in all
  developer environments.
- ImageMagick `convert`: Widely available but SVG support is inconsistent across versions;
  requires a separate system install.
- `rsvg-convert` (librsvg CLI): High quality, but requires a system package; less obvious
  for Node.js-native contributors.
- Browser canvas API: Requires a browser context; not scriptable without additional tooling
  like Puppeteer.

---

## Decision 2: macOS Dock Icon Sizes

**Decision**: Provide four PNG sizes — 32×32 (browser favicon fallback), 180×180 (Apple
Touch Icon for Safari web-clip / Dock), 192×192 (PWA manifest), 512×512 (high-res Dock /
PWA splash).

**Rationale**:
- Safari uses the `apple-touch-icon` (180×180) as the web-clip icon added to the Dock.
  Without it, Safari falls back to a screenshot of the page — which explains the current
  poor Dock appearance.
- 192×192 and 512×512 are required by the Web App Manifest specification (`manifest.json`)
  for PWA installation on Chrome/Edge/Android.
- 32×32 is kept for legacy compatibility (browsers that do not support SVG favicons or
  high-res PNGs).
- Sizes 152×152 (iPad) and 120×120 (iPhone retina) are omitted as the spec identifies
  macOS Dock as the primary target; they can be added later if iOS support is prioritized.

**Alternatives considered**:
- Providing only a single 512×512 PNG: Some browsers cannot downsample gracefully to
  favicon-tab sizes; the 32×32 fallback avoids this.
- Using `.ico` format: Obsolete for modern browsers; SVG + PNG is superior.

---

## Decision 3: Monochrome Design Approach

**Decision**: White background (`#ffffff`) with black elements (`#000000`). The ideal
(dashed) line uses a thinner stroke rather than opacity to avoid grey intermediate pixels.

**Rationale**:
- White background is the assumed default per the spec's Assumptions section.
- Semi-transparency (e.g., `opacity: 0.4`) produces grey pixels that violate the
  "pure black and white only" requirement. Thinning the stroke of the ideal line
  (from 1.5px to 1px) provides visual differentiation without color.
- A white background is more legible against the macOS Dock on both light and dark modes
  — macOS automatically masks or composites app icons with rounded-square shapes.

**Alternatives considered**:
- Black background with white elements: Visually striking but potentially hard to read
  in light-mode Dock contexts.
- Transparent background with black elements: Would look good on both Dock themes but
  some browsers render transparent-background favicons poorly in browser tabs (no
  contrast against white tab bar). Not selected; can be revisited.
- Using opacity for the dashed line: Violates the pure-B&W constraint.

---

## Decision 4: HTML and Manifest Changes

**Decision**: Add one `<link rel="apple-touch-icon">` tag to `frontend/index.html`. Create
a minimal `frontend/public/site.webmanifest` for PWA icon registration. Do NOT add a
full PWA service worker (out of scope; violates YAGNI).

**Rationale**:
- The Apple Touch Icon meta tag is the only change required for Safari to pick up the
  high-resolution icon for the macOS Dock web-clip.
- A `site.webmanifest` with `icons` entries enables Chrome/Edge to show high-resolution
  icons when adding the site to a home screen or Dock. It does not require a service
  worker.
- Keeping the manifest minimal (name, icons, display: standalone) avoids unintended
  PWA behavior changes.

**Alternatives considered**:
- No manifest, only Apple Touch Icon tag: Sufficient for macOS Safari but misses
  Chrome-on-macOS Dock icon quality. Manifest adds 5 lines and covers both cases.
- Full PWA implementation: Out of scope; the spec bounds this feature to icon quality only.

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| PNG generation tooling | `sharp` npm dev-dependency |
| Required icon sizes | 32, 180, 192, 512 px |
| B&W design approach | White bg, black elements, no opacity |
| HTML/manifest changes | Apple Touch Icon link + minimal webmanifest |
| Ideal-line differentiation | Thinner stroke (1px) instead of opacity |
