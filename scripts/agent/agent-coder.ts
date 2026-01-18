/**
 * OpenIAP Context-Aware RAG Coding Agent (v2.0)
 *
 * This agent uses priority-based RAG to generate code that follows
 * the OpenIAP project's strict internal philosophy while leveraging
 * external API documentation as reference material.
 *
 * Key Features:
 * - Internal rules (type: 'internal_rule') are placed at the TOP of the prompt
 *   and treated as "laws that MUST be followed"
 * - External API docs (type: 'external_api') are placed in a reference section
 * - The LLM is instructed to adapt external patterns to match internal philosophy
 *
 * Process:
 * 1. Accept natural language feature request
 * 2. Search LanceDB for relevant documents
 * 3. Separate and prioritize: internal_rule > external_api
 * 4. Build structured system prompt with clear hierarchy
 * 5. Generate code that follows internal philosophy
 * 6. Create git branch, commit, and optionally PR
 *
 * Usage:
 *   bun run agent
 *   bun run agent --request "Add a new validation function"
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import * as lancedb from "vectordb";
import { OllamaEmbeddings } from "@langchain/ollama";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import inquirer from "inquirer";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Paths
  projectRoot: path.resolve(process.cwd(), "../.."),
  dbPath: path.resolve(process.cwd(), ".lancedb"),
  tableName: "openiap_knowledge",

  // Ollama
  embeddingModel: process.env.EMBEDDING_MODEL || "nomic-embed-text",
  llmModel: process.env.LLM_MODEL || "qwen2.5-coder:14b",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",

  // Retrieval
  topK: 15, // Total documents to retrieve
  maxInternalDocs: 8, // Max internal rules to include
  maxExternalDocs: 7, // Max external API docs to include

  // Git
  createPR: process.env.CREATE_PR === "true",
};

// ============================================================================
// System Prompt Template
// ============================================================================

/**
 * The system prompt is structured to enforce internal philosophy as law
 * while treating external API docs as adaptable reference material.
 */
const SYSTEM_PROMPT_TEMPLATE = `You are the primary maintainer of the OpenIAP project.

═══════════════════════════════════════════════════════════════════════════════
🚨 MANDATORY INTERNAL RULES (MUST FOLLOW - NO EXCEPTIONS)
═══════════════════════════════════════════════════════════════════════════════

The following rules define OpenIAP's development philosophy. You MUST follow
these rules exactly. These rules take ABSOLUTE PRIORITY over any general
coding practices or external API patterns you may know.

{internal_rules}

═══════════════════════════════════════════════════════════════════════════════
📚 EXTERNAL API REFERENCE (Adapt to Match Internal Rules)
═══════════════════════════════════════════════════════════════════════════════

The following is external API documentation for reference. Use this information
to understand API capabilities, BUT you MUST adapt any code patterns to match
the Internal Rules above. If an external pattern conflicts with Internal Rules,
the Internal Rules ALWAYS win.

{external_docs}

═══════════════════════════════════════════════════════════════════════════════
📝 CODE GENERATION INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════

When generating code:
1. FIRST check if Internal Rules specify how to handle this case
2. THEN reference External API docs for API usage details
3. ALWAYS transform external patterns to match internal conventions
4. If Internal Rules are silent on a topic, use your best judgment while
   maintaining consistency with the project's overall philosophy

CRITICAL REMINDERS:
- In packages/google (Android): DO NOT add "Android" suffix to functions
- In packages/apple (iOS): Always add "IOS" suffix to iOS-specific functions
- Cross-platform functions have NO platform suffix
- Follow the exact naming patterns shown in Internal Rules

═══════════════════════════════════════════════════════════════════════════════

Output your response as a JSON object with this structure:
{
  "explanation": "Brief explanation of what you're implementing and why",
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "action": "create" | "modify" | "delete",
      "content": "full file content"
    }
  ],
  "commitMessage": "feat: conventional commit message"
}

IMPORTANT: Output ONLY valid JSON. No markdown code blocks, no additional text.`;

