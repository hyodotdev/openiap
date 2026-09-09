#!/usr/bin/env bun
// Advisory freshness check for the recorded IAPKit replacement evidence: lists
// every recorded input whose current bytes differ from the run the docs show.
// The docs build only checks that the evidence agrees with itself.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  diffSourceHashes,
  inventories,
} from "../packages/kit/scripts/docs/commerce-source-snapshot.mjs";

const REPORT = "packages/docs/public/commerce-composition/iapkit-run.json";
const EXPORT =
  "bun packages/kit/scripts/docs/export-commerce-interop.mjs <run-directory> ../openiap-commerce-protocol-example";

export function auditCommerceEvidence(repoRoot) {
  const report = JSON.parse(readFileSync(path.join(repoRoot, REPORT), "utf8"));
  if (
    !report.sources?.openiap?.hashes ||
    !report.sources.workspace?.hashes ||
    !report.harnessHashes
  )
    throw new Error(`${REPORT} is not a recorded interop report; re-record it`);
  const kit = path.join(repoRoot, "packages/kit");
  const harness = path.join(kit, "scripts/docs");
  const groups = [
    ["openiap", kit, report.sources.openiap, inventories.openiap(kit)],
    [
      "workspace",
      repoRoot,
      report.sources.workspace,
      inventories.workspace(repoRoot),
    ],
    [
      "harness",
      harness,
      { hashes: report.harnessHashes },
      inventories.harness(harness),
    ],
  ];
  const drift = [];
  for (const [name, root, recorded, inventory] of groups) {
    const diff = diffSourceHashes(root, recorded.hashes, {
      allowMissing: recorded.optionalGeneratedFiles ?? [],
      inventory,
    });
    for (const kind of ["changed", "missing", "added"])
      drift.push(...diff[kind].map((file) => `${name}/${file} ${kind}`));
  }
  return {
    recordedAt: report.recordedAt,
    baseRevision: report.sources.openiap.baseRevision,
    command: report.command,
    drift,
  };
}

// Keeps the runner's `-dirty` marker for recordings from an uncommitted tree.
export const shortRevision = (revision) =>
  revision.replace(/^([0-9a-f]{8})[0-9a-f]*/, "$1");

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const { recordedAt, baseRevision, command, drift } =
    auditCommerceEvidence(root);
  const recorded = `recorded ${recordedAt.slice(0, 10)} at ${shortRevision(baseRevision)}`;
  if (drift.length === 0) {
    console.log(
      `Commerce evidence (${recorded}) matches every recorded input.`,
    );
  } else {
    const message = `Commerce evidence (${recorded}) differs from ${drift.length} current input(s).`;
    console.log(message);
    for (const line of drift.slice(0, 40)) console.log(`  ${line}`);
    if (drift.length > 40) console.log(`  … ${drift.length - 40} more`);
    console.log(
      `Re-record when a displayed snapshot or commerce code path changed:\n  ${command}\n  ${EXPORT}`,
    );
    if (process.env.GITHUB_ACTIONS) console.log(`::warning::${message}`);
    process.exit(1);
  }
}
