import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dir, '..', 'public');
const svgPath = join(publicDir, 'favicon.svg');
const svg = readFileSync(svgPath);

const sizes = [
  { file: 'favicon.png',         size: 32  },
  { file: 'apple-touch-icon.png',size: 180 },
  { file: 'favicon-192.png',     size: 192 },
  { file: 'favicon-512.png',     size: 512 },
];

for (const { file, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, file));
  console.log(`✓ ${file} (${size}×${size})`);
}