// ============================================================================
// Types
// ============================================================================

interface KnowledgeDocument {
  id: string;
  text: string;
  vector: number[];
  // Flat structure matching IndexedDocument
  source: string;
  filename: string;
  type: "internal_rule" | "external_api";
  category: string;
  checksum: string;
  createdAt: string;
  language: string;
  package_name: string;
  functions: string;
  exports: string;
  _distance?: number;
}

interface FileChange {
  path: string;
  action: "create" | "modify" | "delete";
  content: string;
}

interface AgentResponse {
  explanation: string;
  files: FileChange[];
  commitMessage: string;
}

interface RetrievedKnowledge {
  internalRules: KnowledgeDocument[];
  externalDocs: KnowledgeDocument[];
}

// ============================================================================
// RAG Retrieval with Priority Separation
// ============================================================================

/**
 * Search LanceDB and separate results by type
 * Internal rules are prioritized over external docs
 */
async function retrieveKnowledge(
  query: string,
  db: lancedb.Connection
): Promise<RetrievedKnowledge> {
  console.log(chalk.blue("\n🔍 Searching knowledge base..."));

  const embeddings = new OllamaEmbeddings({
    model: CONFIG.embeddingModel,
    baseUrl: CONFIG.ollamaUrl,
  });

  const queryVector = await embeddings.embedQuery(query);

  const table = await db.openTable(CONFIG.tableName);
  const results = (await table
    .search(queryVector)
    .limit(CONFIG.topK * 2) // Get more to ensure we have enough of each type
    .execute()) as KnowledgeDocument[];

  // Separate by type
  const internalRules: KnowledgeDocument[] = [];
  const externalDocs: KnowledgeDocument[] = [];

  for (const doc of results) {
    if (doc.type === "internal_rule") {
      if (internalRules.length < CONFIG.maxInternalDocs) {
        internalRules.push(doc);
      }
    } else if (doc.type === "external_api") {
      if (externalDocs.length < CONFIG.maxExternalDocs) {
        externalDocs.push(doc);
      }
    }

    // Stop if we have enough of both
    if (
      internalRules.length >= CONFIG.maxInternalDocs &&
      externalDocs.length >= CONFIG.maxExternalDocs
    ) {
      break;
    }
  }

  // Log retrieval stats
  console.log(chalk.magenta(`   📜 Internal Rules: ${internalRules.length} chunks`));
  for (const doc of internalRules.slice(0, 3)) {
    console.log(chalk.gray(`      - ${doc.category}`));
  }
  if (internalRules.length > 3) {
    console.log(chalk.gray(`      ... and ${internalRules.length - 3} more`));
  }

  console.log(chalk.cyan(`   📚 External Docs:  ${externalDocs.length} chunks`));
  for (const doc of externalDocs.slice(0, 3)) {
    console.log(chalk.gray(`      - ${doc.category}`));
  }
  if (externalDocs.length > 3) {
    console.log(chalk.gray(`      ... and ${externalDocs.length - 3} more`));
  }

  return { internalRules, externalDocs };
}

/**
 * Format knowledge documents into prompt sections
 */
function formatKnowledgeForPrompt(knowledge: RetrievedKnowledge): {
  internalRulesText: string;
  externalDocsText: string;
} {
  // Format internal rules with clear section headers
  const internalRulesText = knowledge.internalRules
    .map((doc, index) => {
      const header = `[Rule ${index + 1}: ${doc.category}]`;
      const source = `Source: ${doc.source}`;
      return `${header}\n${source}\n\n${doc.text}`;
    })
    .join("\n\n" + "─".repeat(40) + "\n\n");

  // Format external docs
  const externalDocsText = knowledge.externalDocs
    .map((doc, index) => {
      const header = `[Reference ${index + 1}: ${doc.category}]`;
      const source = `Source: ${doc.source}`;
      return `${header}\n${source}\n\n${doc.text}`;
    })
    .join("\n\n" + "─".repeat(40) + "\n\n");

  return {
    internalRulesText: internalRulesText || "No specific internal rules found for this query.",
    externalDocsText: externalDocsText || "No external API documentation found for this query.",
  };
}

