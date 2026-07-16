import { parse as parseToml, TomlError } from "smol-toml";

export const MAX_CLIENT_PAYLOAD_BODY_BYTES = 16 * 1024;

export type ClientPayloadFormat = "toml" | "json" | "text";

export interface ProductClientPayloadSummary {
  format: ClientPayloadFormat;
  version: number;
  updatedAt: number;
}

export interface ProductClientPayload extends ProductClientPayloadSummary {
  body: string;
}

export interface ClientPayloadValidationResult {
  byteLength: number;
  error?: string;
  valid: boolean;
}

export function getClientPayloadByteLength(body: string): number {
  return new TextEncoder().encode(body).byteLength;
}

export function validateClientPayload(
  format: ClientPayloadFormat,
  body: string,
): ClientPayloadValidationResult {
  const byteLength = getClientPayloadByteLength(body);

  if (!body.trim()) {
    return {
      byteLength,
      error: "Payload body must not be blank.",
      valid: false,
    };
  }

  if (byteLength > MAX_CLIENT_PAYLOAD_BODY_BYTES) {
    return {
      byteLength,
      error: `Payload body must be ${formatClientPayloadBytes(MAX_CLIENT_PAYLOAD_BODY_BYTES)} or smaller.`,
      valid: false,
    };
  }

  if (format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body) as unknown;
    } catch {
      return {
        byteLength,
        error: "Payload body is not valid JSON.",
        valid: false,
      };
    }

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {
        byteLength,
        error: "JSON payload must be an object, not an array or scalar.",
        valid: false,
      };
    }
  }

  if (format === "toml") {
    try {
      parseToml(body);
    } catch (error) {
      const location =
        error instanceof TomlError
          ? ` at line ${error.line}, column ${error.column}`
          : "";
      return {
        byteLength,
        error: `Payload body is not valid TOML${location}.`,
        valid: false,
      };
    }
  }

  return { byteLength, valid: true };
}

export function formatClientPayloadBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kibibytes = bytes / 1024;
  return `${Number.isInteger(kibibytes) ? kibibytes : kibibytes.toFixed(1)} KiB`;
}
