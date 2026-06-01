# Quickstart: Regenerating Dashboard Icons

**Feature**: 001-improve-dashboard-icon

This guide describes how to regenerate the PNG icon variants after the SVG source
(`frontend/public/favicon.svg`) is modified.

---

## Prerequisites

- Node.js 18+ installed
- `sharp` installed as a dev dependency in `frontend/`

```bash
cd frontend
npm install --save-dev sharp
```

---

## Regenerate All PNGs

From the repository root:

```bash
node frontend/scripts/generate-icons.mjs
```

This produces:

| Output file | Size |
|-------------|------|
| `frontend/public/favicon.png` | 32×32 |
| `frontend/public/apple-touch-icon.png` | 180×180 |
| `frontend/public/favicon-192.png` | 192×192 |
| `frontend/public/favicon-512.png` | 512×512 |

---

## Validate Color Constraint

After regeneration, verify that no non-black-or-white pixels are present:

```bash
node -e "
const sharp = require('sharp');
sharp('frontend/public/favicon-512.png')
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    let violations = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const isBlack = r === 0 && g === 0 && b === 0;
      const isWhite = r === 255 && g === 255 && b === 255;
      if (!isBlack && !isWhite) violations++;
    }
    console.log(violations === 0 ? 'PASS: pure B&W' : 'FAIL: ' + violations + ' non-B&W pixels');
  });
"
```

---

## Test in Browser

```bash
cd frontend
npm run dev  # or docker compose up -d --build
```

Open `http://localhost:5173` (or your configured port) → check the browser tab favicon.

**macOS Dock test**: In Safari → File → Add to Dock → verify the icon in the Dock is sharp.

---

## Troubleshooting

- **`sharp` install fails**: Ensure you have a C++ build toolchain (`xcode-select --install`
  on macOS). Alternatively, use the pre-built binaries: `npm install --ignore-scripts sharp`.
- **SVG renders as blank**: Confirm the SVG file is valid XML (`xmllint --noout favicon.svg`).
- **Dock still shows old icon**: Safari caches web-clip icons aggressively. Remove the
  existing Dock icon, clear Safari cache, then re-add.
