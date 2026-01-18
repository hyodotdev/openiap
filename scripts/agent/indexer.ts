/**
 * OpenIAP Knowledge & Code Map Indexer
 *
 * This script creates a shared knowledge base for both Claude Code and the Local Agent.
 * It performs TWO types of indexing:
 *
 * 1. KNOWLEDGE INDEXING:
 *    - /knowledge/internal/ → type: 'internal_rule' (HIGHEST PRIORITY)
 *    - /knowledge/external/ → type: 'external_api' (Reference material)
 *
 * 2. CODE MAP INDEXING (Simulating Claude Code's Code Graph):
 *    - Scans project source files
 *    - Extracts: file structure, functions, classes, exports
 *    - Stores as type: 'code_map' for code navigation
 *
 * Usage:
 *   bun run index               # Index everything
 *   bun run index --knowledge   # Only index knowledge files
 *   bun run index --code        # Only index code map
 *   bun run index --compile     # Also compile Claude context file
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { glob } from "glob";
import chalk from "chalk";
import * as lancedb from "vectordb";
import { OllamaEmbeddings } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// ============================================================================
// Custom Markdown Header Splitter
// ============================================================================

interface MarkdownChunk {
  content: string;
  metadata: Record<string, string>;
}

/**
 * Custom implementation of MarkdownHeaderTextSplitter
 * Splits markdown by headers while preserving header hierarchy in metadata
 */
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
      // Match exact header level (e.g., "## " but not "### ")
      const regex = new RegExp(`^${headerPrefix.replace(/#/g, "\\#")}\\s+(.+)$`);
      const match = line.match(regex);

      // Make sure it's exactly this level, not a sub-level
      const isExactLevel =
        line.startsWith(headerPrefix + " ") &&
        !line.startsWith(headerPrefix + "#");

      if (match && isExactLevel) {
        // Save previous chunk if exists
        if (currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.join("\n").trim(),
            metadata: { ...currentMetadata },
          });
        }

        // Reset for new section
        currentChunk = [];
        currentMetadata[metadataKey] = match[1].trim();

        // Clear lower-level headers when a higher-level header is found
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

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join("\n").trim(),
      metadata: { ...currentMetadata },
    });
  }

  // Filter out empty chunks
  return chunks.filter((chunk) => chunk.content.length > 0);
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  projectRoot: path.resolve(process.cwd(), "../.."),
  knowledgeRoot: path.resolve(process.cwd(), "../../knowledge"),
  dbPath: path.resolve(process.cwd(), ".lancedb"),

  // Tables
  knowledgeTable: "openiap_knowledge",
  codeMapTable: "openiap_codemap",
  checksumTable: "file_checksums",

  // Ollama
  embeddingModel: process.env.EMBEDDING_MODEL || "nomic-embed-text",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",

  // Code scanning patterns
  sourcePatterns: [
    "packages/apple/Sources/**/*.swift",
    "packages/google/openiap/src/main/**/*.kt",
    "packages/gql/src/**/*.ts",
    "packages/docs/src/**/*.{ts,tsx}",
  ],

  // Ignore patterns (these are auto-generated files)
  ignoreFiles: ["Types.kt", "Types.swift"],
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**",
    "**/*.generated.*",
  ],
};

// ============================================================================
// Types
// ============================================================================

type KnowledgeType = "internal_rule" | "external_api" | "code_map";

interface IndexedDocument {
  [key: string]: unknown;  // Index signature for LanceDB compatibility
  id: string;
  text: string;
  vector: number[];
  // Flat metadata structure for LanceDB Arrow compatibility
  source: string;
  filename: string;
  type: KnowledgeType;
  category: string;
  checksum: string;
  createdAt: string;
  // Code-specific metadata (as strings for Arrow compatibility)
  language: string;
  package_name: string;
  functions: string;  // JSON string of array
  exports: string;    // JSON string of array
}

interface CodeSymbol {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "enum" | "const";
  signature?: string;
  exported: boolean;
  line: number;
}

