# InvoiceNinja Design System

Extracted from [invoiceninja/invoiceninja](https://github.com/invoiceninja/invoiceninja) (v4 Laravel/Bootstrap)
and [invoiceninja/ui](https://github.com/invoiceninja/ui) (v5 React/Tailwind).

---

## Colors

### Brand / Primary
| Token | Hex | Usage |
|-------|-----|-------|
| `blue` | `#117cc1` | Primary action, links, navbar, active states |
| `blue-dark` | `#0a3f60` | Panel headings, dark accents |
| `blue-hover` | `#286090` | Button hover state |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#36c157` | Positive, on-budget |
| `warning` | `#e27329` | Over-budget, caution |
| `danger` | `#da4830` | Errors, critical |
| `info` | `#2299c0` | Informational highlights |

### Neutrals (Light theme)
| Token | Hex | Usage |
|-------|-----|-------|
| `bg` | `#f8f8f8` | Page background |
| `surface` | `#ffffff` | Cards, panels |
| `border` | `#dddddd` | Dividers, borders |
| `text` | `#333333` | Primary text |
| `muted` | `#777777` | Secondary/helper text |
| `placeholder` | `#999999` | Placeholder, disabled |

### Neutrals (Dark theme — v5 React UI)
| Token | Hex | Usage |
|-------|-----|-------|
| `ninja.gray` | `#242930` | Primary surface (panels, sidebar) |
| `ninja.gray-darker` | `#2f2e2e` | Elevated surfaces (cards) |
| `ninja.gray-lighter` | `#363d47` | Borders, hover backgrounds |

### Sidebar
| Variant | Background | Text | Hover text | Active bg |
|---------|-----------|------|-----------|----------|
| Dark | `#2f2f2f` | `#aaaaaa` | `#ffffff` | `rgba(255,255,255,0.1)` |
| Light | `#ffffff` | `#757575` | `#363636` | `rgba(140,140,140,0.1)` |

---

## Typography

### Font Families
| Role | Family |
|------|--------|
| v5 primary (React UI) | `'Inter var', Inter, sans-serif` |
| v4 primary (Laravel) | `'Roboto', Helvetica, Arial, sans-serif` |
| Monospace | `Menlo, Monaco, Consolas, 'Courier New', monospace` |

### Scale
| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 34–40px | 700 | Hero numbers |
| H1 | 28–36px | 700 | Page titles |
| H2 | 22–28px | 700 | Section headings |
| H3 | 18–22px | 600 | Card headings |
| Body | 14–15px | 400 | Default text |
| Small | 12–13px | 400 | Labels, captions |
| Micro | 10–11px | 600 | Badges, tags (uppercase) |

### Weights available in Roboto/Inter
`100`, `400`, `500`, `600`, `700`, `900`

---

## Spacing

Base unit: `4px`

| Name | Value | Usage |
|------|-------|-------|
| xs | 4px | Tight inline gaps |
| sm | 8px | Icon–label gaps, small padding |
| md | 12–16px | Button padding, card inner |
| lg | 20–24px | Section spacing |
| xl | 32–40px | Page margins |
| 2xl | 48–60px | Hero sections |

---

## Border Radius

| Component | Radius |
|-----------|--------|
| Inputs, cards, dropdowns | `4px` |
| Buttons (default) | `4px` |
| Buttons (large) | `6px` |
| Badges, tags | `3–4px` |
| Pills / avatars | `50%` |

---

## Shadows

| Level | Value | Usage |
|-------|-------|-------|
| Subtle | `0 2px 4px rgba(0,0,0,0.05)` | Cards in light mode |
| Dropdown | `0 6px 12px rgba(0,0,0,0.175)` | Popovers, menus |
| Focus ring | `0 0 0 3px rgba(17,124,193,0.25)` | Focused inputs |
| Strong | `0 0 8px 2px rgba(0,0,0,0.6)` | Modals, overlays |

---

## Sidebar

- **Width:** 250px (fixed)
- **Position:** fixed, full height
- **Transition:** `all 0.5s ease`
- **Z-index:** 1000
- **Font size:** 16px items, 18px brand
- **Line height:** 32–42px per item
- **Text indent:** 14px
- **Max-width for labels:** 226px with `text-overflow: ellipsis`

---

## Buttons

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Primary | `#117cc1` | `#fff` | `#286090` |
| Success | `#36c157` | `#fff` | `#2e9e49` |
| Danger | `#da4830` | `#fff` | `#c13b25` |
| Default | `#fff` | `#333` | `#dddddd` |
| Disabled | any | any | opacity `0.65` |

Padding: `8px 12px` (default), `5px 10px` (small), `10px 16px` (large)

---

## Table Headers

- Background: `#777777`
- Text: `#ffffff`
- Border between columns: `1px solid #999999`

---

## Transitions

| Speed | Value | Usage |
|-------|-------|-------|
| Fast | `0.15s ease-in-out` | Hover states |
| Medium | `0.3s ease` | Color, opacity |
| Slow | `0.5s ease` | Sidebar slide |

---

## Application in Burndown

| Burndown element | Design token applied |
|-----------------|---------------------|
| Sidebar background | `#2f2f2f` (IN dark sidebar) |
| Sidebar text | `#aaaaaa` → `#ffffff` on hover |
| Accent color | `#117cc1` (IN primary blue) |
| Warning / over-budget | `#e27329` (IN warning orange) |
| Success / on-budget | `#36c157` (IN success green) |
| Danger | `#da4830` (IN danger red) |
| Font | `'Inter var', Inter, sans-serif` |
| Border radius | `4px` |
| Light bg | `#f8f8f8` |
| Dark surface | `#242930` (ninja.gray) |
