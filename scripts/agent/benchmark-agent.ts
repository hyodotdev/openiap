/**
 * OpenIAP Benchmark Agent (The Challenger)
 *
 * This agent is designed for COMPARISON TESTING against Claude Code.
 * It generates code following OpenIAP's internal philosophy and outputs
 * to `_generated/` folder for easy comparison.
 *
 * Process:
 * 1. Accept a prompt (same as would be given to Claude Code)
 * 2. RAG Search:
 *    - Internal Rules (HIGHEST PRIORITY → System Prompt top)
 *    - Code Map (find relevant existing files)
 *    - External APIs (reference material)
 * 3. Read existing code files for style reference
 * 4. Generate code → `_generated/` folder
 * 5. Show diff preview
 *
 * Usage:
 *   bun run benchmark --prompt "Add iOS subscription validation"
 *   bun run benchmark                      # Interactive mode
 *   bun run benchmark --diff               # Show diff with existing files
 *
 * Output:
 *   _generated/
 *   ├── {timestamp}/
 *   │   ├── prompt.txt               # Original prompt
 *   │   ├── context.md               # Retrieved context
 *   │   ├── files/                   # Generated files
 *   │   │   └── packages/apple/...
 *   │   └── diff.patch               # Diff against existing
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import * as lancedb from "vectordb";
import { OllamaEmbeddings } from "@langchain/ollama";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import inquirer from "inquirer";
import { execSync, execFileSync } from "child_process";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  projectRoot: path.resolve(process.cwd(), "../.."),
  outputRoot: path.resolve(process.cwd(), "../../_generated"),
  dbPath: path.resolve(process.cwd(), ".lancedb"),

  // Tables
  knowledgeTable: "openiap_knowledge",
  codeMapTable: "openiap_codemap",

  // Ollama
  embeddingModel: process.env.EMBEDDING_MODEL || "nomic-embed-text",
  llmModel: process.env.LLM_MODEL || "qwen2.5-coder:14b",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",

  // Retrieval limits
  maxInternalRules: 10,
  maxCodeMapFiles: 5,
  maxExternalDocs: 5,
  maxCodeReadLines: 200,
};

// ============================================================================
// Types
// ============================================================================

interface RetrievedDocument {
  text: string;
  // Flat structure matching IndexedDocument
  source: string;
  type: string;
  category: string;
  functions: string;  // JSON string
  language: string;
  package_name: string;
  _distance?: number;
}

interface RetrievedContext {
  internalRules: RetrievedDocument[];
  codeMap: RetrievedDocument[];
  externalDocs: RetrievedDocument[];
  codeSnippets: Map<string, string>;
}

interface GeneratedFile {
  path: string;
  content: string;
  action: "create" | "modify";
}

interface BenchmarkResult {
  prompt: string;
  timestamp: string;
  context: RetrievedContext;
  generatedFiles: GeneratedFile[];
  explanation: string;
}

// ============================================================================
// System Prompt Template
// ============================================================================

const SYSTEM_PROMPT_TEMPLATE = `You are the OpenIAP project maintainer. You MUST follow the internal rules EXACTLY.

╔══════════════════════════════════════════════════════════════════════════════╗
║  🚨 INTERNAL RULES (MANDATORY - HIGHEST PRIORITY)                           ║
║  These rules are NON-NEGOTIABLE. Follow them EXACTLY.                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

{internal_rules}

╔══════════════════════════════════════════════════════════════════════════════╗
║  📍 RELEVANT CODE LOCATIONS (From Code Map)                                  ║
║  These are existing files related to your task.                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

{code_map}

╔══════════════════════════════════════════════════════════════════════════════╗
║  📖 EXISTING CODE REFERENCE (Style Guide)                                    ║
║  Follow the EXACT style shown in these existing files.                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

{code_snippets}

╔══════════════════════════════════════════════════════════════════════════════╗
║  📚 EXTERNAL API REFERENCE                                                   ║
║  Use these for API details, but ADAPT to match internal rules.               ║
╚══════════════════════════════════════════════════════════════════════════════╝

{external_docs}

╔══════════════════════════════════════════════════════════════════════════════╗
║  📝 OUTPUT FORMAT                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

Return a JSON object with this structure:
{
  "explanation": "What you're implementing and why, referencing internal rules",
  "files": [
    {
      "path": "packages/apple/Sources/NewFile.swift",
      "action": "create",
      "content": "// Full file content here"
    }
  ]
}

CRITICAL CHECKLIST before generating:
- [ ] iOS functions end with IOS suffix
- [ ] Android functions in packages/google have NO Android suffix
- [ ] Explicit return types on all functions
- [ ] Match the exact style of existing code snippets
- [ ] Follow the architectural patterns shown

Output ONLY valid JSON.`;

// ============================================================================
// Context Retrieval
// ============================================================================

async function retrieveContext(
  query: string,
  db: lancedb.Connection,
  embeddings: OllamaEmbeddings
): Promise<RetrievedContext> {
  console.log(chalk.blue("\n🔍 Retrieving Context...\n"));

  const queryVector = await embeddings.embedQuery(query);

  const context: RetrievedContext = {
    internalRules: [],
    codeMap: [],
    externalDocs: [],
    codeSnippets: new Map(),
  };

  // 1. Search Knowledge Table (internal rules + external docs)
  try {
    const knowledgeTable = await db.openTable(CONFIG.knowledgeTable);
    const knowledgeResults = (await knowledgeTable
      .search(queryVector)
      .limit(CONFIG.maxInternalRules + CONFIG.maxExternalDocs)
      .execute()) as RetrievedDocument[];

    for (const doc of knowledgeResults) {
      if (doc.type === "internal_rule") {
        if (context.internalRules.length < CONFIG.maxInternalRules) {
          context.internalRules.push(doc);
        }
      } else if (doc.type === "external_api") {
        if (context.externalDocs.length < CONFIG.maxExternalDocs) {
          context.externalDocs.push(doc);
        }
      }
    }

    console.log(chalk.magenta(`   📜 Internal Rules: ${context.internalRules.length}`));
    for (const doc of context.internalRules.slice(0, 3)) {
      console.log(chalk.gray(`      - ${doc.category}`));
    }

    console.log(chalk.cyan(`   📚 External Docs: ${context.externalDocs.length}`));
  } catch (error) {
    console.log(chalk.yellow("   ⚠ Knowledge table not found. Run 'bun run index' first."));
  }

  // 2. Search Code Map Table
  try {
    const codeMapTable = await db.openTable(CONFIG.codeMapTable);
    const codeResults = (await codeMapTable
      .search(queryVector)
      .limit(CONFIG.maxCodeMapFiles)
      .execute()) as RetrievedDocument[];

    context.codeMap = codeResults;

    console.log(chalk.yellow(`   🗺️ Code Map Files: ${context.codeMap.length}`));
    for (const doc of context.codeMap) {
      console.log(chalk.gray(`      - ${doc.source}`));
    }
  } catch (error) {
    console.log(chalk.yellow("   ⚠ Code map table not found."));
  }

  // 3. Read actual code files for style reference
  console.log(chalk.blue("\n📖 Reading Reference Code...\n"));

  for (const codeFile of context.codeMap) {
    const filePath = path.join(CONFIG.projectRoot, codeFile.source);

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const preview = lines.slice(0, CONFIG.maxCodeReadLines).join("\n");

      context.codeSnippets.set(codeFile.source, preview);
      console.log(chalk.gray(`   ✓ Read: ${codeFile.source} (${lines.length} lines)`));
    } catch {
      console.log(chalk.gray(`   ⚠ Could not read: ${codeFile.source}`));
    }
  }

  return context;
}

// ============================================================================
// Code Generation
// ============================================================================

function formatContextForPrompt(context: RetrievedContext): {
  internalRulesText: string;
  codeMapText: string;
  codeSnippetsText: string;
  externalDocsText: string;
} {
  // Format internal rules (HIGHEST PRIORITY)
  const internalRulesText = context.internalRules
    .map((doc, i) => {
      return `[Rule ${i + 1}: ${doc.category}]\n${doc.text}`;
    })
    .join("\n\n" + "─".repeat(40) + "\n\n");

  // Safe JSON parse helper
  const safeParseArray = (json: string | undefined): string[] => {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // Format code map
  const codeMapText = context.codeMap
    .map((doc) => {
      const funcs = safeParseArray(doc.functions);
      const funcsText = funcs.length > 0 ? funcs.join(", ") : "N/A";
      return `📄 ${doc.source}
   Package: ${doc.package_name}
   Language: ${doc.language}
   Functions: ${funcsText}`;
    })
    .join("\n\n");

  // Format code snippets
  const codeSnippetsText = Array.from(context.codeSnippets.entries())
    .map(([filePath, content]) => {
      return `───── ${filePath} ─────\n\`\`\`\n${content}\n\`\`\``;
    })
    .join("\n\n");

  // Format external docs
  const externalDocsText = context.externalDocs
    .map((doc, i) => {
      return `[Reference ${i + 1}: ${doc.category}]\n${doc.text}`;
    })
    .join("\n\n" + "─".repeat(40) + "\n\n");

  return {
    internalRulesText: internalRulesText || "No internal rules found.",
    codeMapText: codeMapText || "No relevant code files found.",
    codeSnippetsText: codeSnippetsText || "No code snippets available.",
    externalDocsText: externalDocsText || "No external documentation found.",
  };
}

async function generateCode(
  prompt: string,
  context: RetrievedContext
): Promise<{ files: GeneratedFile[]; explanation: string }> {
  console.log(chalk.blue("\n🤖 Generating Code...\n"));
  console.log(chalk.gray(`   Model: ${CONFIG.llmModel}`));

  const llm = new ChatOllama({
    model: CONFIG.llmModel,
    baseUrl: CONFIG.ollamaUrl,
    temperature: 0.1,
    format: "json",
  });

  const { internalRulesText, codeMapText, codeSnippetsText, externalDocsText } =
    formatContextForPrompt(context);

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace("{internal_rules}", internalRulesText)
    .replace("{code_map}", codeMapText)
    .replace("{code_snippets}", codeSnippetsText)
    .replace("{external_docs}", externalDocsText);

  console.log(chalk.gray(`   System prompt: ${systemPrompt.length} chars`));

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Task: ${prompt}

Remember:
1. Follow ALL internal rules exactly
2. Match the style of existing code snippets
3. Use the code map to find the right location for new code
4. Output ONLY valid JSON`),
  ];

  const response = await llm.invoke(messages);
  const content = response.content as string;

  // Parse response
  try {
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) jsonStr = objectMatch[0];

    const parsed = JSON.parse(jsonStr);
    console.log(chalk.green("   ✓ Code generation complete"));

    return {
      files: parsed.files || [],
      explanation: parsed.explanation || "No explanation provided.",
    };
  } catch (error) {
    console.error(chalk.red("   ✗ Failed to parse response"));
    console.error(chalk.gray(`   ${content.slice(0, 500)}...`));
    throw error;
  }
}

// ============================================================================
// Output Generation
// ============================================================================

/**
 * Validate that a path stays within a root directory (prevent path traversal)
 */
