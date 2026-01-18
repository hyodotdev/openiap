/**
 * OpenIAP Context-Aware Knowledge Ingestion Script (v2.0)
 *
 * This script performs semantic ingestion of knowledge documents into LanceDB.
 * It uses different splitting strategies based on document type:
 *
 * - /knowledge/internal/  → MarkdownHeaderTextSplitter (precise header-based)
 *                           type: 'internal_rule' (HIGHEST PRIORITY)
 *
 * - /knowledge/external/  → RecursiveCharacterTextSplitter (chunk-based)
 *                           type: 'external_api' (reference material)
 *
 * Features:
 * - Semantic splitting with header preservation
 * - Rich metadata (source, category, type, checksum)
 * - Duplicate prevention via content checksum
 * - Incremental updates (only changed files re-processed)
 *
 * Usage:
 *   bun run ingest
 *   bun run ingest --force  # Force re-ingestion of all files
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

        const headerIndex = headersToSplitOn.findIndex(([p]) => p === headerPrefix);
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
// Configuration
// ============================================================================

const CONFIG = {
  // Paths
  projectRoot: path.resolve(process.cwd(), "../.."),
  knowledgeRoot: path.resolve(process.cwd(), "../../knowledge"),
  dbPath: path.resolve(process.cwd(), ".lancedb"),

  // LanceDB
  tableName: "openiap_knowledge",
  checksumTable: "file_checksums",

  // Ollama
  embeddingModel: process.env.EMBEDDING_MODEL || "nomic-embed-text",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",

  // Splitting
  internalChunkSize: 1500, // Larger for context preservation
  internalChunkOverlap: 200,
  externalChunkSize: 1000,
  externalChunkOverlap: 150,

  // Force re-ingestion flag
  forceReindex: process.argv.includes("--force"),
};

// Knowledge type definitions
type KnowledgeType = "internal_rule" | "external_api";

interface KnowledgeChunk {
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
  chunkIndex: number;
  totalChunks: number;
  createdAt: string;
}

interface FileChecksum {
  source: string;
  checksum: string;
  lastUpdated: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate MD5 checksum of file content
 */
function calculateChecksum(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Read file content safely
 */
function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(chalk.red(`  ✗ Failed to read: ${filePath}`));
    return null;
  }
}

/**
 * Get relative path from knowledge root
 */
function getRelativePath(filePath: string): string {
  return path.relative(CONFIG.knowledgeRoot, filePath);
}

/**
 * Determine knowledge type based on folder
 */
function getKnowledgeType(filePath: string): KnowledgeType {
  const relativePath = getRelativePath(filePath);
  if (relativePath.startsWith("internal")) {
    return "internal_rule";
  }
  return "external_api";
}

// ============================================================================
// Text Splitting Strategies
// ============================================================================

/**
 * Split internal documents using custom markdown header splitter
 * This preserves semantic structure by splitting on headers
 */
async function splitInternalDocument(
  content: string,
  filePath: string
): Promise<Array<{ text: string; category: string }>> {
  // Split by headers first using custom splitter
  const headerDocs = splitMarkdownByHeaders(content, [
    ["#", "h1"],
    ["##", "h2"],
    ["###", "h3"],
    ["####", "h4"],
  ]);

  // Further split if chunks are too large
  const recursiveSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: CONFIG.internalChunkSize,
    chunkOverlap: CONFIG.internalChunkOverlap,
    separators: ["\n\n", "\n", ". ", " "],
  });

  const results: Array<{ text: string; category: string }> = [];

  for (const doc of headerDocs) {
    // Build category from header metadata
    const headers: string[] = [];
    if (doc.metadata.h1) headers.push(doc.metadata.h1);
    if (doc.metadata.h2) headers.push(doc.metadata.h2);
    if (doc.metadata.h3) headers.push(doc.metadata.h3);
    if (doc.metadata.h4) headers.push(doc.metadata.h4);

    const category = headers.length > 0 ? headers.join(" > ") : "General";

    // Check if further splitting is needed
    if (doc.content.length > CONFIG.internalChunkSize) {
      const subChunks = await recursiveSplitter.splitText(doc.content);
      for (const subChunk of subChunks) {
        results.push({ text: subChunk, category });
      }
    } else {
      results.push({ text: doc.content, category });
    }
  }

  return results;
}

/**
 * Split external documents using RecursiveCharacterTextSplitter
 * Better for large API documentation
 */
async function splitExternalDocument(
  content: string,
  filePath: string
): Promise<Array<{ text: string; category: string }>> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CONFIG.externalChunkSize,
    chunkOverlap: CONFIG.externalChunkOverlap,
    separators: ["\n## ", "\n### ", "\n\n", "\n", ". ", " "],
  });

  // Extract filename without extension as base category
  const filename = path.basename(filePath, path.extname(filePath));
  const baseCategory = filename.replace(/-/g, " ").replace(/_/g, " ");

  const chunks = await splitter.splitText(content);

  return chunks.map((text, index) => {
    // Try to extract section header from chunk
    const headerMatch = text.match(/^#{1,4}\s+(.+?)[\n\r]/);
    const sectionHeader = headerMatch ? headerMatch[1].trim() : null;

    const category = sectionHeader
      ? `${baseCategory} > ${sectionHeader}`
      : baseCategory;

    return { text, category };
  });
}

