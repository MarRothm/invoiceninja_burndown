# Contract: Browser Icon Registration

**Feature**: 001-improve-dashboard-icon
**Type**: HTML / Web Manifest interface contract (consumed by browsers and OS)

---

## Purpose

This contract defines how icon assets are registered in the application so that browsers
and operating systems (macOS Dock, iOS home screen) discover and display them correctly.

---

## HTML `<head>` Links

The following `<link>` elements MUST be present in `frontend/index.html`:

```html
<!-- Existing: keep -->
<link rel="icon" href="/favicon.png" type="image/png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />

<!-- New: add these -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
```

**Discovery order** (browser priority):
1. SVG favicon (modern browsers, scales to any size)
2. Apple Touch Icon (Safari, used for Dock web-clip; MUST be 180×180 px)
3. PNG favicon (fallback for browsers without SVG support)
4. Web manifest icons (Chrome/Edge high-res Dock / home-screen)

---

## Web App Manifest (`site.webmanifest`)

Must be valid JSON at the path `/site.webmanifest` (served from `frontend/public/`):

```json
{
  "name": "Burndown",
  "short_name": "Burndown",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/favicon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/favicon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Icon File Contract

All icon files served under `/` (from `frontend/public/`) MUST satisfy:

| File | MIME type | Dimensions | Color palette |
|------|-----------|------------|---------------|
| `/favicon.svg` | `image/svg+xml` | 32×32 viewBox (scalable) | `#000000`, `#ffffff` only |
| `/favicon.png` | `image/png` | 32×32 px | `#000000`, `#ffffff` only |
| `/apple-touch-icon.png` | `image/png` | 180×180 px | `#000000`, `#ffffff` only |
| `/favicon-192.png` | `image/png` | 192×192 px | `#000000`, `#ffffff` only |
| `/favicon-512.png` | `image/png` | 512×512 px | `#000000`, `#ffffff` only |

---

## Nginx Serving

No Nginx configuration changes are required. The existing Nginx configuration in
`frontend/nginx.conf` already serves all files from the static root. The new files
(`apple-touch-icon.png`, `favicon-192.png`, `favicon-512.png`, `site.webmanifest`)
are automatically served once placed in `frontend/public/`.

The `Content-Type` for `.webmanifest` must be `application/manifest+json`. Verify Nginx
serves this MIME type, or add to `nginx.conf` if missing:

```nginx
types {
    application/manifest+json  webmanifest;
}
```
