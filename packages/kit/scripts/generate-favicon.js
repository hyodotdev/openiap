import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

async function generateFavicon() {
  try {
    // Read the logo
    const logoPath = join(projectRoot, "public", "logo.png");

    // Generate multiple favicon sizes
    const sizes = [16, 32, 48, 64, 128, 256];

    for (const size of sizes) {
      await sharp(logoPath)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .toFile(join(projectRoot, "public", `favicon-${size}x${size}.png`));

      console.log(`✓ Generated favicon-${size}x${size}.png`);
    }

    // Generate the main favicon.ico (contains multiple sizes)
    await sharp(logoPath)
      .resize(32, 32, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .toFile(join(projectRoot, "public", "favicon.png"));

    console.log("✓ Generated favicon.png");

    // Generate apple-touch-icon
    await sharp(logoPath)
      .resize(180, 180, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .toFile(join(projectRoot, "public", "apple-touch-icon.png"));

    console.log("✓ Generated apple-touch-icon.png");

    // Generate android chrome icons
    const androidSizes = [192, 512];
    for (const size of androidSizes) {
      await sharp(logoPath)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .toFile(
          join(projectRoot, "public", `android-chrome-${size}x${size}.png`),
        );

      console.log(`✓ Generated android-chrome-${size}x${size}.png`);
    }

    // Create manifest.json
    const manifest = {
      name: "IAPKit",
      short_name: "IAPKit",
      description: "In-App Purchase Receipt Validation",
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
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
