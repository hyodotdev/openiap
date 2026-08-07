#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const [branch, expectedHead] = process.argv.slice(2);

if (!branch || !expectedHead) {
  console.error(
    "Usage: node scripts/assert-release-head.mjs <branch> <dispatch-sha>",
  );
  process.exit(2);
}

if (!/^[0-9a-f]{40}$/i.test(expectedHead)) {
  console.error(`Invalid dispatch SHA: ${expectedHead}`);
  process.exit(2);
}

const ref = `refs/heads/${branch}`;
let remoteHead;

try {
  const output = execFileSync(
    "git",
    ["ls-remote", "--exit-code", "origin", ref],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  ).trim();
  remoteHead = output.split(/\s+/u)[0];
} catch {
  console.error(`Could not resolve origin/${branch}`);
  process.exit(1);
}

if (remoteHead !== expectedHead) {
  console.error(
    `Release branch advanced after dispatch: origin/${branch} is ${remoteHead}, expected ${expectedHead}.`,
  );
  console.error(
    "Stop and rerun the release from the new head so review, CI, and E2E evidence matches the published source.",
  );
  process.exit(1);
}

console.log(`Release head verified: origin/${branch} is ${expectedHead}`);
