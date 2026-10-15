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

export interface ClientPayloadDraft {
  format: ClientPayloadFormat;
  body: string;
  baseVersion: number;
  updatedAt: number;
}

export interface ClientPayloadVersionSummary {
  version: number;
  action: "publish" | "rollback" | "remove";
  format?: ClientPayloadFormat;
  byteLength?: number;
  rolledBackFrom?: number;
  note?: string;
  author?: { type: "user" | "apiKey"; name?: string };
  createdAt: number;
}

export interface ClientPayloadVersion extends ClientPayloadVersionSummary {
  body?: string;
}

export interface ClientPayloadSdkPreview {
  keyPreview: string;
  etagScope: string;
  response: {
    status: number;
    headers: Record<string, string>;
    body: string;
  };
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

export type DiffLine = { type: "same" | "add" | "remove"; text: string };

// Bodies are capped at 16 KiB; this bounds the LCS table for line-heavy ones.
const MAX_DIFF_CELLS = 1_000_000;

/** Line diff from `before` to `after`. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start += 1;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const same = (lines: string[]): DiffLine[] =>
    lines.map((text) => ({ type: "same", text }));
  return [
    ...same(a.slice(0, start)),
    ...diffMiddle(a.slice(start, endA), b.slice(start, endB)),
    ...same(a.slice(endA)),
  ];
}

function diffMiddle(a: string[], b: string[]): DiffLine[] {
  const removed = a.map((text): DiffLine => ({ type: "remove", text }));
  const added = b.map((text): DiffLine => ({ type: "add", text }));
  if ((a.length + 1) * (b.length + 1) > MAX_DIFF_CELLS) {
    return [...removed, ...added];
  }
  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ type: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      lines.push(removed[i]);
      i += 1;
    } else {
      lines.push(added[j]);
      j += 1;
    }
  }
  return [...lines, ...removed.slice(i), ...added.slice(j)];
}
