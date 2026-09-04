#!/usr/bin/env node
// security/SBOM.md carries a reader-facing copy of the releasable component
// list. The list itself lives in scripts/release-branch-policy.mjs and is
// mirrored by scripts/generate-sbom.mjs; without this audit the documentation
// copy drifts silently, which is how `commerce-protocol` shipped an SBOM
// artifact while the documented matrix said the component did not exist.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { versionSources } from "./release-branch-policy.mjs";
import { __testing as sbomTesting } from "./generate-sbom.mjs";

export const SBOM_DOC = "security/SBOM.md";

const MATRIX_ROW = /^\|\s*`([a-z-]+)`\s*\|\s*`([^`]+)`\s*\|/gm;

export function parseDocumentedComponents(markdown) {
  return [...markdown.matchAll(MATRIX_ROW)].map(([, id, sbomName]) => ({
    id,
    sbomName,
  }));
}

const describe = (ids) => ids.map((id) => `\`${id}\``).join(", ");

export function collectSbomDocFailures(repoRoot) {
  const failures = [];
  const docPath = path.resolve(repoRoot, SBOM_DOC);
  if (!fs.existsSync(docPath)) {
    return [`${SBOM_DOC} is missing`];
  }

  const released = Object.keys(versionSources).sort();
  const generated = Object.keys(sbomTesting.COMPONENTS).sort();

  // The generator is what actually emits artifacts, so it must cover exactly
  // the components the release policy knows how to version.
  const ungenerated = released.filter((id) => !generated.includes(id));
  const unreleased = generated.filter((id) => !released.includes(id));
  if (ungenerated.length > 0) {
    failures.push(
      `releasable components with no SBOM generator entry: ${describe(ungenerated)}`,
    );
  }
  if (unreleased.length > 0) {
    failures.push(
      `SBOM generator entries that are not releasable components: ${describe(unreleased)}`,
    );
  }

  const documented = parseDocumentedComponents(
    fs.readFileSync(docPath, "utf8"),
  );
  const documentedIds = documented.map((row) => row.id).sort();
  const undocumented = generated.filter((id) => !documentedIds.includes(id));
  const stale = documentedIds.filter((id) => !generated.includes(id));
  if (undocumented.length > 0) {
    failures.push(
      `${SBOM_DOC} omits released components: ${describe(undocumented)}`,
    );
  }
  if (stale.length > 0) {
    failures.push(
      `${SBOM_DOC} documents components that no longer exist: ${describe(stale)}`,
    );
  }

  // A wrong SBOM name sends a reader to a file that was never published.
  for (const row of documented) {
    const definition = sbomTesting.COMPONENTS[row.id];
    if (!definition) continue;
    if (definition.sbomName !== row.sbomName) {
      failures.push(
        `${SBOM_DOC} lists \`${row.id}\` as \`${row.sbomName}\`, but the generator emits \`${definition.sbomName}\``,
      );
    }
  }

  return failures;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const failures = collectSbomDocFailures(repoRoot);
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  if (failures.length > 0) {
    process.exit(1);
  }
  console.log(
    `SBOM documentation audit passed (${Object.keys(versionSources).length} components).`,
  );
}