// ============================================================================
// Embedding & Storage
// ============================================================================

/**
 * Create embeddings for text chunks
 */
async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings = new OllamaEmbeddings({
    model: CONFIG.embeddingModel,
    baseUrl: CONFIG.ollamaUrl,
  });

  const vectors: number[][] = [];
  const batchSize = 5;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchVectors = await Promise.all(
      batch.map((text) => embeddings.embedQuery(text))
    );
    vectors.push(...batchVectors);

    // Progress indicator
    const progress = Math.min(i + batchSize, texts.length);
    process.stdout.write(
      chalk.gray(`\r  Embedding: ${progress}/${texts.length}`)
    );
  }
  console.log(); // New line

  return vectors;
}

/**
 * Load existing checksums from database
 */
async function loadExistingChecksums(
  db: lancedb.Connection
): Promise<Map<string, string>> {
  const checksums = new Map<string, string>();

  const tables = await db.tableNames();
  if (!tables.includes(CONFIG.checksumTable)) {
    return checksums;
  }

  try {
    const table = await db.openTable(CONFIG.checksumTable);
    const data = await table.search([0]).limit(10000).execute();

    for (const row of data) {
      const typedRow = row as { source: string; checksum: string };
      checksums.set(typedRow.source, typedRow.checksum);
    }
  } catch {
    // Table might be empty or have different schema
  }

  return checksums;
}

/**
 * Save checksums to database
 */
async function saveChecksums(
  db: lancedb.Connection,
  checksums: FileChecksum[]
): Promise<void> {
  const tables = await db.tableNames();

  // Add a dummy vector field (LanceDB requires vectors)
  const data = checksums.map((c) => ({
    ...c,
    vector: [0], // Placeholder vector
  }));

  if (tables.includes(CONFIG.checksumTable)) {
    await db.dropTable(CONFIG.checksumTable);
  }

  if (data.length > 0) {
    await db.createTable(CONFIG.checksumTable, data);
  }
}

// ============================================================================
// Main Ingestion Process
// ============================================================================

/**
 * Find all knowledge files
 */
async function findKnowledgeFiles(): Promise<string[]> {
  const patterns = [
    path.join(CONFIG.knowledgeRoot, "internal/**/*.md"),
    path.join(CONFIG.knowledgeRoot, "external/**/*.md"),
    path.join(CONFIG.knowledgeRoot, "internal/**/*.txt"),
    path.join(CONFIG.knowledgeRoot, "external/**/*.txt"),
  ];

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { absolute: true });
    files.push(...matches);
  }

  return files.sort();
}

/**
 * Process a single file and return chunks
 */
async function processFile(
  filePath: string,
  existingChecksums: Map<string, string>
): Promise<{
  chunks: Array<{ text: string; category: string }>;
  checksum: string;
  skipped: boolean;
}> {
  const content = readFile(filePath);
  if (!content) {
    return { chunks: [], checksum: "", skipped: true };
  }

  const checksum = calculateChecksum(content);
  const relativePath = getRelativePath(filePath);

  // Check if file has changed
  if (!CONFIG.forceReindex && existingChecksums.get(relativePath) === checksum) {
    return { chunks: [], checksum, skipped: true };
  }

  const type = getKnowledgeType(filePath);

  // Use appropriate splitter based on type
  const chunks =
    type === "internal_rule"
      ? await splitInternalDocument(content, filePath)
      : await splitExternalDocument(content, filePath);

  return { chunks, checksum, skipped: false };
}

/**
 * Main ingestion function
 */
