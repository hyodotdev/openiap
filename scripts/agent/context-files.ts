import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Source and output paths for the generated agent context.
 *
 * The compiler, pre-commit hook, and tests consume this contract directly.
 * CI runs the freshness check unconditionally, so it does not maintain a
 * second path-filter inventory that can drift when a new compiler input is
 * introduced.
 */
export const CONTEXT_DIRECT_INPUTS = Object.freeze({
  compilerRoot: "scripts/agent",
  rootPackage: "package.json",
  rootLock: "bun.lock",
  openiapVersions: "openiap-versions.json",
  flutterPackage: "libraries/flutter_inapp_purchase/pubspec.yaml",
  godotPackage: "libraries/godot-iap/addons/godot-iap/plugin.cfg",
  kmpPackage: "libraries/kmp-iap/gradle.properties",
  mauiPackage: "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
  kitQuickReference: "packages/kit/public/llms.txt",
});

const knowledgeRoot = "knowledge";
export const CONTEXT_KNOWLEDGE_INPUT_ROOTS = Object.freeze({
  internal: `${knowledgeRoot}/internal`,
  external: `${knowledgeRoot}/external`,
});

export const CONTEXT_SOURCES = Object.freeze({
  ...CONTEXT_DIRECT_INPUTS,
  knowledgeRoot,
  internalKnowledgeGlob: `${CONTEXT_KNOWLEDGE_INPUT_ROOTS.internal}/**/*.md`,
  externalKnowledgeGlob: `${CONTEXT_KNOWLEDGE_INPUT_ROOTS.external}/**/*.md`,
});

export const CONTEXT_INPUT_PATHS = Object.freeze([
  ...Object.values(CONTEXT_DIRECT_INPUTS),
  ...Object.values(CONTEXT_KNOWLEDGE_INPUT_ROOTS),
]);

export const CONTEXT_OUTPUTS = Object.freeze({
  context: "knowledge/_agent-context/context.md",
  llmsQuick: "packages/docs/public/llms.txt",
  llmsFull: "packages/docs/public/llms-full.txt",
  rootLlmsQuick: "llms.txt",
  rootLlmsFull: "llms-full.txt",
});

export const CONTEXT_COMPATIBILITY_SYMLINKS = Object.freeze({
  "knowledge/_claude-context": "_agent-context",
});

export const CONTEXT_OUTPUT_PATHS = Object.freeze([
  ...Object.values(CONTEXT_OUTPUTS),
  ...Object.keys(CONTEXT_COMPATIBILITY_SYMLINKS),
]);

export const ROOT_LLMS_SYMLINKS = Object.freeze({
  [CONTEXT_OUTPUTS.rootLlmsQuick]: CONTEXT_OUTPUTS.llmsQuick,
  [CONTEXT_OUTPUTS.rootLlmsFull]: CONTEXT_OUTPUTS.llmsFull,
});

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const gitLines = (...args: string[]): string[] => {
  const output = execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  return output ? output.split("\n") : [];
};

const stagedContextInputs = (): string[] =>
  gitLines(
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMRD",
    "--",
    ...CONTEXT_INPUT_PATHS,
  );

const unstagedContextInputs = (): string[] =>
  [
    ...gitLines("diff", "--name-only", "--", ...CONTEXT_INPUT_PATHS),
    ...gitLines(
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      ...CONTEXT_INPUT_PATHS,
    ),
  ]
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .sort();

const unstagedContextOutputs = (): string[] =>
  [
    ...gitLines("diff", "--name-only", "--", ...CONTEXT_OUTPUT_PATHS),
    ...gitLines(
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      ...CONTEXT_OUTPUT_PATHS,
    ),
  ]
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .sort();

const printPaths = (entries: readonly string[]): void => {
  for (const entry of entries) {
    console.error(`- ${entry}`);
  }
};

const runCli = (command: string | undefined): void => {
  if (command === "has-staged-inputs") {
    process.exitCode = stagedContextInputs().length > 0 ? 0 : 1;
    return;
  }
  if (command === "assert-inputs-staged-clean") {
    const drift = unstagedContextInputs();
    if (drift.length > 0) {
      console.error(
        "Generated-context inputs contain unstaged or untracked changes. Stage the complete source snapshot:",
      );
      printPaths(drift);
      process.exitCode = 1;
    }
    return;
  }
  if (command === "assert-outputs-clean") {
    const drift = unstagedContextOutputs();
    if (drift.length > 0) {
      console.error(
        "Compiled agent context differs from the checked-in snapshot. Regenerate and stage the outputs when committing:",
      );
      printPaths(drift);
      process.exitCode = 1;
    }
    return;
  }
  throw new Error(
    `Unknown context-files command "${command ?? ""}". Expected has-staged-inputs, assert-inputs-staged-clean, or assert-outputs-clean.`,
  );
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runCli(process.argv[2]);
}
