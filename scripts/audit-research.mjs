#!/usr/bin/env node

// Drift audit for the research reference surface. Every research claim must
// keep resolving to something real: cite keys to bibliography entries,
// Applied paths to files, behavior ids to the conformance spec, suite-version
// literals to the versioned constant, and public-page citations to registry
// entries. A claim whose target disappears fails CI instead of going stale.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

const BIBLIOGRAPHY = "knowledge/research/bibliography.md";
const BACKLOG = "knowledge/research/backlog.md";
const MISUSE_CATALOG = "knowledge/research/misuse-catalog.md";
const RESEARCH_PAGE = "packages/docs/src/pages/docs/foundation/research.tsx";
// Docs pages carrying inline study citations; their scholarly links must stay
// registered in the bibliography.
const CITATION_PAGES = [
  RESEARCH_PAGE,
  "packages/docs/src/pages/docs/features/validation.tsx",
  "packages/docs/src/pages/docs/security/overview.tsx",
];
const DOCS_PAGES_ROOT = "packages/docs/src/pages/docs";

const PATH_PREFIXES = [
  "packages/",
  "scripts/",
  "libraries/",
  "knowledge/",
  ".github/",
];

export function bibliographyKeys(source) {
  return [...source.matchAll(/^### ([a-z]+\d{4}[a-z0-9]+)$/gm)].map(
    (match) => match[1],
  );
}

export function bibliographyLinks(source) {
  return new Set(
    [...source.matchAll(/<(https?:\/\/[^>\s]+)>/g)].map((match) => match[1]),
  );
}

/** Backticked repo paths and docs slugs inside `- Applied:` bullets. */
export function appliedReferences(source) {
  const refs = [];
  const bullets = source
    .split(/^- /m)
    .filter((part) => part.startsWith("Applied:"));
  for (const bullet of bullets) {
    // A bullet ends at the next heading; keys and prose after it are separate.
    const body = bullet.split(/^#{2,3} /m)[0];
    for (const match of body.matchAll(/`([^`]+)`/g)) {
      refs.push(match[1]);
    }
  }
  return refs;
}

export function repoPathReferences(tokens) {
  return tokens.filter(
    (token) =>
      token.includes("/") &&
      !token.includes("*") &&
      PATH_PREFIXES.some((prefix) => token.startsWith(prefix)),
  );
}

/** `docs \`features/validation\`` style slugs → docs page files. */
export function docsSlugReferences(tokens) {
  return tokens.filter((token) => /^[a-z-]+\/[a-z-]+$/.test(token));
}

/** Bare `misuse-catalog.md` style tokens resolve inside knowledge/research/. */
export function bareResearchFileReferences(tokens) {
  return tokens.filter((token) => /^[a-z0-9-]+\.md$/.test(token));
}

/** Cite-key-shaped tokens in files that reference the bibliography. */
export function citeKeyReferences(source) {
  // Author + four-digit year + slug, e.g. `mulliner2014virtualswindle`.
  return [...source.matchAll(/\b([a-z]{2,}(?:19|20)\d{2}[a-z0-9]{3,})\b/g)].map(
    (match) => match[1],
  );
}

export function behaviorIdReferences(source, categories) {
  // Real behavior ids are hyphenated (`products.fetch-returns-requested-skus`),
  // which keeps code snippets like `products.find(...)` out of the net.
  const pattern = new RegExp(
    `\\b(?:${categories.join("|")})\\.[a-z0-9]+(?:-[a-z0-9]+)+\\b`,
    "g",
  );
  return [...new Set([...source.matchAll(pattern)].map((match) => match[0]))];
}

/** Hrefs in either TSX-data (`href: '…'`) or JSX-attribute (`href="…"`) form. */
export function extractHrefs(source) {
  return [...source.matchAll(/href(?::\s*'|=")(https?:\/\/[^'"]+)['"]/g)].map(
    (match) => match[1],
  );
}

/** `suite 3.0.0` style literals that must track SUITE_VERSION. */
export function suiteVersionLiterals(source) {
  return [...source.matchAll(/suite (\d+\.\d+\.\d+)/g)].map(
    (match) => match[1],
  );
}

export function hostOf(url) {
  return new URL(url).hostname;
}

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(repositoryRoot, relativePath));
}

/** Intentionally untracked paths (datasets) are absent on fresh checkouts. */
function isGitIgnored(relativePath) {
  try {
    execFileSync("git", ["check-ignore", "-q", relativePath], {
      cwd: repositoryRoot,
    });
    return true;
  } catch {
    return false;
  }
}

function filesCitingBibliography() {
  const stdout = execFileSync(
    "git",
    ["grep", "-l", "--untracked", "knowledge/research/bibliography"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  const discovered = stdout.split("\n").filter(Boolean);
  // The research folder is the citing surface by definition — a file there
  // must not escape the net just because it omits the bibliography path.
  const researchDir = path.join(repositoryRoot, "knowledge", "research");
  const unconditional = fs
    .readdirSync(researchDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => `knowledge/research/${name}`);
  return [...new Set([...discovered, ...unconditional])].filter(
    (file) =>
      file !== BIBLIOGRAPHY &&
      !file.startsWith("knowledge/research/README") &&
      !file.startsWith("scripts/audit-research"),
  );
}

export async function auditResearchReferences() {
  const errors = [];
  const bibliography = read(BIBLIOGRAPHY);
  const keys = new Set(bibliographyKeys(bibliography));
  const links = bibliographyLinks(bibliography);
  const scholarlyHosts = new Set([...links].map(hostOf));

  if (keys.size === 0) {
    return ["bibliography has no cite keys — the parser is likely broken"];
  }

  // 1. Cite keys used anywhere must exist in the bibliography.
  for (const file of filesCitingBibliography()) {
    for (const token of citeKeyReferences(read(file))) {
      if (!keys.has(token)) {
        errors.push(`${file}: cite key "${token}" is not in ${BIBLIOGRAPHY}`);
      }
    }
  }

  // 2. Applied references must point at files that exist (or are declared
  // transient via .gitignore, like the mined datasets).
  const appliedTokens = [
    ...appliedReferences(bibliography),
    ...[...read(BACKLOG).matchAll(/`([^`]+)`/g)].map((match) => match[1]),
  ];
  for (const ref of repoPathReferences(appliedTokens)) {
    if (!exists(ref) && !isGitIgnored(ref)) {
      errors.push(`applied reference does not exist on disk: ${ref}`);
    }
  }
  for (const slug of docsSlugReferences(appliedReferences(bibliography))) {
    const page = `${DOCS_PAGES_ROOT}/${slug}.tsx`;
    if (!exists(page) && !exists(`${DOCS_PAGES_ROOT}/${slug}/index.tsx`)) {
      errors.push(`applied docs slug has no page: ${slug} (${page})`);
    }
  }
  for (const name of bareResearchFileReferences(appliedTokens)) {
    if (!exists(`knowledge/research/${name}`)) {
      errors.push(
        `applied reference does not exist: knowledge/research/${name}`,
      );
    }
  }

  // 3. Behavior ids cited anywhere on the research surface must exist.
  const { BEHAVIORS, BEHAVIOR_CATEGORIES } = await import(
    pathToFileURL(
      path.join(repositoryRoot, "packages/conformance/src/spec/behaviors.mjs"),
    ).href
  );
  const behaviorIds = new Set(BEHAVIORS.map((behavior) => behavior.id));
  for (const file of [RESEARCH_PAGE, MISUSE_CATALOG, BIBLIOGRAPHY, BACKLOG]) {
    for (const id of behaviorIdReferences(read(file), BEHAVIOR_CATEGORIES)) {
      if (!behaviorIds.has(id)) {
        errors.push(
          `${file}: behavior id "${id}" is not in the conformance spec`,
        );
      }
    }
  }

  // 4. Suite-version literals on the public page must track the constant.
  const { SUITE_VERSION } = await import(
    pathToFileURL(
      path.join(
        repositoryRoot,
        "packages/conformance/src/spec/suite-version.mjs",
      ),
    ).href
  );
  for (const literal of suiteVersionLiterals(read(RESEARCH_PAGE))) {
    if (literal !== SUITE_VERSION) {
      errors.push(
        `${RESEARCH_PAGE}: says "suite ${literal}" but SUITE_VERSION is ${SUITE_VERSION}`,
      );
    }
  }

  // 5. Scholarly links on citation pages must be registered, byte-exact.
  let scholarlyHrefCount = 0;
  for (const file of CITATION_PAGES) {
    for (const href of extractHrefs(read(file))) {
      if (!scholarlyHosts.has(hostOf(href))) continue;
      scholarlyHrefCount += 1;
      if (!links.has(href)) {
        errors.push(`${file}: study link not in ${BIBLIOGRAPHY}: ${href}`);
      }
    }
  }
  if (scholarlyHrefCount === 0) {
    errors.push(
      "no scholarly citations found on any citation page — the href parser is likely broken",
    );
  }

  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const errors = await auditResearchReferences();
  if (errors.length === 0) {
    console.log("Research reference audit: clean.");
  } else {
    console.error("Research reference audit failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}
