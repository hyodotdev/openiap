/**
 * This script runs `npx @convex-dev/auth` to help with setting up
 * environment variables for Convex Auth.
 *
 * You can safely delete it and remove it from package.json scripts.
 */

import fs from "fs";
import { config as loadEnvFile } from "dotenv";
import { spawnSync } from "child_process";

if (!fs.existsSync(".env.local")) {
  // Something is off, skip the script.
  process.exit(0);
}

const config = {};
loadEnvFile({ path: ".env.local", processEnv: config });

const runOnceWorkflow = process.argv.includes("--once");

if (runOnceWorkflow && config.SETUP_SCRIPT_RAN !== undefined) {
  // The script has already ran once, skip.
  process.exit(0);
}

const result = spawnSync("npx", ["@convex-dev/auth", "--skip-git-check"], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

// `spawnSync` returns `status === null` when the child didn't exit normally
// (e.g. was killed by a signal). `process.exit(null)` is treated as 0, which
// would silently mark the setup as successful — fail explicitly instead.
if (result.status === null) {
  console.error(
    "Failed to determine exit status for `npx @convex-dev/auth` (killed by signal?)",
  );
  process.exit(1);
}

if (runOnceWorkflow) {
  fs.writeFileSync(
    ".env.local",
    `
SETUP_SCRIPT_RAN=1
`,
    { flag: "a" },
  );
}

process.exit(result.status);
