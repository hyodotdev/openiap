/**
 * Unit tests for agent utility functions
 */

import { describe, expect, test } from "bun:test";
import * as crypto from "crypto";

// ============================================================================
// Test utility functions extracted from indexer.ts
// ============================================================================

function calculateChecksum(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

function getPackageName(filePath: string): string {
  if (filePath.includes("packages/apple")) return "apple";
  if (filePath.includes("packages/google")) return "google";
  if (filePath.includes("packages/gql")) return "gql";
  if (filePath.includes("packages/docs")) return "docs";
  return "unknown";
}

function getLanguage(filePath: string): string {
  const ext = filePath.split(".").pop() || "";
  const langMap: Record<string, string> = {
    swift: "swift",
    kt: "kotlin",
    ts: "typescript",
    tsx: "typescript-react",
    js: "javascript",
    jsx: "javascript-react",
  };
  return langMap[ext] || "unknown";
}

interface MarkdownChunk {
  content: string;
  metadata: Record<string, string>;
}

function splitMarkdownByHeaders(
  text: string,
  headersToSplitOn: [string, string][] = [
    ["#", "h1"],
    ["##", "h2"],
    ["###", "h3"],
    ["####", "h4"],
  ]
): MarkdownChunk[] {
  const lines = text.split("\n");
  const chunks: MarkdownChunk[] = [];
  let currentChunk: string[] = [];
  let currentMetadata: Record<string, string> = {};

  for (const line of lines) {
    let headerFound = false;

    for (const [headerPrefix, metadataKey] of headersToSplitOn) {
      const regex = new RegExp(`^${headerPrefix.replace(/#/g, "\\#")}\\s+(.+)$`);
      const match = line.match(regex);

      const isExactLevel =
        line.startsWith(headerPrefix + " ") &&
        !line.startsWith(headerPrefix + "#");

      if (match && isExactLevel) {
        if (currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.join("\n").trim(),
            metadata: { ...currentMetadata },
          });
        }

        currentChunk = [];
        currentMetadata[metadataKey] = match[1].trim();

        const headerIndex = headersToSplitOn.findIndex(
          ([p]) => p === headerPrefix
        );
        for (let i = headerIndex + 1; i < headersToSplitOn.length; i++) {
          delete currentMetadata[headersToSplitOn[i][1]];
        }

        headerFound = true;
        break;
      }
    }

    if (!headerFound) {
      currentChunk.push(line);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join("\n").trim(),
      metadata: { ...currentMetadata },
    });
  }

  return chunks.filter((chunk) => chunk.content.length > 0);
}

// ============================================================================
// Tests
// ============================================================================

describe("calculateChecksum", () => {
  test("should return consistent MD5 hash for same content", () => {
    const content = "Hello, World!";
    const hash1 = calculateChecksum(content);
    const hash2 = calculateChecksum(content);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(32); // MD5 produces 32 hex chars
  });

  test("should return different hash for different content", () => {
    const hash1 = calculateChecksum("Hello");
    const hash2 = calculateChecksum("World");
    expect(hash1).not.toBe(hash2);
  });

  test("should handle empty string", () => {
    const hash = calculateChecksum("");
    expect(hash).toBe("d41d8cd98f00b204e9800998ecf8427e"); // MD5 of empty string
  });
});

describe("getPackageName", () => {
  test("should identify apple package", () => {
    expect(getPackageName("packages/apple/Sources/Module.swift")).toBe("apple");
  });

  test("should identify google package", () => {
    expect(getPackageName("packages/google/openiap/src/Main.kt")).toBe("google");
  });

  test("should identify gql package", () => {
    expect(getPackageName("packages/gql/src/types.ts")).toBe("gql");
  });

  test("should identify docs package", () => {
    expect(getPackageName("packages/docs/src/components/App.tsx")).toBe("docs");
  });

  test("should return unknown for unrecognized paths", () => {
    expect(getPackageName("some/random/path.ts")).toBe("unknown");
  });
});

describe("getLanguage", () => {
  test("should identify Swift files", () => {
    expect(getLanguage("Module.swift")).toBe("swift");
  });

  test("should identify Kotlin files", () => {
    expect(getLanguage("Module.kt")).toBe("kotlin");
  });

  test("should identify TypeScript files", () => {
    expect(getLanguage("index.ts")).toBe("typescript");
  });

  test("should identify TypeScript React files", () => {
    expect(getLanguage("Component.tsx")).toBe("typescript-react");
  });

  test("should identify JavaScript files", () => {
    expect(getLanguage("script.js")).toBe("javascript");
  });

  test("should return unknown for unrecognized extensions", () => {
    expect(getLanguage("file.py")).toBe("unknown");
    expect(getLanguage("file.md")).toBe("unknown");
  });
});

describe("splitMarkdownByHeaders", () => {
  test("should split by h1 headers", () => {
    const markdown = `# Header 1
Content under header 1

# Header 2
Content under header 2`;

    const chunks = splitMarkdownByHeaders(markdown);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].metadata.h1).toBe("Header 1");
    expect(chunks[0].content).toContain("Content under header 1");
    expect(chunks[1].metadata.h1).toBe("Header 2");
  });

  test("should split by h2 headers", () => {
    const markdown = `## Section A
Content A

## Section B
Content B`;

    const chunks = splitMarkdownByHeaders(markdown);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].metadata.h2).toBe("Section A");
    expect(chunks[1].metadata.h2).toBe("Section B");
  });

  test("should handle nested headers", () => {
    const markdown = `# Main
## Sub
Content

## Another Sub
More content`;

    const chunks = splitMarkdownByHeaders(markdown);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].metadata.h1).toBe("Main");
    expect(chunks[0].metadata.h2).toBe("Sub");
    expect(chunks[1].metadata.h1).toBe("Main");
    expect(chunks[1].metadata.h2).toBe("Another Sub");
  });

  test("should filter empty chunks", () => {
    const markdown = `# Header

`;

    const chunks = splitMarkdownByHeaders(markdown);
    expect(chunks).toHaveLength(0);
  });

  test("should handle content before first header", () => {
    const markdown = `Some intro text

# Header
Content`;

    const chunks = splitMarkdownByHeaders(markdown);
    // First chunk should be the intro text, second should be after header
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});
