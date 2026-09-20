import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { signPayload } from "../../convex/commerce/signing";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const assets = join(root, "packages/docs/public/commerce-example");
const report = JSON.parse(readFileSync(join(assets, "run.json"), "utf8"));
const source = report.milestones.at(-1).build.source as string;
assert(/^06-[\w-]+\/source\.tar\.gz$/.test(source));
const archive = join(assets, source);
const temp = mkdtempSync(join(tmpdir(), "commerce-compare-"));
const run = (command: string, args: string[], cwd: string) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
};
try {
  run("tar", ["-xzf", archive, "-C", temp], root);
  run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], temp);
  const { verifyLab } = await import(
    pathToFileURL(join(temp, "verify.mjs")).href
  );
  const checks: string[] = await verifyLab({ compareSigner: signPayload });
  const baselinePath = join(temp, "iapkit.json");
  run(
    "bunx",
    [
      "vitest",
      "run",
      "server/api/commerce/conformance.test.ts",
      "convex/commerce/",
      "--reporter=json",
      `--outputFile=${baselinePath}`,
    ],
    join(root, "packages/kit"),
  );
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  assert.equal(baseline.success, true);
  writeFileSync(
    join(root, "packages/docs/public/commerce-lab/run.json"),
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        source: `/commerce-example/${source}`,
        archiveSha256: createHash("sha256")
          .update(readFileSync(archive))
          .digest("hex"),
        scope:
          "The reviewed standalone source archive, installed outside the monorepo with npm. Local fixture HTTP and SQLite; signatures compared with the actual IAPKit signer. No sandbox purchase or production service contacted.",
        checks,
        iapkit: {
          passed: baseline.numPassedTests,
          failed: baseline.numFailedTests,
          scope:
            "Actual IAPKit REST/GraphQL routes and commerce helpers; Convex/store I/O mocked.",
          files: baseline.testResults.map(
            (result: {
              name: string;
              assertionResults: { status: string }[];
            }) => ({
              path: relative(root, result.name),
              passed: result.assertionResults.filter(
                (entry) => entry.status === "passed",
              ).length,
            }),
          ),
        },
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `${checks.length} example checks including signer comparison; ${baseline.numPassedTests} IAPKit tests.`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
