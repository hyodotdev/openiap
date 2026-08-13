#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function findWorkflowRunInterpolations(
  source,
  filename = "workflow.yml",
) {
  const lines = source.split("\n");
  const findings = [];

  for (let index = 0; index < lines.length; index += 1) {
    const opener = lines[index].match(/^(\s*)(?:-\s*)?run:\s*(.*)$/u);
    if (!opener) continue;
    const indentation = opener[1].length;
    if (opener[2].includes("${{")) {
      findings.push(`${filename}:${index + 1}: ${lines[index].trim()}`);
    }
    if (!/^[|>][-+]?\s*$/u.test(opener[2])) continue;

    for (let runIndex = index + 1; runIndex < lines.length; runIndex += 1) {
      const line = lines[runIndex];
      if (line.trim() && line.match(/^\s*/u)[0].length <= indentation) break;
      if (line.includes("${{")) {
        findings.push(`${filename}:${runIndex + 1}: ${line.trim()}`);
      }
    }
  }

  return findings;
}

export function extractExternalUrls(source) {
  const urls = [];
  for (const match of source.matchAll(/https?:\/\/[^\s<>"'`)\]}]+/gu)) {
    const nextCharacter = source[match.index + match[0].length];
    if (nextCharacter === "<" || nextCharacter === "{") continue;
    urls.push(match[0].replace(/[.,;:]+$/u, ""));
  }
  return urls;
}

export async function auditWorkflowFiles(paths) {
  const findings = paths.flatMap((path) =>
    findWorkflowRunInterpolations(
      readFileSync(resolve(repoRoot, path), "utf8"),
      path,
    ),
  );
  if (findings.length === 0) {
    throw new Error(
      "No workflow run expressions found; refusing to report a vacuous pass",
    );
  }
  process.stdout.write(`${findings.join("\n")}\n`);
}

async function auditUrls(paths) {
  const urls = [
    ...new Set(
      paths.flatMap((path) =>
        extractExternalUrls(readFileSync(resolve(repoRoot, path), "utf8")),
      ),
    ),
  ].sort();
  if (urls.length === 0) {
    throw new Error(
      "No external URLs found; refusing to report a vacuous pass",
    );
  }

  const failures = [];
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          redirect: "follow",
          signal: AbortSignal.timeout(20_000),
        });
        await response.body?.cancel();
        if (!response.ok) failures.push(`${response.status} ${url}`);
      } catch (error) {
        failures.push(`ERROR ${url} (${error.message})`);
      }
    }),
  );

  process.stdout.write(
    failures.length > 0
      ? `${failures.sort().join("\n")}\n`
      : `${urls.length} external URLs resolved.\n`,
  );
  if (failures.length > 0) process.exitCode = 1;
}

async function main() {
  const [command, ...paths] = process.argv.slice(2);
  if (!command || paths.length === 0) {
    throw new Error(
      "Usage: audit-security.mjs <workflows|urls> <repository-relative files...>",
    );
  }
  if (command === "workflows") {
    await auditWorkflowFiles(paths);
    return;
  }
  if (command === "urls") {
    await auditUrls(paths);
    return;
  }
  throw new Error(`Unknown audit command '${command}'`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
