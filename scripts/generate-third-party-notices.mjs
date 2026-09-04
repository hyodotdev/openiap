#!/usr/bin/env node
// Derives per-component license evidence from the SBOM component table.
//
// Two outputs, both deterministic and both refusing to guess:
//   inventory — every embedded third-party component with its declared SPDX id
//   notices   — the verbatim upstream license text for components whose
//               license requires the notice to travel with the binary
//
// A component that declares a license but commits no license text is an error,
// not a blank section: MIT and the BSD family require the copyright notice in
// every redistribution, and the godot-iap addon ZIP shipped without one.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { __testing as sbomTesting } from "./generate-sbom.mjs";

// Licenses whose text must be redistributed alongside the binary.
export const NOTICE_REQUIRING_LICENSES = new Set([
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
]);

// A component's source is either one entry or an aggregate of entries, and an
// aggregate can nest, so walk it rather than assuming a single level.
const embeddedBinaries = (source, found = []) => {
  if (!source || typeof source !== "object") return found;
  if (source.kind === "embedded-binary") {
    found.push(source);
    return found;
  }
  for (const nested of source.sources ?? []) {
    embeddedBinaries(nested, found);
  }
  return found;
};

export function collectEmbeddedComponents(componentId) {
  return embeddedBinaries(sbomTesting.COMPONENTS[componentId]?.source).map(
    (part) => ({
      name: part.name,
      spdxLicense: part.spdxLicense ?? null,
      supplier: part.supplier ?? null,
      binary: part.file,
      licenseFile: part.licenseFile ?? null,
    }),
  );
}

export function collectNoticeFailures(repoRoot, componentId) {
  const failures = [];
  for (const component of collectEmbeddedComponents(componentId)) {
    if (!component.spdxLicense) {
      failures.push(
        `${component.name}: no SPDX license recorded; resolve it upstream rather than guessing`,
      );
      continue;
    }
    if (!NOTICE_REQUIRING_LICENSES.has(component.spdxLicense)) continue;
    if (!component.licenseFile) {
      failures.push(
        `${component.name}: ${component.spdxLicense} requires its notice to ship, but no licenseFile is recorded`,
      );
      continue;
    }
    if (!fs.existsSync(path.resolve(repoRoot, component.licenseFile))) {
      failures.push(
        `${component.name}: licenseFile ${component.licenseFile} does not exist`,
      );
    }
  }
  return failures;
}

export function renderNotices(repoRoot, componentId) {
  const failures = collectNoticeFailures(repoRoot, componentId);
  if (failures.length > 0) {
    throw new Error(
      `cannot render notices for ${componentId}:\n${failures.map((f) => `  - ${f}`).join("\n")}`,
    );
  }
  const components = collectEmbeddedComponents(componentId)
    .filter((component) => NOTICE_REQUIRING_LICENSES.has(component.spdxLicense))
    .sort((left, right) => left.name.localeCompare(right.name));

  // One section per distinct license file: two frameworks built from the same
  // upstream project share one notice rather than repeating it.
  const byLicenseFile = new Map();
  for (const component of components) {
    const existing = byLicenseFile.get(component.licenseFile);
    if (existing) {
      existing.names.push(component.name);
      continue;
    }
    byLicenseFile.set(component.licenseFile, {
      names: [component.name],
      spdxLicense: component.spdxLicense,
      supplier: component.supplier,
    });
  }

  const sections = [...byLicenseFile.entries()].map(([file, entry]) => {
    const text = fs.readFileSync(path.resolve(repoRoot, file), "utf8").trim();
    const supplier = entry.supplier ? ` — ${entry.supplier}` : "";
    return [
      `## ${entry.names.join(", ")}${supplier}`,
      "",
      `SPDX-License-Identifier: ${entry.spdxLicense}`,
      "",
      "```text",
      text,
      "```",
    ].join("\n");
  });

  return [
    "# Third-party notices",
    "",
    `Components redistributed inside the \`${componentId}\` release artifact.`,
    "Generated from the SBOM component table by",
    "`scripts/generate-third-party-notices.mjs`; do not edit by hand.",
    "",
    ...sections,
    "",
  ].join("\n");
}

export function renderInventory(componentId) {
  const components = collectEmbeddedComponents(componentId).sort(
    (left, right) => left.name.localeCompare(right.name),
  );
  const rows = components.map((component) =>
    [
      component.name,
      component.spdxLicense ?? "UNKNOWN — needs review",
      component.supplier ?? "unknown",
      component.binary,
    ].join("\t"),
  );
  return ["name\tlicense\tsupplier\tbinary", ...rows].join("\n") + "\n";
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const [componentId, outputPath] = process.argv.slice(2);
  if (!componentId) {
    console.error(
      "usage: generate-third-party-notices.mjs <component> [output]\n" +
        `components: ${Object.keys(sbomTesting.COMPONENTS).sort().join(", ")}`,
    );
    process.exit(2);
  }
  if (!sbomTesting.COMPONENTS[componentId]) {
    console.error(`unknown component ${JSON.stringify(componentId)}`);
    process.exit(2);
  }
  if (process.argv.includes("--inventory")) {
    process.stdout.write(renderInventory(componentId));
    process.exit(0);
  }
  let notices;
  try {
    notices = renderNotices(repoRoot, componentId);
  } catch (error) {
    console.error(String(error.message));
    process.exit(1);
  }
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outputPath), notices);
    console.log(`wrote ${outputPath}`);
  } else {
    process.stdout.write(notices);
  }
}
