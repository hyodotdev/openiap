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

  // Check file extension
  if (validation.extensions.length > 0) {
    const fileExtension = getFileExtension(fileName).toLowerCase();
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
  if (validation.mimeTypes.length > 0 && fileType) {
    // Allow if MIME type matches OR if it's a generic binary/text type
    const mimeTypesList = validation.mimeTypes as readonly string[];
    const isValidMime =
      mimeTypesList.includes(fileType) ||
      fileType === "application/octet-stream" ||
      fileType === "text/plain";

    if (!isValidMime) {
      console.warn(
        `Unexpected MIME type for ${purpose}: ${fileType}. ` +
          `Expected one of: ${validation.mimeTypes.join(", ")}`,
      );
      // Don't throw error for MIME type mismatch, just warn
      // Browsers are inconsistent with MIME types
    }
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
  }
}
