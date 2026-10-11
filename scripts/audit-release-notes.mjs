#!/usr/bin/env node

// A PR into main that changes what a published package ships also updates the
// release card (AGENTS.md "Docs Ship With The Change"). #482, #484, #488 and
// #489 shipped without one. A behavior-neutral change carries "፦ refactor".

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { shipsInAnyPackage } from "./release-branch-policy.mjs";

export const KIT_RELEASE_NOTES =
  "packages/kit/src/pages/docs/sections/release-notes.tsx";

export function findUnnotedKitChanges(files) {
  if (files.includes(KIT_RELEASE_NOTES)) return [];
  return files.filter((file) => {
    const runtimeSource =
      /^(packages\/kit\/(convex|server|src)\/|packages\/mcp-server\/src\/)/.test(
        file,
      ) &&
      !/^packages\/kit\/src\/pages\/docs\//.test(file) &&
      /\.(?:ts|tsx)$/.test(file);
    const deployment =
      /^packages\/kit\/(?:Dockerfile|fly\.toml|scripts\/deploy-prod\.sh)$/.test(
        file,
      );
    const commerceArtifact =
      /^specs\/commerce-protocol\/(src\/|generated\/|examples\/provider-capabilities\.json$)/.test(
        file,
      );
    return (
      (runtimeSource || deployment || commerceArtifact) &&
      !/(\.(test|spec)\.[^/]+$|\/(?:__tests__|_generated)\/|\/test\.setup\.ts$)/.test(
        file,
      )
    );
  });
}

export const RELEASE_NOTES =
  "packages/docs/src/pages/docs/updates/releases.tsx";

export function findUnnotedSourceChanges(files) {
  if (files.includes(RELEASE_NOTES)) return [];
  return files.filter(shipsInAnyPackage);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const base = process.argv[2] ?? "HEAD^1";
  // Three dots: only this branch's changes, even after the base moved on.
  const files = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const unnoted = findUnnotedSourceChanges(files);
  const unnotedKit = findUnnotedKitChanges(files);
  if (unnotedKit.length) {
    console.error(
      `::error::Hosted IAPKit changes need ${KIT_RELEASE_NOTES}. Update the existing deployment-week entry, or add one for a new week; do not create one entry per PR.`,
    );
    for (const file of unnotedKit) console.error(`- ${file}`);
    process.exitCode = 1;
  }
  if (unnoted.length > 0) {
    console.error(
      `::error::These files ship in a published package, but ${RELEASE_NOTES} is unchanged. ` +
        `Add the change to the next release card (written as already published), ` +
        `or label a behavior-neutral PR "፦ refactor" and re-run this job.`,
    );
    for (const file of unnoted) console.error(`- ${file}`);
    process.exitCode = 1;
  }
  if (!unnoted.length && !unnotedKit.length) {
    console.log("Release note audit: clean.");
  }
}
