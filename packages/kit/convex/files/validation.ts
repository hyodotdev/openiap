import { ConvexError } from "convex/values";

// File extension and MIME type mappings for each purpose
const FILE_VALIDATIONS = {
  apple_p8_key: {
    extensions: [".p8"],
    mimeTypes: [
      "application/x-pem-file",
      "application/octet-stream", // Sometimes .p8 files are detected as binary
      "text/plain", // Sometimes .p8 files are detected as text
    ],
    maxSize: 10 * 1024, // 10KB max for .p8 keys
    description: "Apple P8 private key",
  },
  certificate: {
    extensions: [".pem", ".crt", ".cer", ".p12", ".pfx", ".der"],
    mimeTypes: [
      "application/x-x509-ca-cert",
      "application/x-pem-file",
      "application/x-pkcs12",
      "application/pkcs12",
      "application/x-pkcs7-certificates",
      "application/octet-stream",
    ],
    maxSize: 100 * 1024, // 100KB max for certificates
    description: "SSL/TLS certificate",
  },
  config: {
    extensions: [".json", ".yaml", ".yml", ".toml", ".xml", ".env"],
    mimeTypes: [
      "application/json",
      "application/x-yaml",
      "text/yaml",
      "application/toml",
      "application/xml",
      "text/xml",
      "text/plain",
    ],
    maxSize: 2 * 1024 * 1024, // 2MB max for config files (service accounts can be large)
    description: "Configuration file",
  },
  credential: {
    extensions: [".json", ".p8", ".pem", ".key", ".txt"],
    mimeTypes: [
      "application/json",
      "application/x-pem-file",
      "text/plain",
      "application/octet-stream",
    ],
    maxSize: 500 * 1024, // 500KB max for credentials (service accounts can be larger)
    description: "API credential or key",
  },
  apple_iap_review_screenshot: {
    extensions: [".png", ".jpg", ".jpeg"],
    mimeTypes: ["image/png", "image/jpeg"],
    maxSize: 10 * 1024 * 1024,
    description: "Apple in-app purchase App Review screenshot",
  },
  other: {
    extensions: [], // No restriction for "other" type
    mimeTypes: [],
    maxSize: 10 * 1024 * 1024, // 10MB max for other files
    description: "General file",
  },
} as const;

export type FilePurpose = keyof typeof FILE_VALIDATIONS;

// Validate file based on purpose
export function validateFile(
  fileName: string,
  fileType: string,
  fileSize: number,
  purpose: FilePurpose,
): void {
  const validation = FILE_VALIDATIONS[purpose];
  const fileExtension = getFileExtension(fileName).toLowerCase();

  // Check file extension
  if (validation.extensions.length > 0) {
    const extensionsList = validation.extensions as readonly string[];
    if (!extensionsList.includes(fileExtension)) {
      throw new ConvexError(
        `Invalid file extension for ${purpose}. ` +
          `Expected: ${validation.extensions.join(", ")}. ` +
          `Got: ${fileExtension}`,
      );
    }
  }

  // Check MIME type (more lenient since browsers can be inconsistent)
  if (
    validation.mimeTypes.length > 0 &&
    (fileType !== "" || purpose === "apple_iap_review_screenshot")
  ) {
    // Credentials are frequently labelled as generic bytes by browsers.
    // Review screenshots are different: ASC only accepts PNG/JPEG and we
    // must not persist a spoofed content type for a later binary upload.
    const mimeTypesList = validation.mimeTypes as readonly string[];
    const isValidMime =
      (fileType !== "" && mimeTypesList.includes(fileType)) ||
      (purpose !== "apple_iap_review_screenshot" &&
        (fileType === "application/octet-stream" || fileType === "text/plain"));

    if (!isValidMime) {
      if (purpose === "apple_iap_review_screenshot") {
        throw new ConvexError(
          `Invalid MIME type for ${purpose}. ` +
            `Expected one of: ${validation.mimeTypes.join(", ")}. ` +
            `Got: ${fileType || "(empty)"}`,
        );
      }
      console.warn(
        `Unexpected MIME type for ${purpose}: ${fileType}. ` +
          `Expected one of: ${validation.mimeTypes.join(", ")}`,
      );
      // Don't throw error for MIME type mismatch, just warn
      // Browsers are inconsistent with MIME types
    }
  }

  if (
    purpose === "apple_iap_review_screenshot" &&
    ((fileExtension === ".png" && fileType !== "image/png") ||
      ((fileExtension === ".jpg" || fileExtension === ".jpeg") &&
        fileType !== "image/jpeg"))
  ) {
    throw new ConvexError(
      "App Review screenshot extension must match its PNG or JPEG MIME type",
    );
  }

  // Check file size
  if (fileSize > validation.maxSize) {
    throw new ConvexError(
      `File too large for ${purpose}. ` +
        `Maximum size: ${formatFileSize(validation.maxSize)}. ` +
        `Got: ${formatFileSize(fileSize)}`,
    );
  }
}

