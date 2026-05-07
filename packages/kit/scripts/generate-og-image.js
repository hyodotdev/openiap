import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

async function generateOGImage() {
  try {
    // Create a 1200x630 image (standard OG image size)
    const width = 1200;
    const height = 630;

    // Create SVG with gradient background and logo
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#faf8f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f5f1ed;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#a47465;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#dc6843;stop-opacity:1" />
          </linearGradient>
        </defs>

        <!-- Background -->
        <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>

        <!-- Decorative circles -->
        <circle cx="100" cy="100" r="200" fill="#a47465" opacity="0.05"/>
        <circle cx="${width - 150}" cy="${height - 100}" r="300" fill="#dc6843" opacity="0.05"/>

        <!-- Logo placeholder (will overlay actual logo) -->
        <rect x="${width / 2 - 60}" y="120" width="120" height="120" rx="20" fill="#a47465" opacity="0.1"/>

        <!-- Text -->
        <text x="${width / 2}" y="320" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="bold" text-anchor="middle" fill="#1a1a1a">
          IAPKit
        </text>

        <text x="${width / 2}" y="390" font-family="system-ui, -apple-system, sans-serif" font-size="32" text-anchor="middle" fill="#666666">
          In-App Purchase Receipt Validation for your iOS and Android apps
        </text>

        <!-- Website -->
        <text x="${width / 2}" y="${height - 60}" font-family="system-ui, -apple-system, sans-serif" font-size="20" text-anchor="middle" fill="#a47465">
          kit.openiap.dev
        </text>
      </svg>
    `;

    // Convert SVG to buffer
    const svgBuffer = Buffer.from(svg);

    // Create the base image from SVG
    const baseImage = await sharp(svgBuffer)
      .resize(width, height)
      .webp()
      .toBuffer();

    // Read and resize logo
    const logoPath = join(projectRoot, "public", "logo.webp");
    const logo = await sharp(logoPath)
      .resize(120, 120, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .toBuffer();

    // Composite logo onto base image
    await sharp(baseImage)
      .composite([
        {
          input: logo,
          top: 120,
          left: Math.floor(width / 2 - 60),
        },
      ])
      .toFile(join(projectRoot, "public", "og-preview.webp"));

    console.log("✓ Generated og-preview.webp");
  } catch (error) {
    console.error("Error generating OG image:", error);
    process.exit(1);
  }
}

generateOGImage();
