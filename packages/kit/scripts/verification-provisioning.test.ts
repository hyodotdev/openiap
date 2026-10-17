import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const secret = "a".repeat(64);
const kit = join(import.meta.dirname, "..");
const canonicalUrl = execFileSync(
  "bash",
  ["-c", 'source production.env; printf "%s" "$IAPKIT_PRODUCTION_CONVEX_URL"'],
  { cwd: kit, encoding: "utf8" },
);

function provision(overrides: Record<string, string | undefined> = {}) {
  const directory = mkdtempSync(join(tmpdir(), "verification-provision-"));
  try {
    const record = join(directory, "record");
    for (const command of ["bunx", "flyctl"]) {
      writeFileSync(
        join(directory, command),
        `#!/usr/bin/env bash
payload="$(cat)"
printf '%s|%s|%s\\n' "$(basename "$0")" "$*" "$payload" >> "$RECORD"
if [ "$(basename "$0")" = "$FAIL_COMMAND" ]; then
  echo "provider error $payload" >&2
  exit 1
fi
`,
        { mode: 0o755 },
      );
    }
    const result = spawnSync(
      "bash",
      ["scripts/provision-verification-source.sh"],
      {
        cwd: kit,
        encoding: "utf8",
        env: {
          PATH: `${directory}:${process.env.PATH ?? "/usr/bin:/bin"}`,
          RECORD: record,
          APP_ENV: "test",
          CONVEX_URL: "http://127.0.0.1:1",
          CONVEX_DEPLOY_KEY: "synthetic-deployment-key",
          FLY_API_TOKEN: "synthetic-fly-token",
          IAPKIT_VERIFICATION_SOURCE_SECRET: secret,
          VITE_KIT_CONVEX_URL: canonicalUrl,
          ...overrides,
        },
      },
    );
    const calls = (() => {
      try {
        return readFileSync(record, "utf8").trim().split("\n");
      } catch {
        return [];
      }
    })();
    return { ...result, calls };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("verification source provisioning", () => {
  it.each([
    { CONVEX_DEPLOY_KEY: "" },
    { FLY_API_TOKEN: "" },
    { IAPKIT_VERIFICATION_SOURCE_SECRET: "" },
    { IAPKIT_VERIFICATION_SOURCE_SECRET: "not-valid" },
    { VITE_KIT_CONVEX_URL: "https://invalid-dev.convex.cloud" },
  ])(
    "refuses invalid credentials or a noncanonical target before any write %#",
    (environment) => {
      const result = provision(environment);
      expect(result.status).toBe(1);
      expect(result.calls).toEqual([]);
      expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
    },
  );

  it("pipes one stable credential to Convex and staged Fly runtime settings without argv or output exposure", () => {
    const result = provision();
    expect(result.status).toBe(0);
    expect(result.calls).toEqual([
      `bunx|convex env set --prod IAPKIT_VERIFICATION_SOURCE_SECRET|${secret}`,
      `flyctl|secrets import --stage --app openiap-kit|IAPKIT_VERIFICATION_SOURCE_SECRET=${secret}`,
    ]);
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
  });

  it.each(["bunx", "flyctl"])(
    "stops on %s failure without leaking provider output",
    (command) => {
      const result = provision({ FAIL_COMMAND: command });
      expect(result.status).toBe(1);
      expect(result.calls).toHaveLength(command === "bunx" ? 1 : 2);
      expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
    },
  );
});
