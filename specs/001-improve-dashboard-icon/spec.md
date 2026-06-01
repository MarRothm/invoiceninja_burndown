# Feature Specification: Improve Dashboard Icon Quality & Monochrome Design

**Feature Branch**: `001-improve-dashboard-icon`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "the dashboard icon shown eg in the Mac OS's Dock is of low quality. We need to increase resolution and change color to black and white only."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - High-Resolution Icon in macOS Dock (Priority: P1)

A user saves the Burndown dashboard as a web app or pins it in the macOS Dock via Safari.
The icon displayed in the Dock currently appears blurry and pixelated because it is only
32×32 pixels. After this feature, the icon renders crisp and sharp at all macOS icon sizes.

**Why this priority**: The macOS Dock is the most visible context where icon quality is
immediately noticeable. A low-resolution icon degrades the perceived quality of the product.

**Independent Test**: Open the Burndown URL in Safari on macOS → "Add to Dock" → verify
the icon in the Dock is sharp, not blurry, at the standard macOS Dock icon size.

**Acceptance Scenarios**:

1. **Given** a user pins the Burndown app in the macOS Dock via Safari, **When** they view
   the icon at any standard Dock size (small, medium, large), **Then** the icon appears crisp
   with no visible pixelation or blurring.
2. **Given** a user views the Burndown app in a browser tab, **When** they look at the
   favicon in the tab bar, **Then** the icon is recognizable and sharp.

---

### User Story 2 - Monochrome (Black & White) Icon (Priority: P2)

The current icon uses an indigo/purple background with colored elements. After this feature,
the icon uses only black and white — no other colors. The chart design (burndown line,
axes) is preserved but rendered in pure black and white.

**Why this priority**: A monochrome icon aligns with system UI conventions (macOS Dock
icons are shown in monochrome in certain contexts such as Focus mode and Notification
Centre). It also provides a cleaner, more professional appearance.

**Independent Test**: Inspect the icon visually at any size — confirm it contains only
pure black (`#000000`) and pure white (`#ffffff`) with no other colors, gradients, or
transparency effects that introduce intermediate colors.

**Acceptance Scenarios**:

1. **Given** the updated icon assets are deployed, **When** the icon is displayed in any
   context (browser tab, macOS Dock, Notification Centre), **Then** only black and white
   colors are present — no indigo, purple, grey, or semi-transparent tints.
2. **Given** the icon is displayed on both a light and a dark background, **When** a user
   views it, **Then** the burndown chart shape remains recognizable in both contexts.

---

### Edge Cases

- What happens when the icon is displayed at very small sizes (16×16 px browser favicon)?
  The chart lines must remain distinguishable at minimum favicon sizes.
- How does the black-and-white icon appear on a dark Dock background?
  The icon must be legible on both light and dark system backgrounds.
- What if the user's browser does not support SVG favicons?
  A high-resolution PNG fallback must be available and used automatically.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST provide an icon at a minimum of 512×512 pixels suitable
  for macOS Dock display (via Apple Touch Icon or equivalent high-resolution format).
- **FR-002**: The application MUST provide an Apple Touch Icon at 180×180 pixels for
  Safari on macOS and iOS.
- **FR-003**: The icon MUST use only pure black (`#000000`) and pure white (`#ffffff`) —
  no other colors, gradients, or semi-transparency.
- **FR-004**: The icon design MUST preserve the existing burndown chart visual (axes and
  descending line), recolored to monochrome.
- **FR-005**: A high-resolution PNG fallback (minimum 192×192 px) MUST exist for browsers
  that do not render SVG favicons natively.
- **FR-006**: The existing 32×32 PNG favicon MUST be replaced or supplemented so that
  no low-resolution fallback is served as the primary icon to modern browsers.
- **FR-007**: The updated SVG source MUST use only black and white values throughout —
  no color tokens, opacity-blended values that produce intermediate tones, or named colors
  other than black/white.

### Key Entities

- **Favicon (SVG)**: The vector icon source — currently 32×32 viewBox with indigo background
  and semi-transparent white lines. Must be updated to black-and-white-only.
- **Favicon (PNG)**: Rasterized icon — currently 32×32 px. Must be replaced with
  high-resolution variants.
- **Apple Touch Icon**: A dedicated 180×180 PNG required for Safari/macOS Dock integration.
- **High-Resolution PNG**: 192×192 px or larger PNG for modern browser and PWA use.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The icon renders without visible pixelation or blurring when displayed at
  64×64, 128×128, 256×256, and 512×512 pixels.
- **SC-002**: The icon contains exactly two colors — black and white — verifiable by
  inspecting the icon's color palette (zero non-black-or-white pixels).
- **SC-003**: When the app is added to the macOS Dock via Safari, the icon appears sharp
  at all standard Dock sizes (small: ~32dp, medium: ~64dp, large: ~128dp).
- **SC-004**: The burndown chart design (two axes + descending line) remains visually
  identifiable at sizes down to 32×32 px.
- **SC-005**: No browser displays the old low-resolution or colored icon after the update
  is deployed (verified across Safari, Chrome, Firefox on macOS).

## Assumptions

- The target deployment environment is a self-hosted web app accessed primarily via
  desktop browsers on macOS, where Dock icon quality is most visible.
- "Black and white" means pure black (#000000) and pure white (#ffffff) with no
  intermediate grey or color values (a white background with black chart elements is
  the assumed default; if a black-background variant is preferred, that requires a
  follow-up decision).
- No web app manifest currently exists in the project; the mechanism for registering
  high-resolution icons with the OS is in scope if needed to achieve Dock quality,
  but the choice of mechanism is left to the implementation phase.
- The existing burndown chart icon design (axes + line) is retained; this feature
  is a quality and color update, not a redesign.
- iOS support is a secondary concern; the primary target is macOS Safari Dock display.