// Get file extension from filename
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) {
    return "";
  }
  return fileName.substring(lastDot);
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Validate Apple P8 key specifically
export function validateAppleP8Key(fileName: string, fileSize: number): void {
  if (!fileName.endsWith(".p8")) {
    throw new ConvexError(
      "Invalid Apple key file. File must have .p8 extension",
    );
  }

  if (fileSize > 10 * 1024) {
    throw new ConvexError(
      `Apple P8 key file too large. Maximum size: 10KB. Got: ${formatFileSize(fileSize)}`,
    );
  }

  // Additional validation for filename pattern (optional)
  // Apple keys usually follow pattern: AuthKey_[KEY_ID].p8
  if (!fileName.match(/^AuthKey_[A-Z0-9]+\.p8$/i)) {
    console.warn(
      `Apple P8 key filename doesn't match expected pattern: AuthKey_[KEY_ID].p8`,
    );
  }
}

// Validate JSON config file
export function validateJsonConfig(
  fileName: string,
  fileType: string,
  fileSize: number,
): void {
  if (!fileName.endsWith(".json")) {
    throw new ConvexError(
      "Invalid config file. File must have .json extension",
    );
  }

  if (fileSize > 1024 * 1024) {
    throw new ConvexError(
      `Config file too large. Maximum size: 1MB. Got: ${formatFileSize(fileSize)}`,
    );
  }

  // Check MIME type
  const validMimeTypes = [
    "application/json",
    "text/plain",
    "application/octet-stream",
  ];
  if (fileType && !validMimeTypes.includes(fileType)) {
    console.warn(`Unexpected MIME type for JSON: ${fileType}`);
  }
}

// Validate certificate file
export function validateCertificate(fileName: string, fileSize: number): void {
  const validExtensions = [".pem", ".crt", ".cer", ".p12", ".pfx", ".der"];
  const fileExtension = getFileExtension(fileName).toLowerCase();

  if (!validExtensions.includes(fileExtension)) {
    throw new ConvexError(
      `Invalid certificate file. Supported formats: ${validExtensions.join(", ")}`,
    );
  }

  if (fileSize > 100 * 1024) {
    throw new ConvexError(
      `Certificate file too large. Maximum size: 100KB. Got: ${formatFileSize(fileSize)}`,
    );
  }
}

// Check if file content looks like valid JSON
export async function validateJsonContent(content: string): Promise<void> {
  try {
    JSON.parse(content);
  } catch {
    throw new ConvexError("Invalid JSON content in file");
  }
}

// Check if file content looks like valid P8 key
export function validateP8Content(content: string): void {
  // P8 keys should contain these markers
  if (
    !content.includes("-----BEGIN PRIVATE KEY-----") ||
    !content.includes("-----END PRIVATE KEY-----")
  ) {
    throw new ConvexError(
      "Invalid P8 key format. File must contain valid private key markers",
    );
  }

  // Basic structure validation
  const lines = content.split("\n");
  if (lines.length < 5) {
    throw new ConvexError("P8 key file appears to be corrupted or incomplete");
  }
}

export function validateGoogleServiceAccountContent(content: string): {
  clientEmail: string;
  privateKey: string;
} {
  let credential: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error();
    }
    credential = parsed as Record<string, unknown>;
  } catch {
    throw new ConvexError("Google service-account JSON is malformed");
  }
  const clientEmail =
    typeof credential.client_email === "string"
      ? credential.client_email.trim().toLowerCase()
      : "";
  const privateKey =
    typeof credential.private_key === "string" ? credential.private_key : "";
  if (
    credential.type !== "service_account" ||
    !/^[^@\s]+@[^@\s]+\.gserviceaccount\.com$/.test(clientEmail) ||
    !privateKey.includes("-----BEGIN PRIVATE KEY-----") ||
    !privateKey.includes("-----END PRIVATE KEY-----") ||
    credential.token_uri !== "https://oauth2.googleapis.com/token"
  ) {
    throw new ConvexError(
      "Upload the complete service-account JSON generated by Google Cloud",
    );
  }
  return { clientEmail, privateKey };
}

