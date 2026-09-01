#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

export const canonicalContainers = Object.freeze([
  "packages",
  "libraries",
  "plugins",
  "specs",
]);

export function findDuplicateRootPaths(root = repositoryRoot) {
  return canonicalContainers
    .flatMap((container) => {
      const containerPath = path.join(root, container);

      if (!fs.existsSync(containerPath)) {
        return [];
      }

      return fs
        .readdirSync(containerPath, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isDirectory() &&
            entry.name !== "node_modules" &&
            !entry.name.startsWith("."),
        )
        .map((entry) => ({
          duplicate: entry.name,
          canonical: path.posix.join(container, entry.name),
        }));
    })
    .filter(({ duplicate }) => {
      if (canonicalContainers.includes(duplicate)) {
        return false;
      }

      const duplicatePath = path.join(root, duplicate);
      return (
        fs.existsSync(duplicatePath) && fs.statSync(duplicatePath).isDirectory()
      );
    })
    .sort((left, right) => left.canonical.localeCompare(right.canonical));
}

export function auditRepositoryLayout(root = repositoryRoot) {
  const violations = findDuplicateRootPaths(root);

  if (violations.length === 0) {
    return [];
  }

  return violations.map(
    ({ duplicate, canonical }) =>
      `remove duplicate root ${duplicate}/; use ${canonical}/ instead`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const errors = auditRepositoryLayout();

  if (errors.length === 0) {
    console.log("Repository layout audit: clean.");
  } else {
    console.error("Repository layout audit failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}
