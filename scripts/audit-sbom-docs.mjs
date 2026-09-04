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
import {
  SBOM_COVERAGE_FLOOR,
  __testing as sbomTesting,
} from "./generate-sbom.mjs";

export const SBOM_DOC = "security/SBOM.md";

// Anchor to the component table's own header rather than matching any table:
// the document carries other tables whose first column is also a backticked
// identifier, and reading those as components made this audit report the
// document against itself.
const MATRIX_HEADER = /^\|\s*Component\s*\|\s*SBOM name\s*\|.*$/m;
const MATRIX_ROW = /^\|\s*`([a-z-]+)`\s*\|\s*`([^`]+)`\s*\|/;

// The coverage-floor table is a second copy of SBOM_COVERAGE_FLOOR.
const FLOOR_HEADER =
  /^\|\s*Component\s*\|\s*First release required to carry an SBOM\s*\|.*$/m;
const FLOOR_ROW = /^\|\s*`([a-z-]+)`\s*\|\s*`([^`]+)`\s*\|/;

export function parseDocumentedFloors(markdown) {
  const header = markdown.match(FLOOR_HEADER);
  if (!header) return null;
  const rows = new Map();
  for (const line of markdown
    .slice(header.index + header[0].length)
    .split("\n")) {
    if (!line.trimStart().startsWith("|")) {
      if (rows.size > 0) break;
      continue;
    }
    const match = line.match(FLOOR_ROW);
    if (match) {
      if (rows.has(match[1])) rows.set(`${match[1]}\u0000duplicate`, match[2]);
      else rows.set(match[1], match[2]);
    }
  }
  return rows;
}

export function parseDocumentedComponents(markdown) {
  const header = markdown.match(MATRIX_HEADER);
  if (!header) return [];
  const rows = [];
  const lines = markdown.slice(header.index + header[0].length).split("\n");
  for (const line of lines) {
    if (!line.trimStart().startsWith("|")) {
      if (rows.length > 0) break;
      continue;
    }
    const match = line.match(MATRIX_ROW);
    if (match) rows.push({ id: match[1], sbomName: match[2] });
    // Duplicates are kept, not collapsed: two rows for one component give the
    // reader contradictory answers, and a Map would hide the first one.
  }
  return rows;
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

  // The floor table is policy documentation readers act on, so it drifts
  // silently unless it is compared with the map the audit actually uses.
  const documentedFloors = parseDocumentedFloors(
    fs.readFileSync(docPath, "utf8"),
  );
  if (!documentedFloors) {
    failures.push(`${SBOM_DOC} has no coverage-floor table`);
  } else {
    const declared = new Map(Object.entries(SBOM_COVERAGE_FLOOR));
    for (const [id, tag] of declared) {
      if (!documentedFloors.has(id)) {
        failures.push(`${SBOM_DOC} omits the coverage floor for \`${id}\``);
      } else if (documentedFloors.get(id) !== tag) {
        failures.push(
          `${SBOM_DOC} lists the \`${id}\` floor as \`${documentedFloors.get(id)}\`, ` +
            `but the generator uses \`${tag}\``,
        );
      }
    }
    for (const id of documentedFloors.keys()) {
      if (id.includes("\u0000")) {
        failures.push(
          `${SBOM_DOC} lists the coverage floor for \`${id.split("\u0000")[0]}\` more than once`,
        );
        continue;
      }
      if (!declared.has(id)) {
        failures.push(
          `${SBOM_DOC} documents a coverage floor for \`${id}\`, which has none`,
        );
      }
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