// ============================================================================
// Code Generation
// ============================================================================

/**
 * Generate code using Ollama with structured RAG context
 */
async function generateCode(
  request: string,
  knowledge: RetrievedKnowledge
): Promise<AgentResponse> {
  console.log(chalk.blue("\n🤖 Generating code..."));
  console.log(chalk.gray(`   Model: ${CONFIG.llmModel}`));

  const llm = new ChatOllama({
    model: CONFIG.llmModel,
    baseUrl: CONFIG.ollamaUrl,
    temperature: 0.1,
    format: "json",
  });

  const { internalRulesText, externalDocsText } = formatKnowledgeForPrompt(knowledge);

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace("{internal_rules}", internalRulesText)
    .replace("{external_docs}", externalDocsText);

  // Log prompt size for debugging
  console.log(chalk.gray(`   System prompt: ${systemPrompt.length} chars`));

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Feature Request: ${request}

Please implement this feature following the Internal Rules strictly.
Adapt any external API patterns to match our internal conventions.

Output ONLY valid JSON.`),
  ];

  const response = await llm.invoke(messages);
  const content = response.content as string;

  // Parse JSON response
  try {
    let jsonStr = content;

    // Try to extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object in the response
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    const parsed = JSON.parse(jsonStr) as AgentResponse;
    console.log(chalk.green("   ✓ Code generation complete"));
    return parsed;
  } catch (error) {
    console.error(chalk.red("   ✗ Failed to parse LLM response"));
    console.error(chalk.gray(`   Raw response (first 500 chars):`));
    console.error(chalk.gray(`   ${content.slice(0, 500)}...`));
    throw new Error(`Failed to parse LLM response: ${error}`);
  }
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Validate that a path stays within the project root (prevent path traversal)
 */
function isPathSafe(filePath: string): boolean {
  const fullPath = path.resolve(CONFIG.projectRoot, filePath);
  const relativePath = path.relative(CONFIG.projectRoot, fullPath);
  // Path is unsafe if it escapes the project root (starts with .. or is absolute)
  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

/**
 * Write generated files to the filesystem
 */
function writeFiles(files: FileChange[]): string[] {
  console.log(chalk.blue("\n📝 Writing files..."));

  const writtenFiles: string[] = [];

  for (const file of files) {
    // Validate path to prevent path traversal attacks
    if (!isPathSafe(file.path)) {
      console.log(chalk.red(`   ⚠ Skipped (unsafe path): ${file.path}`));
      continue;
    }

    const fullPath = path.resolve(CONFIG.projectRoot, file.path);
    const dirPath = path.dirname(fullPath);

    if (file.action === "delete") {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(chalk.red(`   ✗ Deleted: ${file.path}`));
        writtenFiles.push(file.path);
      }
      continue;
    }

    // Create directory if needed
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write file
    fs.writeFileSync(fullPath, file.content, "utf-8");

    const icon = file.action === "create" ? "+" : "~";
    const actionLabel = file.action === "create" ? "Created" : "Modified";
    const color = file.action === "create" ? chalk.green : chalk.yellow;

    console.log(color(`   ${icon} ${actionLabel}: ${file.path}`));
    writtenFiles.push(file.path);
  }

  return writtenFiles;
}

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Create a new branch, stage changes, and commit
 */
function gitCommit(commitMessage: string, files: string[]): string {
  console.log(chalk.blue("\n🔀 Git operations..."));

  const timestamp = Date.now();
  const branchName = `feature/ai-${timestamp}`;

  try {
    // Create and checkout new branch
    execSync(`git checkout -b ${branchName}`, {
      cwd: CONFIG.projectRoot,
      stdio: "pipe",
    });
    console.log(chalk.green(`   ✓ Created branch: ${branchName}`));

    // Stage specific files
    for (const file of files) {
      execSync(`git add "${file}"`, {
        cwd: CONFIG.projectRoot,
        stdio: "pipe",
      });
    }
    console.log(chalk.green(`   ✓ Staged ${files.length} file(s)`));

    // Commit
    const fullMessage = `${commitMessage}\n\nCo-Authored-By: OpenIAP RAG Agent <agent@openiap.dev>`;
    execSync(
      `git commit -m "${fullMessage.replace(/"/g, '\\"')}"`,
      {
        cwd: CONFIG.projectRoot,
        stdio: "pipe",
      }
    );
    console.log(chalk.green(`   ✓ Committed: ${commitMessage}`));

    return branchName;
  } catch (error) {
    console.error(chalk.red("   ✗ Git operation failed"));
    throw error;
  }
}

