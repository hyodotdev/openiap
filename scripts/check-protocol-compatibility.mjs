import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compareSemVer, openiapNpmPackages } from "./release-branch-policy.mjs";

const [protocol, ...extra] = process.argv.slice(2);
if (
  !["client-protocol", "commerce-protocol"].includes(protocol) ||
  extra.length
) {
  throw new Error(
    "Usage: node scripts/check-protocol-compatibility.mjs <client-protocol|commerce-protocol>",
  );
}
const root = fileURLToPath(new URL("../", import.meta.url));
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" });
const { tagPrefix, path } = openiapNpmPackages[protocol];
const prefix = `refs/tags/${tagPrefix}-`;
const minimum = JSON.parse(
  readFileSync(
    new URL(
      `../${path.replace(/package\.json$/, "compatibility.json")}`,
      import.meta.url,
    ),
    "utf8",
  ),
).minimumStableRelease;
if (typeof minimum !== "string" || !/^\d+\.\d+\.\d+$/.test(minimum)) {
  throw new Error(`Invalid minimum stable release for ${protocol}`);
}
const refs = git("ls-remote", "--tags", "--refs", "origin", `${prefix}*`)
  .trim()
  .split("\n")
  .map((line) => line.split("\t")[1])
  .filter((ref) => ref?.startsWith(prefix))
  .filter((ref) => {
    const version = ref.slice(prefix.length);
    return (
      /^\d+\.\d+\.\d+$/.test(version) && compareSemVer(version, minimum) >= 0
    );
  })
  .sort((left, right) =>
    compareSemVer(left.slice(prefix.length), right.slice(prefix.length)),
  );
if (!refs.includes(`${prefix}${minimum}`)) {
  throw new Error(`Missing supported release tag ${tagPrefix}-${minimum}`);
}

const depth =
  git("rev-parse", "--is-shallow-repository").trim() === "true"
    ? ["--depth=1"]
    : [];
git(
  "fetch",
  "--no-tags",
  ...depth,
  "origin",
  ...refs.map((ref) => `${ref}:${ref}`),
);
const audit =
  protocol === "client-protocol"
    ? "specs/client/scripts/audit-schema-semver.mjs"
    : "specs/commerce-protocol/scripts/audit-compatibility.mjs";
for (const ref of refs) {
  console.log(`Checking ${ref.slice("refs/tags/".length)}`);
  execFileSync(process.execPath, [audit, "--base", ref], {
    cwd: root,
    stdio: "inherit",
  });
}
