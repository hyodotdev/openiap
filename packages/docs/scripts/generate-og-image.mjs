// Regenerates public/og-image.webp, the card every shared openiap.dev link shows.
// The previous image existed only as a binary, so when OpenIAP stopped calling
// itself a specification the card kept saying so with no way to edit it. Keep
// this script as the source: change the copy below and re-run.
//
//   bun packages/docs/scripts/generate-og-image.mjs
//
// sharp lives in packages/kit; this resolves it from there.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, '..');
const sharp = createRequire(join(docsRoot, '../kit/package.json'))('sharp');

const WIDTH = 1200;
const HEIGHT = 630;

// The wordmark is one word with IAP in the accent colour, as the hero sets it.
// Never write it as "Open IAP" — split, it reads as a description, not a name.
// Hex resolved from the light theme in src/styles/variables.css; a rasteriser
// cannot read CSS variables, so update both together.
const BRAND = { stem: 'Open', accent: 'IAP' };
const INK = '#1a1a1a'; // --text-primary
const ACCENT = '#dc6843'; // --accent-color
const TRACKING = -2;
// SEO.tsx already composes og:title as "<page title> | OpenIAP", so every card
// carries the tagline as its caption. The image says what that caption cannot.
const SUBTITLE = [
  'One purchase contract across platforms,',
  'one commerce contract across backends',
];
const DOMAIN = 'openiap.dev';

// Sampled from the image this replaces, so the card keeps its warm paper look.
const background = `
  <defs>
    <linearGradient id="paper" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fdfbf7"/>
      <stop offset="55%" stop-color="#f3ece3"/>
      <stop offset="100%" stop-color="#e8d6c8"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#paper)"/>`;

const SANS = 'Helvetica Neue, Helvetica, Arial, sans-serif';

// Older librsvg drops inherited tracking at a tspan boundary, so set it twice.
const text = `
  <text x="${WIDTH / 2}" y="322" text-anchor="middle" fill="${INK}"
        font-family="${SANS}" font-size="86" font-weight="700"
        letter-spacing="${TRACKING}">${BRAND.stem}<tspan fill="${ACCENT}"
        letter-spacing="${TRACKING}">${BRAND.accent}</tspan></text>
  ${SUBTITLE.map(
    (line, i) => `
  <text x="${WIDTH / 2}" y="${392 + i * 44}" text-anchor="middle" fill="#57534e"
        font-family="${SANS}" font-size="32">${line}</text>`
  ).join('')}
  <text x="${WIDTH / 2}" y="548" text-anchor="middle" fill="#8b5e3c"
        font-family="Menlo, Consolas, monospace"
        font-size="24" letter-spacing="1">${DOMAIN}</text>`;

const LOGO = 132;
const logo = await sharp(join(docsRoot, 'public', 'logo.webp'))
  .resize(LOGO, LOGO, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .toBuffer();

const out = join(docsRoot, 'public', 'og-image.webp');
await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${background}${text}</svg>`
  )
)
  .composite([{ input: logo, top: 96, left: Math.round((WIDTH - LOGO) / 2) }])
  .webp({ quality: 90 })
  .toFile(out);

console.log(
  `og-image.webp regenerated: ${WIDTH}x${HEIGHT}, "${BRAND.stem}${BRAND.accent}"`
);
