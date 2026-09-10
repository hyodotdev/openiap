#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The specification roots that may sit directly under specs/. Each one is a
// publishable contract with its own package manifest, never a deployed service.
const SPECIFICATION_ROOTS = ["client", "commerce-protocol"];
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

/** The name every repository tree in this project is rooted at. */
const REPOSITORY_ROOT = "openiap";

const BRANCH = /^([\s│]*)(?:├──|└──)\s+(\S+)/u;
const COMMENT_ROW = /^[\s│]*#/u;
const ELIDED = /^(\.\.\.|…)$/u;
const DRAWS_A_BRANCH = /[├└]/u;

/** Every file carrying a repository tree that agents read as the map. */
export const DOCUMENTED_TREES = Object.freeze([
  "AGENTS.md",
  "CONTRIBUTING.md",
  "knowledge/internal/02-architecture.md",
  ".claude/guides/01-overview.md",
]);

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

/**
 * Paths a markdown file's repository trees claim exist.
 *
 * Depth comes from the indent before the branch character, so a nested entry
 * is resolved against its parent rather than read as a top-level name.
 */
export function findDocumentedTreePaths(markdown) {
  const blocks = [];
  let fence = null;
  let block = [];
  for (const raw of markdown.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const line = raw.replace(/\t/gu, "    ");
    // One fence form, the one every document here writes.
    const marker = line.match(/^ {0,3}(`{3,})(.*)$/u);
    if (marker && fence === null && !marker[2].includes("`")) {
      fence = marker[1];
      block = [];
      continue;
    }
    if (
      marker &&
      fence !== null &&
      marker[1].length >= fence.length &&
      marker[2].trim() === ""
    ) {
      blocks.push(block);
      fence = null;
      continue;
    }
    if (fence !== null) block.push(line);
  }

  // Every repository tree in the file is a claim about the filesystem, so
  // check them all: reading only the first lets a stray tree stand in for it.
  const paths = [];
  let readable = false;
  for (const lines of blocks) {
    if (rootOf(lines) !== REPOSITORY_ROOT) continue;
    const parsed = parseTreeBlock(lines);
    // A block that claims to draw the repository and cannot be read is the
    // silent pass this function exists to prevent.
    if (parsed === null) return null;
    // `packages/google/openiap` draws its own tree rooted at `openiap/`, so
    // the name alone is not enough; a repository tree also names a container.
    // A tree may write `packages/cli/` as one row instead of nesting it.
    if (!parsed.some((entry) => canonicalContainers.includes(entry.split("/")[0]))) {
      continue;
    }
    readable = true;
    for (const entry of parsed) if (!paths.includes(entry)) paths.push(entry);
  }
  return readable ? paths : null;
}

/**
 * The name a block's tree is rooted at: the last line written before its first
 * branch, so a comment above the tree does not hide it.
 */
function rootOf(lines) {
  const before = [];
  for (const line of lines) {
    if (BRANCH.test(line) || DRAWS_A_BRANCH.test(line)) break;
    // A trunk-only spacer row and an in-fence comment name nothing.
    if (line.trim() === "" || /^[\s│]*$/u.test(line) || COMMENT_ROW.test(line)) {
      continue;
    }
    before.push(line);
  }
  return before
    .at(-1)
    ?.replace(/#.*$/u, "")
    .trim()
    .replace(/\/$/u, "");
}

/**
 * Paths in one fenced block, or null when its indentation does not describe a
 * tree. Every document here steps by four columns, so depth rounds to that: a
 * hand-drawn tree that slips a column is still readable.
 */
function parseTreeBlock(lines) {
  const written = lines.filter((one) => one.trim() !== "");
  const base = Math.min(
    ...written.map((one) => one.length - one.trimStart().length),
    Infinity,
  );
  const paths = [];
  const parents = [];
  for (const line of written.map((one) =>
    one.slice(Number.isFinite(base) ? base : 0),
  )) {
    const branch = line.match(BRANCH);
    if (!branch) {
      // A row drawn with glyphs this cannot read is not a row without a claim.
      if (DRAWS_A_BRANCH.test(line)) return null;
      continue;
    }
    const name = branch[2].replace(/\/$/u, "");
    // An entry that names nothing, or names its way out of the tree, resolves
    // to a path that exists whatever the tree meant.
    const segments = name.split(/[\\/]/u);
    if (
      name === "" ||
      path.posix.isAbsolute(name) ||
      path.win32.isAbsolute(name) ||
      segments.some((segment) => segment === "." || segment === "..")
    ) {
      return null;
    }
    // Any indent at all is a child, however compactly the trunk is drawn.
    const indent = branch[1].length;
    const depth = indent === 0 ? 0 : Math.max(1, Math.round(indent / 4));
    if (depth > parents.length) return null;
    parents.length = depth;
    parents[depth] = name;
    // `...` stands in for entries the author chose not to list, so it names no
    // path -- and nothing under it can be resolved either.
    const chain = parents.slice(0, depth + 1);
    if (chain.some((one) => ELIDED.test(one))) {
      if (ELIDED.test(name)) continue;
      return null;
    }
    paths.push(chain.join("/"));
  }
  return paths.length > 0 ? paths : null;
}

export function auditRepositoryLayout(root = repositoryRoot) {
  const violations = findDuplicateRootPaths(root).map(
    ({ duplicate, canonical }) =>
      `remove duplicate root ${duplicate}/; use ${canonical}/ instead`,
  );

  // Deleting or renaming a registered map would otherwise remove its
  // enforcement without a word. A fixture that carries none of them is not
  // this repository, so it is not drift.
  const registered = DOCUMENTED_TREES.filter((one) =>
    fs.existsSync(path.join(root, one)),
  );
  if (registered.length > 0) {
    for (const documentPath of DOCUMENTED_TREES) {
      if (!registered.includes(documentPath)) {
        violations.push(
          `${documentPath} is registered as a documented tree but does not exist`,
        );
      }
    }
  }

  for (const documentPath of registered) {
    const absolute = path.join(root, documentPath);

    let markdown;
    try {
      markdown = fs.readFileSync(absolute, "utf8");
    } catch (error) {
      violations.push(`${documentPath} could not be read (${error.code})`);
      continue;
    }
    const documented = findDocumentedTreePaths(markdown);
    if (documented === null) {
      // Returning an empty list here would pass silently, which is the one
      // outcome this check must never have.
      violations.push(`${documentPath} has no readable structure diagram`);
      continue;
    }
    for (const entry of documented) {
      if (!fs.existsSync(path.join(root, entry))) {
        violations.push(
          `${documentPath} documents ${entry}/, which does not exist`,
        );
      }
    }
  }

  const legacyGqlPath = path.join(root, "packages", "gql");
  if (fs.existsSync(legacyGqlPath)) {
    violations.push(
      "remove legacy packages/gql/; use specs/client/ instead",
    );
  }

  const legacyCommercePath = path.join(root, "specs", "openiap-kit");
  if (fs.existsSync(legacyCommercePath)) {
    violations.push(
      "remove legacy specs/openiap-kit/; use specs/commerce-protocol/ instead",
    );
  }

  const legacyUmbrellaPath = path.join(root, "specs", "openiap");
  if (fs.existsSync(legacyUmbrellaPath)) {
    violations.push(
      "remove legacy specs/openiap/; specifications sit directly under specs/",
    );
  }

  const specsPath = path.join(root, "specs");
  if (fs.existsSync(specsPath)) {
    for (const child of SPECIFICATION_ROOTS) {
      const childManifest = path.join(specsPath, child, "package.json");
      if (!fs.existsSync(childManifest)) {
        violations.push(
          `restore canonical specification package specs/${child}/package.json`,
        );
      }
    }

    for (const entry of fs.readdirSync(specsPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;

      if (!SPECIFICATION_ROOTS.includes(entry.name)) {
        violations.push(
          `unknown specification root specs/${entry.name}/; declare it in SPECIFICATION_ROOTS or move it`,
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
