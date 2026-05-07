import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

async function generateFavicon() {
  try {
    // Read the logo
    const logoPath = join(projectRoot, "public", "logo.webp");

    // Generate multiple favicon sizes
    const sizes = [16, 32, 48, 64, 128, 256];

    for (const size of sizes) {
      await sharp(logoPath)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .toFile(join(projectRoot, "public", `favicon-${size}x${size}.webp`));

      console.log(`✓ Generated favicon-${size}x${size}.webp`);
    }

    // Generate the main favicon image.
    await sharp(logoPath)
      .resize(32, 32, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .toFile(join(projectRoot, "public", "favicon.webp"));

    console.log("✓ Generated favicon.webp");

    // Generate apple-touch-icon
    await sharp(logoPath)
      .resize(180, 180, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .toFile(join(projectRoot, "public", "apple-touch-icon.webp"));

    console.log("✓ Generated apple-touch-icon.webp");

    // Generate android chrome icons
    const androidSizes = [192, 512];
    for (const size of androidSizes) {
      await sharp(logoPath)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .toFile(
          join(projectRoot, "public", `android-chrome-${size}x${size}.webp`),
        );

      console.log(`✓ Generated android-chrome-${size}x${size}.webp`);
    }

    // Create manifest.json
    const manifest = {
      name: "IAPKit",
      short_name: "IAPKit",
      description: "In-App Purchase Receipt Validation",
      icons: [
        {
          src: "/android-chrome-192x192.webp",
          sizes: "192x192",
          type: "image/webp",
        },
        {
          src: "/android-chrome-512x512.webp",
          sizes: "512x512",
          type: "image/webp",
        },
      ],
      theme_color: "#a47465",
      background_color: "#faf8f6",
      display: "standalone",
      start_url: "/",
    };

    writeFileSync(
      join(projectRoot, "public", "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );

    console.log("✓ Generated manifest.json");

    console.log("\n✅ All favicons generated successfully!");
  } catch (error) {
    console.error("Error generating favicons:", error);
    process.exit(1);
  }
}

generateFavicon();
