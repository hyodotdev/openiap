/**
 * Unit tests for agent utility functions
 */

import { describe, expect, test } from "bun:test";
import * as crypto from "crypto";
import {
  extractGraphQLSymbols,
  getPackageName,
  splitMarkdownByHeaders,
} from "../indexer.js";

// ============================================================================
// Test utility functions extracted from indexer.ts
// ============================================================================

function calculateChecksum(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
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
    graphql: "graphql",
  };
  return langMap[ext] || "unknown";
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
    expect(getPackageName("packages/google/openiap/src/Main.kt")).toBe(
      "google",
    );
  });

  test("should identify OpenIAP specifications", () => {
    expect(getPackageName("specs/openiap/client/src/types.ts")).toBe("spec");
    expect(getPackageName("specs/openiap/commerce-protocol/SPEC.md")).toBe(
      "spec",
    );
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

  test("should identify GraphQL schema files", () => {
    expect(getLanguage("schema.graphql")).toBe("graphql");
  });

  test("should return unknown for unrecognized extensions", () => {
    expect(getLanguage("file.py")).toBe("unknown");
    expect(getLanguage("file.md")).toBe("unknown");
  });
});

describe("extractGraphQLSymbols", () => {
  test("indexes zero-argument and multiline root operations", () => {
    const symbols = extractGraphQLSymbols(`
extend type Query {
  getStorefront: String!
  getBillingChoiceInfoAndroid(
    params: GetBillingChoiceInfoParamsAndroid
  ): BillingChoiceInfoAndroid
}

input GetBillingChoiceInfoParamsAndroid {
  includeImages: Boolean
}
`);

    expect(
      symbols
        .filter((symbol) => symbol.kind === "function")
        .map((symbol) => symbol.name),
    ).toEqual(["getStorefront", "getBillingChoiceInfoAndroid"]);
    expect(symbols.map((symbol) => symbol.name)).toContain(
      "GetBillingChoiceInfoParamsAndroid",
    );
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

  test("should treat custom header prefixes as literal text", () => {
    const prefix = "[section]\\marker";
    const chunks = splitMarkdownByHeaders(
      `${prefix} Literal heading\nContent`,
      [[prefix, "section"]],
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].metadata.section).toBe("Literal heading");
    expect(chunks[0].content).toBe("Content");
  });
});