// Check if file content looks like valid PEM certificate
export function validatePemContent(content: string): void {
  // PEM certificates should contain these markers
  const hasBeginCert =
    content.includes("-----BEGIN CERTIFICATE-----") ||
    content.includes("-----BEGIN TRUSTED CERTIFICATE-----") ||
    content.includes("-----BEGIN X509 CERTIFICATE-----");

  const hasEndCert =
    content.includes("-----END CERTIFICATE-----") ||
    content.includes("-----END TRUSTED CERTIFICATE-----") ||
    content.includes("-----END X509 CERTIFICATE-----");

  if (!hasBeginCert || !hasEndCert) {
    throw new ConvexError(
      "Invalid PEM certificate format. File must contain valid certificate markers",
    );
  }
}

// Main validation function to use in actions
export function validateFileUpload(
  fileName: string,
  fileType: string,
  fileSize: number,
  purpose: FilePurpose,
): void {
  // Basic validation
  if (!fileName || fileName.trim() === "") {
    throw new ConvexError("File name is required");
  }

  if (fileSize <= 0) {
    throw new ConvexError("File cannot be empty");
  }

  if (fileSize > 10 * 1024 * 1024) {
    throw new ConvexError(
      `File too large. Maximum size: 10MB. Got: ${formatFileSize(fileSize)}`,
    );
  }

  // Purpose-specific validation
  validateFile(fileName, fileType, fileSize, purpose);

  // Additional specific validations
  switch (purpose) {
    case "apple_p8_key":
      validateAppleP8Key(fileName, fileSize);
      break;
    case "certificate":
      validateCertificate(fileName, fileSize);
      break;
    case "config":
      if (fileName.endsWith(".json")) {
        validateJsonConfig(fileName, fileType, fileSize);
      }
      break;
    case "apple_iap_review_screenshot":
      // Extension, strict MIME, non-empty size, and the 10 MB cap are all
      // enforced above. Binary magic is checked again immediately before ASC
      // upload, after reading the private blob from Convex storage.
      break;
  }
}

/**
 * Validate the private blob immediately before it is uploaded to ASC.
 *
 * Browser-provided names and MIME types are metadata only. This lightweight
 * signature/transparency check runs in both runtimes; the upload reservation
 * receives its trusted marker only after `files/action.ts` also performs a
 * full Sharp decode. PNG screenshots with alpha are rejected because App
 * Store Connect rejects them after upload processing.
 */
export function validateAppleReviewScreenshotContent(
  content: Uint8Array,
  declaredMimeType: string,
): void {
  if (content.byteLength === 0) {
    throw new ConvexError("App Review screenshot cannot be empty");
  }
  if (content.byteLength > 10 * 1024 * 1024) {
    throw new ConvexError("App Review screenshot must be 10 MB or smaller");
  }

  const isPng =
    content.byteLength >= 26 &&
    content[0] === 0x89 &&
    content[1] === 0x50 &&
    content[2] === 0x4e &&
    content[3] === 0x47 &&
    content[4] === 0x0d &&
    content[5] === 0x0a &&
    content[6] === 0x1a &&
    content[7] === 0x0a &&
    String.fromCharCode(...content.subarray(12, 16)) === "IHDR";
  const isJpeg =
    content.byteLength >= 4 &&
    content[0] === 0xff &&
    content[1] === 0xd8 &&
    content[content.byteLength - 2] === 0xff &&
    content[content.byteLength - 1] === 0xd9;

  if (!isPng && !isJpeg) {
    throw new ConvexError(
      "App Review screenshot content must be a valid PNG or JPEG",
    );
  }
  if (isPng && declaredMimeType !== "image/png") {
    throw new ConvexError(
      "App Review screenshot MIME type does not match its PNG content",
    );
  }
  if (isJpeg && declaredMimeType !== "image/jpeg") {
    throw new ConvexError(
      "App Review screenshot MIME type does not match its JPEG content",
    );
  }

  // PNG IHDR byte 25 is the color type: 4 and 6 include alpha.
  if (isPng && (content[25] === 4 || content[25] === 6)) {
    throw new ConvexError(
      "App Review PNG screenshots cannot contain an alpha channel",
    );
  }
  if (isPng && pngContainsTransparencyChunk(content)) {
    throw new ConvexError(
      "App Review PNG screenshots cannot contain transparency metadata",
    );
  }
}

function pngContainsTransparencyChunk(content: Uint8Array): boolean {
  const view = new DataView(
    content.buffer,
    content.byteOffset,
    content.byteLength,
  );
  let offset = 8;
  while (offset + 12 <= content.byteLength) {
    const length = view.getUint32(offset, false);
    const typeOffset = offset + 4;
    if (
      content[typeOffset] === 0x74 &&
      content[typeOffset + 1] === 0x52 &&
      content[typeOffset + 2] === 0x4e &&
      content[typeOffset + 3] === 0x53
    ) {
      return true;
    }
    const nextOffset = offset + 12 + length;
    if (nextOffset <= offset || nextOffset > content.byteLength) return false;
    offset = nextOffset;
  }
  return false;
}