function isPathSafe(filePath: string, rootDir: string): boolean {
  const normalizedPath = path.normalize(filePath);
  const fullPath = path.resolve(rootDir, normalizedPath);
  const relativePath = path.relative(rootDir, fullPath);
  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function saveResults(result: BenchmarkResult): string {
  // Create timestamped output directory
  const outputDir = path.join(CONFIG.outputRoot, result.timestamp);
  fs.mkdirSync(outputDir, { recursive: true });

  // Save prompt
  fs.writeFileSync(path.join(outputDir, "prompt.txt"), result.prompt);

  // Save context summary
  const contextSummary = `# Retrieved Context

## Internal Rules (${result.context.internalRules.length})
${result.context.internalRules.map((d) => `- ${d.category}`).join("\n")}

## Code Map (${result.context.codeMap.length})
${result.context.codeMap.map((d) => `- ${d.source}`).join("\n")}

## External Docs (${result.context.externalDocs.length})
${result.context.externalDocs.map((d) => `- ${d.category}`).join("\n")}

## Explanation
${result.explanation}
`;
  fs.writeFileSync(path.join(outputDir, "context.md"), contextSummary);

  // Save generated files
  const filesDir = path.join(outputDir, "files");
  for (const file of result.generatedFiles) {
    // Validate path to prevent path traversal
    if (!isPathSafe(file.path, filesDir)) {
      console.log(chalk.red(`   ⚠ Skipped (unsafe path): ${file.path}`));
      continue;
    }
    const filePath = path.join(filesDir, file.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.content);
  }

  // Generate diff if files exist in project
  let diffContent = "";
  for (const file of result.generatedFiles) {
    // Validate paths to prevent path traversal
    if (!isPathSafe(file.path, CONFIG.projectRoot) || !isPathSafe(file.path, filesDir)) {
      continue;
    }
    const existingPath = path.join(CONFIG.projectRoot, file.path);
    const generatedPath = path.join(filesDir, file.path);

    if (fs.existsSync(existingPath)) {
      try {
        // Use execFileSync instead of execSync to avoid shell injection
        const diff = execFileSync("diff", ["-u", existingPath, generatedPath], {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        diffContent += `\n=== ${file.path} ===\n${diff}`;
      } catch (error: unknown) {
        // diff returns exit code 1 when files differ (normal case)
        if (error && typeof error === "object" && "stdout" in error) {
          const stdout = (error as { stdout?: string }).stdout;
          if (stdout) {
            diffContent += `\n=== ${file.path} ===\n${stdout}`;
          }
        }
      }
    } else {
      diffContent += `\n=== ${file.path} (NEW FILE) ===\n`;
      diffContent += `+ ${file.content.split("\n").join("\n+ ")}`;
    }
  }

  if (diffContent) {
    fs.writeFileSync(path.join(outputDir, "diff.patch"), diffContent);
  }

  return outputDir;
}

// ============================================================================
// Preview & Display
// ============================================================================

function displayResults(result: BenchmarkResult, outputDir: string): void {
  console.log(chalk.bold.cyan("\n" + "═".repeat(60)));
  console.log(chalk.bold.cyan("📊 BENCHMARK RESULTS"));
  console.log(chalk.bold.cyan("═".repeat(60)));

  console.log(chalk.white("\n📝 Explanation:"));
  console.log(chalk.gray(`   ${result.explanation}`));

  console.log(chalk.white("\n📁 Generated Files:"));
  for (const file of result.generatedFiles) {
    const icon = file.action === "create" ? "+" : "~";
    const color = file.action === "create" ? chalk.green : chalk.yellow;
    console.log(color(`   ${icon} ${file.path}`));
  }

  console.log(chalk.white("\n📂 Output Directory:"));
  console.log(chalk.gray(`   ${outputDir}`));

  console.log(chalk.white("\n📋 Files Created:"));
  console.log(chalk.gray(`   • prompt.txt      - Original prompt`));
  console.log(chalk.gray(`   • context.md      - Retrieved context summary`));
  console.log(chalk.gray(`   • files/          - Generated source files`));
  console.log(chalk.gray(`   • diff.patch      - Diff against existing files`));

  console.log(chalk.cyan("\n" + "═".repeat(60)));
}

async function previewGeneratedFile(result: BenchmarkResult): Promise<void> {
  if (result.generatedFiles.length === 0) return;

  const { showPreview } = await inquirer.prompt([
    {
      type: "confirm",
      name: "showPreview",
      message: "Preview generated file contents?",
      default: false,
    },
  ]);

  if (!showPreview) return;

  for (const file of result.generatedFiles) {
    console.log(chalk.cyan(`\n─── ${file.path} ───`));
    const lines = file.content.split("\n");
    console.log(chalk.gray(lines.slice(0, 50).join("\n")));
    if (lines.length > 50) {
      console.log(chalk.yellow(`\n... (${lines.length - 50} more lines)`));
    }
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  console.log(chalk.bold.cyan("\n" + "═".repeat(60)));
  console.log(chalk.bold.cyan("🧪 OpenIAP Benchmark Agent (The Challenger)"));
  console.log(chalk.bold.cyan("═".repeat(60)));
  console.log(chalk.gray("\nThis agent generates code for comparison with Claude Code."));
  console.log(chalk.gray(`LLM Model: ${CONFIG.llmModel}`));

  // Get prompt
  let prompt: string;
  const promptArg = process.argv.find((arg) => arg.startsWith("--prompt="));
  if (promptArg) {
    prompt = promptArg.split("=").slice(1).join("=");
  } else {
    const answers = await inquirer.prompt<{ prompt: string }>([
      {
        type: "input",
        name: "prompt",
        message: "Enter your coding task (same as you would give Claude Code):",
        validate: (input: string) =>
          input.trim().length > 0 || "Please enter a prompt",
      },
    ]);
    prompt = answers.prompt;
  }

  console.log(chalk.cyan(`\n📋 Task: ${prompt}`));

  // Connect to database
  const db = await lancedb.connect(CONFIG.dbPath);
  const embeddings = new OllamaEmbeddings({
    model: CONFIG.embeddingModel,
    baseUrl: CONFIG.ollamaUrl,
  });

  // Retrieve context
  const context = await retrieveContext(prompt, db, embeddings);

  // Check for internal rules
  if (context.internalRules.length === 0) {
    console.log(chalk.yellow("\n⚠ Warning: No internal rules found!"));
    console.log(chalk.gray("   The agent may not follow OpenIAP conventions."));
    console.log(chalk.gray("   Run 'bun run index' to index knowledge files."));
  }

  // Generate code
  const { files, explanation } = await generateCode(prompt, context);

  // Create result
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const result: BenchmarkResult = {
    prompt,
    timestamp,
    context,
    generatedFiles: files,
    explanation,
  };

  // Save results
  const outputDir = saveResults(result);

  // Display results
  displayResults(result, outputDir);

  // Preview
  await previewGeneratedFile(result);

  // Comparison hint
  console.log(chalk.bold.green("\n✅ Benchmark complete!\n"));
  console.log(chalk.white("📊 Comparison Steps:"));
  console.log(chalk.gray("   1. Give the SAME prompt to Claude Code"));
  console.log(chalk.gray("   2. Compare Claude's output with: " + outputDir));
  console.log(chalk.gray("   3. Check: Does the local agent follow internal rules?"));
  console.log(chalk.gray("   4. Note any differences for knowledge improvement\n"));
}

main().catch((error) => {
  console.error(chalk.red("\n❌ Benchmark failed:"), error);
  process.exit(1);
});