/**
 * Create a GitHub Pull Request using gh CLI
 */
function createPullRequest(
  branchName: string,
  commitMessage: string,
  explanation: string
): string | null {
  console.log(chalk.blue("\n🔗 Creating Pull Request..."));

  try {
    // Push branch
    execSync(`git push -u origin ${branchName}`, {
      cwd: CONFIG.projectRoot,
      stdio: "pipe",
    });
    console.log(chalk.green(`   ✓ Pushed: ${branchName}`));

    // Create PR
    const prBody = `## Summary

${explanation}

## Generated By

OpenIAP Context-Aware RAG Agent v2.0

---

🤖 This PR was automatically generated. Please review carefully before merging.`;

    const escapedBody = prBody.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    const escapedTitle = commitMessage.replace(/"/g, '\\"');

    const result = execSync(
      `gh pr create --title "${escapedTitle}" --body "${escapedBody}"`,
      {
        cwd: CONFIG.projectRoot,
        encoding: "utf-8",
      }
    );

    const prUrl = result.trim();
    console.log(chalk.green(`   ✓ PR created: ${prUrl}`));
    return prUrl;
  } catch (error) {
    console.error(chalk.yellow("   ⚠ PR creation failed (gh CLI may not be configured)"));
    return null;
  }
}

// ============================================================================
// Preview & Confirmation
// ============================================================================

/**
 * Display a preview of the changes
 */
function previewChanges(response: AgentResponse): void {
  console.log(chalk.bold.cyan("\n" + "═".repeat(60)));
  console.log(chalk.bold.cyan("📋 PREVIEW OF CHANGES"));
  console.log(chalk.bold.cyan("═".repeat(60)));

  console.log(chalk.white("\n📝 Explanation:"));
  console.log(chalk.gray(`   ${response.explanation}`));

  console.log(chalk.white("\n📁 Files:"));
  for (const file of response.files) {
    const icon =
      file.action === "create" ? "+" : file.action === "modify" ? "~" : "-";
    const color =
      file.action === "create"
        ? chalk.green
        : file.action === "modify"
          ? chalk.yellow
          : chalk.red;
    console.log(color(`   ${icon} [${file.action.toUpperCase()}] ${file.path}`));
  }

  console.log(chalk.white("\n💬 Commit Message:"));
  console.log(chalk.gray(`   ${response.commitMessage}`));

  console.log(chalk.cyan("\n" + "═".repeat(60)));
}

/**
 * Show file content preview
 */
async function previewFileContent(response: AgentResponse): Promise<void> {
  const { showContent } = await inquirer.prompt([
    {
      type: "confirm",
      name: "showContent",
      message: "Would you like to preview the file contents?",
      default: false,
    },
  ]);

  if (!showContent) return;

  for (const file of response.files) {
    if (file.action === "delete") continue;

    console.log(chalk.cyan(`\n─── ${file.path} ───`));
    const lines = file.content.split("\n");
    const preview = lines.slice(0, 50).join("\n");
    console.log(chalk.gray(preview));
    if (lines.length > 50) {
      console.log(chalk.yellow(`\n... (${lines.length - 50} more lines)`));
    }
    console.log(chalk.cyan("─".repeat(40)));
  }
}

// ============================================================================
// Main Agent Flow
// ============================================================================

async function runAgent(): Promise<void> {
  console.log(chalk.bold.cyan("\n" + "═".repeat(60)));
  console.log(chalk.bold.cyan("🤖 OpenIAP Context-Aware RAG Coding Agent v2.0"));
  console.log(chalk.bold.cyan("═".repeat(60)));

  console.log(chalk.gray("\nThis agent generates code following OpenIAP's internal"));
  console.log(chalk.gray("philosophy while referencing external API documentation."));
  console.log(chalk.gray(`\nLLM Model: ${CONFIG.llmModel}`));
  console.log(chalk.gray(`Embedding Model: ${CONFIG.embeddingModel}`));

  // Check knowledge base
  const dbExists = fs.existsSync(
    path.join(CONFIG.dbPath, `${CONFIG.tableName}.lance`)
  );
  if (!dbExists) {
    console.error(chalk.red("\n❌ Knowledge base not found!"));
    console.error(chalk.yellow("   Run 'bun run ingest' first to build the knowledge base."));
    process.exit(1);
  }

  // Get request
  let request: string;
  const requestArg = process.argv.find((arg) => arg.startsWith("--request="));
  if (requestArg) {
    request = requestArg.split("=").slice(1).join("=");
  } else {
    const answers = await inquirer.prompt<{ request: string }>([
      {
        type: "input",
        name: "request",
        message: "Enter your feature request:",
        validate: (input: string) =>
          input.trim().length > 0 || "Please enter a request",
      },
    ]);
    request = answers.request;
  }

  console.log(chalk.cyan(`\n📋 Request: ${request}`));

  // Connect to database
  const db = await lancedb.connect(CONFIG.dbPath);

  // Retrieve knowledge (with priority separation)
  const knowledge = await retrieveKnowledge(request, db);

  // Check if we have any internal rules
  if (knowledge.internalRules.length === 0) {
    console.log(chalk.yellow("\n⚠ Warning: No internal rules found for this query."));
    console.log(chalk.gray("   The agent will generate code based on external docs only."));
    console.log(chalk.gray("   Consider adding more documents to /knowledge/internal/"));
  }

  // Generate code
  const response = await generateCode(request, knowledge);

  // Preview
  previewChanges(response);
  await previewFileContent(response);

  // Confirm
  const { proceed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "proceed",
      message: "Apply these changes?",
      default: false,
    },
  ]);

  if (!proceed) {
    console.log(chalk.yellow("\n⚠ Changes cancelled."));
    return;
  }

  // Write files
  const writtenFiles = writeFiles(response.files);

  // Git operations
  const { doGit } = await inquirer.prompt([
    {
      type: "confirm",
      name: "doGit",
      message: "Create a new branch and commit?",
      default: true,
    },
  ]);

  if (doGit) {
    const branchName = gitCommit(response.commitMessage, writtenFiles);

    // PR creation
    if (CONFIG.createPR) {
      const { doPR } = await inquirer.prompt([
        {
          type: "confirm",
          name: "doPR",
          message: "Create a GitHub Pull Request?",
          default: true,
        },
      ]);

      if (doPR) {
        const prUrl = createPullRequest(
          branchName,
          response.commitMessage,
          response.explanation
        );
        if (prUrl) {
          console.log(chalk.bold.green(`\n🎉 PR URL: ${prUrl}`));
        }
      }
    }
  }

  console.log(chalk.bold.green("\n✅ Agent task completed!\n"));
}

// ============================================================================
// Entry Point
// ============================================================================

runAgent().catch((error) => {
  console.error(chalk.red("\n❌ Agent failed:"), error);
  process.exit(1);
});
