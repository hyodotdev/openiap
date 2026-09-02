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

function isSpecificationDeploymentFile(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  const fileName = path.posix.basename(normalized);

  return (
    /^Dockerfile(?:[.-].+)?$/u.test(fileName) ||
    /^(?:docker-)?compose(?:\.[^/]+)?\.ya?ml$/u.test(fileName) ||
    /^fly(?:\.[^/]+)?\.toml$/u.test(fileName) ||
    fileName === "convex.json" ||
    fileName === "vercel.json" ||
    normalized.endsWith("/.openai/hosting.json") ||
    normalized === ".openai/hosting.json"
  );
}

function findSpecificationDeploymentFiles(directory, prefix = "") {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.name === "node_modules" || entry.name === ".git") return [];

      const relativePath = path.join(prefix, entry.name);
      if (entry.isDirectory()) {
        return findSpecificationDeploymentFiles(
          path.join(directory, entry.name),
          relativePath,
        );
      }
      return entry.isFile() && isSpecificationDeploymentFile(relativePath)
        ? [relativePath]
        : [];
    })
    .sort();
}

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
  const violations = findDuplicateRootPaths(root).map(
    ({ duplicate, canonical }) =>
      `remove duplicate root ${duplicate}/; use ${canonical}/ instead`,
  );

  const legacyGqlPath = path.join(root, "packages", "gql");
  if (fs.existsSync(legacyGqlPath)) {
    violations.push(
      "remove legacy packages/gql/; use specs/openiap/client/ instead",
    );
  }

  const legacyCommercePath = path.join(root, "specs", "openiap-kit");
  if (fs.existsSync(legacyCommercePath)) {
    violations.push(
      "remove legacy specs/openiap-kit/; use specs/openiap/commerce-protocol/ instead",
    );
  }

  const umbrellaPackageManifest = path.join(
    root,
    "specs",
    "openiap",
    "package.json",
  );
  if (fs.existsSync(umbrellaPackageManifest)) {
    violations.push(
      "remove specs/openiap/package.json; publish only the client and commerce-protocol child packages",
    );
  }

  const specsPath = path.join(root, "specs");
  if (fs.existsSync(specsPath)) {
    const openiapSpecsPath = path.join(specsPath, "openiap");
    if (fs.existsSync(openiapSpecsPath)) {
      for (const child of ["client", "commerce-protocol"]) {
        const childManifest = path.join(
          openiapSpecsPath,
          child,
          "package.json",
        );
        if (!fs.existsSync(childManifest)) {
          violations.push(
            `restore canonical specification package specs/openiap/${child}/package.json`,
          );
        }
      }
    }

    for (const entry of fs.readdirSync(specsPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;

      if (entry.name !== "openiap" && entry.name !== "openiap-kit") {
        violations.push(
          `move specification root specs/${entry.name}/ under specs/openiap/`,
        );
      }

      const specificationPath = path.join(specsPath, entry.name);
      for (const deploymentFile of findSpecificationDeploymentFiles(
        specificationPath,
      )) {
        violations.push(
          `move service deployment manifest specs/${entry.name}/${deploymentFile.split(path.sep).join("/")} to its runtime implementation`,
        );
      }
    }
  }

  if (violations.length === 0) {
    return [];
  }

  return violations;
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
