#!/usr/bin/env node
// Every release lane calls sync-release-generated.sh and nothing else runs it,
// so a dropped line continuation in its `git add` shipped once and only
// surfaced mid-release: bash ended the command early and ran the next path as
// a command (exit 126, "is a directory"). Neither `bash -n` nor shellcheck
// flags that — an orphaned path is a syntactically valid command — so this
// audit reproduces bash's own continuation rules and then asserts that no
// logical command starts with a repository path.

import {
  readFileSync,
  existsSync,
  statSync,
  accessSync,
  constants,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = "scripts/sync-release-generated.sh";

// A line continues only when it ends in an odd number of backslashes at the
// very end of the line. `foo \ ` (backslash, space) is an escaped space, so
// bash ends the command there — the exact trap the previous check missed.
function continuesLine(line) {
  const match = /(\\+)$/u.exec(line);
  return match ? match[1].length % 2 === 1 : false;
}

export function toLogicalLines(source) {
  const logical = [];
  let buffer = null;

  source.split("\n").forEach((raw, index) => {
    const isContinuation = buffer !== null;
    const text = isContinuation ? raw : raw.replace(/^\s+/u, "");

    if (!isContinuation && (text === "" || text.startsWith("#"))) return;

    // Bash deletes the backslash-newline pair outright, so `a\<newline>b` is
    // the single token `ab`. Concatenate rather than joining with a space.
    if (continuesLine(raw)) {
      const joined = text.replace(/\\$/u, "");
      buffer = buffer
        ? { ...buffer, text: buffer.text + joined }
        : { line: index + 1, text: joined };
      return;
    }

    logical.push(
      buffer
        ? { line: buffer.line, text: buffer.text + text }
        : { line: index + 1, text },
    );
    buffer = null;
  });

  if (buffer) logical.push(buffer);
  return logical;
}

// git refuses to stage outside the work tree, so a token that escapes the
// repository fails the release rather than this audit unless caught here.
function insideRepo(target) {
  const rel = relative(REPO_ROOT, target);
  // An empty relative path is REPO_ROOT itself, which `git add .` stages.
  return !rel.startsWith("..") && !isAbsolute(rel);
}

function isRunnable(target) {
  if (statSync(target).isDirectory()) return false;
  try {
    accessSync(target, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function auditGitAddBlocks(source) {
  const failures = [];
  const logical = toLogicalLines(source);
  let sawGitAdd = false;

  logical.forEach(({ line, text }) => {
    const first = text.trim().split(/\s+/u)[0] ?? "";

    // Running a path is fine when it is an executable script; a directory or
    // a plain file can only have become a command by accident.
    if (
      first.includes("/") &&
      !first.startsWith("$") &&
      !first.startsWith('"')
    ) {
      const target = join(REPO_ROOT, first.replace(/^\.\//u, ""));
      if (existsSync(target) && !isRunnable(target)) {
        failures.push(
          `${SCRIPT}:${line}: "${first}" runs as a command; a line above it lost its "\\"`,
        );
      }
    }

    if (!/^git add\b/u.test(text.trim())) return;
    sawGitAdd = true;

    text
      .trim()
      .replace(/^git add\s*/u, "")
      .split(/\s+/u)
      .filter((token) => token && !token.startsWith("-"))
      .forEach((token) => {
        if (token.includes("$") || token.includes("*")) return;
        const target = resolve(REPO_ROOT, token);
        if (!insideRepo(target)) {
          failures.push(
            `${SCRIPT}:${line}: staged path escapes the repository: ${token}`,
          );
          return;
        }
        if (!existsSync(target)) {
          failures.push(
            `${SCRIPT}:${line}: staged path does not exist: ${token}`,
          );
        }
      });
  });

  if (!sawGitAdd) failures.push(`${SCRIPT}: no git add command found`);
  return failures;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = auditGitAddBlocks(
    readFileSync(join(REPO_ROOT, SCRIPT), "utf8"),
  );
  if (failures.length) {
    console.error("Release sync script audit failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log("Release sync script audit passed.");
}
