/**
 * Generates the PNG app icons the web manifest and iOS need from
 * public/logo.svg. Run after changing the logo:
 *   npx tsx scripts/generate-pwa-icons.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(ROOT, 'public/logo.svg'));
const out = (name: string) => path.join(ROOT, 'public/icons', name);
const BACKGROUND = '#111111';

async function plain(size: number, name: string) {
  await sharp(svg, { density: 600 }).resize(size, size).png().toFile(out(name));
}

/** Full-bleed square with the logo inside the 80% safe zone (Android adaptive icons crop the rest). */
async function maskable(size: number, name: string) {
  const inner = Math.round(size * 0.7);
  const logo = await sharp(svg, { density: 600 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out(name));
}

/** iOS ignores transparency and adds its own rounding, so flatten onto the brand background. */
async function appleTouch(size: number, name: string) {
  await sharp(svg, { density: 600 }).resize(size, size).flatten({ background: BACKGROUND }).png().toFile(out(name));
}

async function main() {
  fs.mkdirSync(path.join(ROOT, 'public/icons'), { recursive: true });
  await plain(192, 'icon-192.png');
  await plain(512, 'icon-512.png');
  await maskable(512, 'maskable-512.png');
  await appleTouch(180, 'apple-touch-icon.png');
  console.log('PWA icons written to public/icons');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