async function ingestKnowledge(): Promise<void> {
  console.log(chalk.bold.cyan("\n🚀 OpenIAP Context-Aware Knowledge Ingestion v2.0\n"));
  console.log(chalk.gray(`Knowledge Root: ${CONFIG.knowledgeRoot}`));
  console.log(chalk.gray(`Database Path:  ${CONFIG.dbPath}`));
  console.log(chalk.gray(`Force Reindex:  ${CONFIG.forceReindex ? "Yes" : "No"}`));
  console.log();

  // Ensure directories exist
  if (!fs.existsSync(CONFIG.knowledgeRoot)) {
    fs.mkdirSync(CONFIG.knowledgeRoot, { recursive: true });
    fs.mkdirSync(path.join(CONFIG.knowledgeRoot, "internal"), { recursive: true });
    fs.mkdirSync(path.join(CONFIG.knowledgeRoot, "external"), { recursive: true });
    console.log(chalk.yellow("📁 Created knowledge directory structure"));
    console.log(chalk.yellow("   Add your documents to:"));
    console.log(chalk.yellow("   - /knowledge/internal/ (project philosophy)"));
    console.log(chalk.yellow("   - /knowledge/external/ (API documentation)\n"));
    return;
  }

  // Find all knowledge files
  console.log(chalk.blue("📂 Scanning knowledge files..."));
  const files = await findKnowledgeFiles();

  if (files.length === 0) {
    console.log(chalk.yellow("\n⚠ No knowledge files found!"));
    console.log(chalk.gray("   Add .md or .txt files to:"));
    console.log(chalk.gray("   - /knowledge/internal/ (for internal rules)"));
    console.log(chalk.gray("   - /knowledge/external/ (for API docs)\n"));
    return;
  }

  console.log(chalk.green(`   Found ${files.length} files\n`));

  // Connect to LanceDB
  if (!fs.existsSync(CONFIG.dbPath)) {
    fs.mkdirSync(CONFIG.dbPath, { recursive: true });
  }
  const db = await lancedb.connect(CONFIG.dbPath);

  // Load existing checksums
  const existingChecksums = await loadExistingChecksums(db);
  console.log(chalk.gray(`   Existing checksums: ${existingChecksums.size} files\n`));

  // Process files
  const allChunks: KnowledgeChunk[] = [];
  const newChecksums: FileChecksum[] = [];
  const stats = {
    processed: 0,
    skipped: 0,
    internalChunks: 0,
    externalChunks: 0,
  };

  for (const filePath of files) {
    const relativePath = getRelativePath(filePath);
    const type = getKnowledgeType(filePath);
    const typeLabel = type === "internal_rule" ? "INTERNAL" : "EXTERNAL";
    const typeColor = type === "internal_rule" ? chalk.magenta : chalk.cyan;

    console.log(typeColor(`📄 [${typeLabel}] ${relativePath}`));

    const { chunks, checksum, skipped } = await processFile(
      filePath,
      existingChecksums
    );

    if (skipped && chunks.length === 0 && checksum) {
      console.log(chalk.gray("   ⏭ Skipped (unchanged)\n"));
      stats.skipped++;
      // Preserve existing checksum
      newChecksums.push({
        source: relativePath,
        checksum,
        lastUpdated: new Date().toISOString(),
      });
      continue;
    }

    if (chunks.length === 0) {
      console.log(chalk.yellow("   ⚠ No content extracted\n"));
      continue;
    }

    console.log(chalk.gray(`   Split into ${chunks.length} chunks`));

    // Create embeddings
    const texts = chunks.map((c) => c.text);
    const vectors = await createEmbeddings(texts);

    // Create knowledge chunks
    const filename = path.basename(filePath);
    const now = new Date().toISOString();

    for (let i = 0; i < chunks.length; i++) {
      const chunk: KnowledgeChunk = {
        id: `${relativePath}_${i}_${Date.now()}`,
        text: chunks[i].text,
        vector: vectors[i],
        source: relativePath,
        filename,
        type,
        category: chunks[i].category,
        checksum,
        chunkIndex: i,
        totalChunks: chunks.length,
        createdAt: now,
      };
      allChunks.push(chunk);

      if (type === "internal_rule") {
        stats.internalChunks++;
      } else {
        stats.externalChunks++;
      }
    }

    newChecksums.push({
      source: relativePath,
      checksum,
      lastUpdated: now,
    });

    stats.processed++;
    console.log(chalk.green(`   ✓ Processed\n`));
  }

  // Store in LanceDB
  if (allChunks.length > 0) {
    console.log(chalk.blue("💾 Storing in LanceDB..."));

    const tables = await db.tableNames();
    if (tables.includes(CONFIG.tableName)) {
      // For now, recreate the table
      // In production, you might want to merge/update
      await db.dropTable(CONFIG.tableName);
    }

    await db.createTable(CONFIG.tableName, allChunks);
    console.log(chalk.green(`   ✓ Stored ${allChunks.length} chunks\n`));
  }

  // Save checksums
  await saveChecksums(db, newChecksums);

  // Summary
  console.log(chalk.bold.cyan("\n📊 Ingestion Summary"));
  console.log(chalk.gray("─".repeat(50)));
  console.log(chalk.white(`   Files processed:     ${stats.processed}`));
  console.log(chalk.white(`   Files skipped:       ${stats.skipped}`));
  console.log(chalk.magenta(`   Internal rule chunks: ${stats.internalChunks}`));
  console.log(chalk.cyan(`   External API chunks:  ${stats.externalChunks}`));
  console.log(chalk.bold.white(`   Total chunks:         ${allChunks.length}`));
  console.log(chalk.gray("─".repeat(50)));

  console.log(chalk.bold.green("\n✅ Knowledge ingestion complete!\n"));
  console.log(chalk.gray(`Run ${chalk.cyan("bun run agent")} to start the coding agent.\n`));
}

// ============================================================================
// Entry Point
// ============================================================================

ingestKnowledge().catch((error) => {
  console.error(chalk.red("\n❌ Ingestion failed:"), error);
  process.exit(1);
});
