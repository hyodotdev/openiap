#!/usr/bin/env node

/**
 * Utility script to update Apple root certificates
 * Run this script when Apple releases new root certificates or when certificates are about to expire
 */

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CERTIFICATES_DIR = path.join(__dirname, "..", "convex", "certificates");
const APPLE_ROOT_CERTIFICATES = [
  {
    name: "AppleRootCA-G2.cer",
    url: "https://www.apple.com/certificateauthority/AppleRootCA-G2.cer",
    description: "Apple Root CA G2 (Valid: 2006-2035)",
  },
  {
    name: "AppleRootCA-G3.cer",
    url: "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer",
    description: "Apple Root CA G3 (Valid: 2017-2047)",
  },
];

/**
 * Download a certificate from URL
 */
function downloadCertificate(url) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`),
          );
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          console.log(`✓ Downloaded ${buffer.length} bytes`);
          resolve(buffer);
        });
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * Update the TypeScript constants file with new certificates
 */
function updateTypeScriptConstants(certificates) {
  const tsFilePath = path.join(CERTIFICATES_DIR, "apple_root_certificates.ts");

  console.log("\n📝 Updating TypeScript constants...");

  const g2Base64 =
    certificates.find((c) => c.name.includes("G2"))?.base64 || "";
  const g3Base64 =
    certificates.find((c) => c.name.includes("G3"))?.base64 || "";

  const tsContent = `/**
 * Apple Root Certificates
 *
 * These are Apple's public root certificates used for iOS receipt verification.
 * They serve as trust anchors for validating certificate chains in App Store receipts.
 *
 * Certificates are embedded as Base64 strings to ensure they're always available
 * in the Convex runtime environment without requiring file system access.
 *
 * Source: https://www.apple.com/certificateauthority/
 * Last updated: ${new Date().toISOString()}
 */

/**
 * Apple Root CA - G2
 * Valid: April 30, 2014 to April 30, 2035
 * URL: https://www.apple.com/certificateauthority/AppleRootCA-G2.cer
 */
export const APPLE_ROOT_CA_G2_BASE64 = '${g2Base64}';

/**
 * Apple Root CA - G3
 * Valid: April 30, 2014 to April 30, 2039
 * URL: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
 */
export const APPLE_ROOT_CA_G3_BASE64 = '${g3Base64}';

/**
 * Certificate metadata for reference
 */
export const APPLE_ROOT_CERTIFICATES = [
  {
    name: 'Apple Root CA - G2',
    base64: APPLE_ROOT_CA_G2_BASE64,
    validFrom: '2014-04-30',
    validTo: '2035-04-30',
    url: 'https://www.apple.com/certificateauthority/AppleRootCA-G2.cer'
  },
  {
    name: 'Apple Root CA - G3',
    base64: APPLE_ROOT_CA_G3_BASE64,
    validFrom: '2014-04-30',
    validTo: '2039-04-30',
    url: 'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer'
  }
] as const;

/**
 * Load Apple root certificates as Buffer array
 * Converts the embedded Base64 strings to Buffers for use with Apple's library
 */
export function loadAppleRootCertificates(): Buffer[] {

  const certificates: Buffer[] = [];

  for (const cert of APPLE_ROOT_CERTIFICATES) {
    try {
      const buffer = Buffer.from(cert.base64, 'base64');
      certificates.push(buffer);
      console.log(\`✅ Loaded \${cert.name} (\${buffer.length} bytes)\`);
    } catch (error) {
      console.warn(\`❌ Failed to load \${cert.name}:\`, error);
    }
  }

  if (certificates.length === 0) {
    throw new Error('Failed to load any Apple root certificates');
  }

  console.log(\`Successfully loaded \${certificates.length} Apple root certificates\`);
  return certificates;
}`;

  fs.writeFileSync(tsFilePath, tsContent);
  console.log(`✅ Updated TypeScript constants: ${path.basename(tsFilePath)}`);
}

/**
 * Main function to update certificates
 */
async function updateCertificates() {
  console.log("🍎 Updating Apple Root Certificates...\n");

  // Ensure certificates directory exists
  if (!fs.existsSync(CERTIFICATES_DIR)) {
    fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });
    console.log(`📁 Created directory: ${CERTIFICATES_DIR}`);
  }

  let successCount = 0;
  let errorCount = 0;
  const downloadedCertificates = [];

  for (const cert of APPLE_ROOT_CERTIFICATES) {
    try {
      console.log(`\n📥 ${cert.description}`);

      const certData = await downloadCertificate(cert.url);
      const certPath = path.join(CERTIFICATES_DIR, cert.name);

      // Backup existing certificate if it exists
      if (fs.existsSync(certPath)) {
        const backupPath = `${certPath}.backup.${Date.now()}`;
        fs.copyFileSync(certPath, backupPath);
        console.log(
          `💾 Backed up existing certificate to: ${path.basename(backupPath)}`,
        );
      }

      // Write new certificate
      fs.writeFileSync(certPath, certData);
      console.log(`✅ Saved: ${cert.name}`);

      // Store certificate data for TypeScript constants update
      downloadedCertificates.push({
        name: cert.name,
        base64: certData.toString("base64"),
      });

      successCount++;
    } catch (error) {
      console.error(`❌ Failed to update ${cert.name}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successfully updated: ${successCount} certificates`);
  console.log(`   ❌ Failed: ${errorCount} certificates`);

  if (errorCount === 0) {
    // Update TypeScript constants if we have certificates
    if (downloadedCertificates.length > 0) {
      try {
        updateTypeScriptConstants(downloadedCertificates);
      } catch (tsError) {
        console.error(
          `❌ Failed to update TypeScript constants:`,
          tsError.message,
        );
        errorCount++;
      }
    }

    // Clean up certificate files since we only need the TypeScript constants
    console.log("\n🧹 Cleaning up certificate files...");
    for (const cert of APPLE_ROOT_CERTIFICATES) {
      try {
        const certPath = path.join(CERTIFICATES_DIR, cert.name);
        if (fs.existsSync(certPath)) {
          fs.unlinkSync(certPath);
          console.log(`🗑️  Removed: ${cert.name}`);
        }

        // Also clean up any backup files
        const backupFiles = fs
          .readdirSync(CERTIFICATES_DIR)
          .filter(
            (file) => file.startsWith(cert.name) && file.includes(".backup."),
          );
        for (const backupFile of backupFiles) {
          const backupPath = path.join(CERTIFICATES_DIR, backupFile);
          fs.unlinkSync(backupPath);
          console.log(`🗑️  Removed backup: ${backupFile}`);
        }
      } catch (cleanupError) {
        console.warn(
          `⚠️  Could not clean up ${cert.name}:`,
          cleanupError.message,
        );
      }
    }

    if (errorCount === 0) {
      console.log(`\n🎉 All Apple root certificates updated successfully!`);
      console.log(
        `📝 TypeScript constants updated and certificate files cleaned up`,
      );
      console.log(`📂 Only essential file remains: apple_root_certificates.ts`);
    } else {
      console.log(
        `\n⚠️  Certificates updated but TypeScript constants failed. Check the errors above.`,
      );
      process.exit(1);
    }
  } else {
    console.log(
      `\n⚠️  Some certificates failed to update. Check the errors above.`,
    );
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  updateCertificates().catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
}

export { updateCertificates };