interface CodeFileInfo {
  path: string;
  language: string;
  package: string;
  symbols: CodeSymbol[];
  imports: string[];
  summary: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function calculateChecksum(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function getPackageName(filePath: string): string {
  if (filePath.includes("packages/apple")) return "apple";
  if (filePath.includes("packages/google")) return "google";
  if (filePath.includes("packages/gql")) return "gql";
  if (filePath.includes("packages/docs")) return "docs";
  return "unknown";
}

function getLanguage(filePath: string): string {
  const ext = path.extname(filePath);
  const langMap: Record<string, string> = {
    ".swift": "swift",
    ".kt": "kotlin",
    ".ts": "typescript",
    ".tsx": "typescript-react",
    ".js": "javascript",
    ".jsx": "javascript-react",
  };
  return langMap[ext] || "unknown";
}

// ============================================================================
// Code Symbol Extraction
// ============================================================================

/**
 * Extract symbols from Swift code
 */
function extractSwiftSymbols(content: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const lines = content.split("\n");

  const patterns = [
    // Public/Open functions
    {
      regex: /^\s*(public|open)\s+(static\s+)?func\s+(\w+)\s*\(([^)]*)\)\s*(async\s*)?(throws\s*)?(->.*)?/,
      kind: "function" as const,
    },
    // Public structs/classes
    {
      regex: /^\s*(public|open)\s+(final\s+)?(class|struct|actor)\s+(\w+)/,
      kind: "class" as const,
    },
    // Public enums
    {
      regex: /^\s*(public|open)\s+enum\s+(\w+)/,
      kind: "enum" as const,
    },
    // Public protocols
    {
      regex: /^\s*(public|open)\s+protocol\s+(\w+)/,
      kind: "interface" as const,
    },
  ];

  lines.forEach((line, index) => {
    for (const { regex, kind } of patterns) {
      const match = line.match(regex);
      if (match) {
        let name: string;
        let signature: string | undefined;

        if (kind === "function") {
          name = match[3];
          signature = line.trim();
        } else if (kind === "class") {
          name = match[4];
        } else if (kind === "enum" || kind === "interface") {
          name = match[2];
        } else {
          name = match[2] || match[3] || "unknown";
        }

        symbols.push({
          name,
          kind,
          signature,
          exported: true,
          line: index + 1,
        });
        break;
      }
    }
  });

  return symbols;
}

/**
 * Extract symbols from Kotlin code
 */
function extractKotlinSymbols(content: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const lines = content.split("\n");

  const patterns = [
    // Functions (public by default, or explicit)
    {
      regex: /^\s*(public\s+|internal\s+|private\s+)?(suspend\s+)?fun\s+(\w+)\s*[<(]/,
      kind: "function" as const,
    },
    // Classes
    {
      regex: /^\s*(public\s+|internal\s+|private\s+)?(data\s+|sealed\s+|open\s+)?(class|object)\s+(\w+)/,
      kind: "class" as const,
    },
    // Enums
    {
      regex: /^\s*(public\s+|internal\s+)?enum\s+class\s+(\w+)/,
      kind: "enum" as const,
    },
    // Interfaces
    {
      regex: /^\s*(public\s+|internal\s+)?interface\s+(\w+)/,
      kind: "interface" as const,
    },
  ];

  lines.forEach((line, index) => {
    for (const { regex, kind } of patterns) {
      const match = line.match(regex);
      if (match) {
        let name: string;
        const isPrivate = match[1]?.includes("private");

        if (kind === "function") {
          name = match[3];
        } else if (kind === "class") {
          name = match[4];
        } else {
          name = match[2];
        }

        if (!isPrivate) {
          symbols.push({
            name,
            kind,
            signature: line.trim(),
            exported: !isPrivate,
            line: index + 1,
          });
        }
        break;
      }
    }
  });

  return symbols;
}

/**
 * Extract symbols from TypeScript code
 */
function extractTypeScriptSymbols(content: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const lines = content.split("\n");

  const patterns = [
    // Exported functions
    {
      regex: /^\s*export\s+(async\s+)?function\s+(\w+)/,
      kind: "function" as const,
      exported: true,
    },
    // Exported arrow functions
    {
      regex: /^\s*export\s+const\s+(\w+)\s*=\s*(async\s+)?\(/,
      kind: "function" as const,
      exported: true,
    },
    // Exported classes
    {
      regex: /^\s*export\s+(default\s+)?(abstract\s+)?class\s+(\w+)/,
      kind: "class" as const,
      exported: true,
    },
    // Exported interfaces
    {
      regex: /^\s*export\s+(default\s+)?interface\s+(\w+)/,
      kind: "interface" as const,
      exported: true,
    },
    // Exported types
    {
      regex: /^\s*export\s+(default\s+)?type\s+(\w+)/,
      kind: "type" as const,
      exported: true,
    },
    // Exported enums
    {
      regex: /^\s*export\s+(const\s+)?enum\s+(\w+)/,
      kind: "enum" as const,
      exported: true,
    },
    // Exported consts
    {
      regex: /^\s*export\s+const\s+(\w+)\s*[=:]/,
      kind: "const" as const,
      exported: true,
    },
  ];

  lines.forEach((line, index) => {
    for (const { regex, kind, exported } of patterns) {
      const match = line.match(regex);
      if (match) {
        const name = match[3] || match[2] || match[1];
        symbols.push({
          name,
          kind,
          signature: line.trim(),
          exported,
          line: index + 1,
        });
        break;
      }
    }
  });

  return symbols;
}

/**
 * Extract symbols based on file type
 */
function extractSymbols(content: string, language: string): CodeSymbol[] {
  switch (language) {
    case "swift":
      return extractSwiftSymbols(content);
    case "kotlin":
      return extractKotlinSymbols(content);
    case "typescript":
    case "typescript-react":
      return extractTypeScriptSymbols(content);
    default:
      return [];
  }
}

/**
 * Generate a summary of the code file
 */
function generateCodeSummary(fileInfo: CodeFileInfo): string {
  const { path: filePath, language, package: pkg, symbols } = fileInfo;

  const functionList = symbols
    .filter((s) => s.kind === "function")
    .map((s) => `  - ${s.name}()`)
    .join("\n");

  const classList = symbols
    .filter((s) => s.kind === "class")
    .map((s) => `  - ${s.name}`)
    .join("\n");

  const typeList = symbols
    .filter((s) => ["interface", "type", "enum"].includes(s.kind))
    .map((s) => `  - ${s.name} (${s.kind})`)
    .join("\n");

  let summary = `## File: ${filePath}\n`;
  summary += `Package: ${pkg} | Language: ${language}\n\n`;

  if (functionList) {
    summary += `### Functions\n${functionList}\n\n`;
  }
  if (classList) {
    summary += `### Classes\n${classList}\n\n`;
  }
  if (typeList) {
    summary += `### Types\n${typeList}\n\n`;
  }

  return summary;
}

// ============================================================================
// Knowledge Indexing
// ============================================================================

// Max chunk size for nomic-embed-text (conservative limit)
const MAX_CHUNK_SIZE = 1500;

/**
 * Split large chunks into smaller pieces
 */
async function splitLargeChunk(
  text: string,
  maxSize: number = MAX_CHUNK_SIZE
): Promise<string[]> {
  if (text.length <= maxSize) {
    return [text];
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: maxSize,
    chunkOverlap: 100,
  });
  return await splitter.splitText(text);
}

async function indexKnowledge(
  db: lancedb.Connection,
  embeddings: OllamaEmbeddings
): Promise<IndexedDocument[]> {
  console.log(chalk.blue("\n📚 Indexing Knowledge Files...\n"));

  const documents: IndexedDocument[] = [];

  // Internal rules - use custom markdown header splitter
  const internalFiles = await glob(
    path.join(CONFIG.knowledgeRoot, "internal/**/*.md")
  );

  for (const filePath of internalFiles) {
    const content = readFile(filePath);
    if (!content) continue;

    const relativePath = path.relative(CONFIG.knowledgeRoot, filePath);
    console.log(chalk.magenta(`  📜 [INTERNAL] ${relativePath}`));

    const headerDocs = splitMarkdownByHeaders(content, [
      ["#", "h1"],
      ["##", "h2"],
      ["###", "h3"],
    ]);
    const checksum = calculateChecksum(content);

    let chunkCount = 0;
    for (let i = 0; i < headerDocs.length; i++) {
      const doc = headerDocs[i];
      const headers = [doc.metadata.h1, doc.metadata.h2, doc.metadata.h3]
        .filter(Boolean)
        .join(" > ");

      // Split large chunks into smaller pieces
      const subChunks = await splitLargeChunk(doc.content);

      for (let j = 0; j < subChunks.length; j++) {
        const text = subChunks[j];
        const vector = await embeddings.embedQuery(text);

        documents.push({
          id: `internal_${relativePath}_${i}_${j}`,
          text,
          vector,
          source: relativePath,
          filename: path.basename(filePath),
          type: "internal_rule",
          category: headers || "General",
          checksum,
          createdAt: new Date().toISOString(),
          language: "",
          package_name: "",
          functions: "[]",
          exports: "[]",
        });
        chunkCount++;
      }
    }

    console.log(chalk.gray(`     → ${chunkCount} chunks`));
  }

  // External docs - use RecursiveCharacterTextSplitter with smaller size
  const externalFiles = await glob(
    path.join(CONFIG.knowledgeRoot, "external/**/*.md")
  );

  const recursiveSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: MAX_CHUNK_SIZE,
    chunkOverlap: 100,
  });

  for (const filePath of externalFiles) {
    const content = readFile(filePath);
    if (!content) continue;

    const relativePath = path.relative(CONFIG.knowledgeRoot, filePath);
    console.log(chalk.cyan(`  📖 [EXTERNAL] ${relativePath}`));

    const chunks = await recursiveSplitter.splitText(content);
    const checksum = calculateChecksum(content);

    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      const vector = await embeddings.embedQuery(text);

      documents.push({
        id: `external_${relativePath}_${i}`,
        text,
        vector,
        source: relativePath,
        filename: path.basename(filePath),
        type: "external_api",
        category: path.basename(filePath, ".md"),
        checksum,
        createdAt: new Date().toISOString(),
        language: "",
        package_name: "",
        functions: "[]",
        exports: "[]",
      });
    }

    console.log(chalk.gray(`     → ${chunks.length} chunks`));
  }

  return documents;
}

// ============================================================================
// Code Map Indexing
// ============================================================================

async function indexCodeMap(
  db: lancedb.Connection,
  embeddings: OllamaEmbeddings
): Promise<IndexedDocument[]> {
  console.log(chalk.blue("\n🗺️ Building Code Map...\n"));

  const documents: IndexedDocument[] = [];

  // Find all source files
  const allFiles: string[] = [];
  for (const pattern of CONFIG.sourcePatterns) {
    const files = await glob(path.join(CONFIG.projectRoot, pattern), {
      ignore: CONFIG.ignorePatterns,
    });
    allFiles.push(...files);
  }

  // Filter out ignored files
  const filteredFiles = allFiles.filter((filePath) => {
    const filename = path.basename(filePath);
    return !CONFIG.ignoreFiles.includes(filename);
  });

  console.log(chalk.gray(`   Found ${filteredFiles.length} source files (${allFiles.length - filteredFiles.length} ignored)\n`));

  for (const filePath of filteredFiles) {
    const content = readFile(filePath);
    if (!content) continue;

    const relativePath = path.relative(CONFIG.projectRoot, filePath);
    const language = getLanguage(filePath);
    const pkg = getPackageName(filePath);

    // Extract symbols
    const symbols = extractSymbols(content, language);

    if (symbols.length === 0) continue;

    console.log(
      chalk.yellow(`  📄 [${pkg.toUpperCase()}] ${relativePath}`)
    );
    console.log(
      chalk.gray(`     → ${symbols.length} symbols (${language})`)
    );

    // Generate summary for this file
    const fileInfo: CodeFileInfo = {
      path: relativePath,
      language,
      package: pkg,
      symbols,
      imports: [],
      summary: "",
    };

    fileInfo.summary = generateCodeSummary(fileInfo);

    // Create searchable text - limit symbols to avoid context length issues
    const limitedSymbols = symbols.slice(0, 50); // Max 50 symbols
    const searchableText = `
File: ${relativePath}
Package: ${pkg}
Language: ${language}

Symbols (${symbols.length} total):
${limitedSymbols.map((s) => `- ${s.kind}: ${s.name}`).join("\n")}
${symbols.length > 50 ? `... and ${symbols.length - 50} more` : ""}
`.trim();

    // Ensure searchable text is within limits
    const textChunks = await splitLargeChunk(searchableText);

    for (let i = 0; i < textChunks.length; i++) {
      const text = textChunks[i];
      const vector = await embeddings.embedQuery(text);

      const functionNames = symbols
        .filter((s) => s.kind === "function")
        .map((s) => s.name);
      const exportNames = symbols.filter((s) => s.exported).map((s) => s.name);

      documents.push({
        id: `code_${relativePath}_${i}`,
        text,
        vector,
        source: relativePath,
        filename: path.basename(filePath),
        type: "code_map",
        category: `${pkg}/${language}`,
        checksum: calculateChecksum(content),
        createdAt: new Date().toISOString(),
        language,
        package_name: pkg,
        functions: JSON.stringify(functionNames),
        exports: JSON.stringify(exportNames),
      });
    }
  }

  return documents;
}

// ============================================================================
// Claude Context Compilation
// ============================================================================

async function compileClaudeContext(): Promise<void> {
  console.log(chalk.blue("\n📝 Compiling Claude Code Context...\n"));

  const contextDir = path.join(CONFIG.knowledgeRoot, "_claude-context");
  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }

  // Read all internal knowledge files
  const internalFiles = await glob(
    path.join(CONFIG.knowledgeRoot, "internal/**/*.md")
  );

  let combinedContext = `# OpenIAP Project Context

> This file is auto-generated for use with Claude Code CLI.
> Last updated: ${new Date().toISOString()}

---

`;

  // Combine all internal rules
  combinedContext += "# INTERNAL RULES (MANDATORY)\n\n";
  combinedContext +=
    "The following rules MUST be followed without exception.\n\n";

  for (const filePath of internalFiles.sort()) {
    const content = readFile(filePath);
    if (!content) continue;

    const filename = path.basename(filePath);
    combinedContext += `---\n\n`;
    combinedContext += content;
    combinedContext += "\n\n";
  }

  // Add project structure summary
  combinedContext += "---\n\n# PROJECT STRUCTURE\n\n";
  combinedContext += "```\n";
  combinedContext += `openiap/
├── packages/
│   ├── apple/        # iOS/macOS StoreKit 2 library
│   ├── google/       # Android Google Play Billing library
│   ├── gql/          # GraphQL schema & type generation
│   └── docs/         # Documentation site
├── knowledge/        # Shared knowledge base
│   ├── internal/     # Project philosophy (this context)
│   └── external/     # External API reference
└── scripts/agent/    # RAG agent scripts
`;
  combinedContext += "```\n";

  // Write context file
  const contextPath = path.join(contextDir, "context.md");
  fs.writeFileSync(contextPath, combinedContext);

  console.log(chalk.green(`   ✓ Created: ${contextPath}`));
  console.log(
    chalk.gray(`   Usage: claude --context ${contextPath}`)
  );
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const onlyKnowledge = args.includes("--knowledge");
  const onlyCode = args.includes("--code");
  const compile = args.includes("--compile");

  console.log(chalk.bold.cyan("\n" + "═".repeat(60)));
  console.log(chalk.bold.cyan("🧠 OpenIAP Knowledge & Code Map Indexer"));
  console.log(chalk.bold.cyan("═".repeat(60)));
  console.log(chalk.gray(`\nProject Root: ${CONFIG.projectRoot}`));
  console.log(chalk.gray(`Database:     ${CONFIG.dbPath}`));

  // Ensure directories
  if (!fs.existsSync(CONFIG.dbPath)) {
    fs.mkdirSync(CONFIG.dbPath, { recursive: true });
  }

  // Connect to LanceDB
  const db = await lancedb.connect(CONFIG.dbPath);

  // Initialize embeddings
  const embeddings = new OllamaEmbeddings({
    model: CONFIG.embeddingModel,
    baseUrl: CONFIG.ollamaUrl,
  });

  const allDocuments: IndexedDocument[] = [];

  // Index knowledge
  if (!onlyCode) {
    const knowledgeDocs = await indexKnowledge(db, embeddings);
    allDocuments.push(...knowledgeDocs);
  }

  // Index code map
  if (!onlyKnowledge) {
    const codeDocs = await indexCodeMap(db, embeddings);
    allDocuments.push(...codeDocs);
  }

  // Store in LanceDB
  if (allDocuments.length > 0) {
    console.log(chalk.blue("\n💾 Storing in LanceDB..."));

    const tables = await db.tableNames();

    // Knowledge table
    const knowledgeDocs = allDocuments.filter(
      (d) => d.type !== "code_map"
    );
    if (knowledgeDocs.length > 0) {
      if (tables.includes(CONFIG.knowledgeTable)) {
        await db.dropTable(CONFIG.knowledgeTable);
      }
      await db.createTable(CONFIG.knowledgeTable, knowledgeDocs);
      console.log(
        chalk.green(`   ✓ Knowledge: ${knowledgeDocs.length} documents`)
      );
    }

    // Code map table
    const codeDocs = allDocuments.filter(
      (d) => d.type === "code_map"
    );
    if (codeDocs.length > 0) {
      if (tables.includes(CONFIG.codeMapTable)) {
        await db.dropTable(CONFIG.codeMapTable);
      }
      await db.createTable(CONFIG.codeMapTable, codeDocs);
      console.log(chalk.green(`   ✓ Code Map: ${codeDocs.length} files`));
    }
  }

  // Compile Claude context
  if (compile || (!onlyCode && !onlyKnowledge)) {
    await compileClaudeContext();
  }

  // Summary
  console.log(chalk.bold.cyan("\n" + "═".repeat(60)));
  console.log(chalk.bold.cyan("📊 Indexing Summary"));
  console.log(chalk.bold.cyan("═".repeat(60)));

  const internalCount = allDocuments.filter(
    (d) => d.type === "internal_rule"
  ).length;
  const externalCount = allDocuments.filter(
    (d) => d.type === "external_api"
  ).length;
  const codeCount = allDocuments.filter(
    (d) => d.type === "code_map"
  ).length;

  console.log(chalk.magenta(`   Internal Rules:  ${internalCount} chunks`));
  console.log(chalk.cyan(`   External APIs:   ${externalCount} chunks`));
  console.log(chalk.yellow(`   Code Map Files:  ${codeCount} files`));
  console.log(chalk.bold.white(`   Total:           ${allDocuments.length}`));

  console.log(chalk.bold.green("\n✅ Indexing complete!\n"));
  console.log(chalk.gray("Next steps:"));
  console.log(chalk.gray("  • Run benchmark: bun run benchmark --prompt \"...\""));
  console.log(
    chalk.gray("  • Claude Code:   claude --context knowledge/_claude-context/context.md")
  );
  console.log();
}

main().catch((error) => {
  console.error(chalk.red("\n❌ Indexing failed:"), error);
  process.exit(1);
});
