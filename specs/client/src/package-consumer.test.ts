import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
let consumerRoot = "";
let packedFiles: string[] = [];

beforeAll(() => {
  consumerRoot = mkdtempSync(join(tmpdir(), "openiap-package-consumer-"));
  const pack = JSON.parse(
    execFileSync(
      "npm",
      ["pack", "--json", "--pack-destination", consumerRoot],
      { cwd: packageRoot, encoding: "utf8" },
    ),
  ) as Array<{ filename: string; files: Array<{ path: string }> }>;
  const [{ filename, files }] = pack;
  packedFiles = files.map(({ path }) => path);

  execFileSync(
    "npm",
    [
      "install",
      "--prefix",
      consumerRoot,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      "--no-save",
      join(consumerRoot, filename),
    ],
    { stdio: "pipe" },
  );
  // npm pack runs prepack (a tsc build) before npm install unpacks the tarball;
  // under vitest's default 10 s hook budget that times out when other suites
  // contend for CPU.
}, 120_000);

afterAll(() => {
  if (consumerRoot) rmSync(consumerRoot, { recursive: true, force: true });
  rmSync(join(packageRoot, "dist"), { recursive: true, force: true });
});

describe("published package", () => {
  test("contains compiled JavaScript and declaration artifacts", () => {
    expect(packedFiles).toContain("dist/generated/types.js");
    expect(packedFiles).toContain("dist/generated/types.d.ts");
    expect(packedFiles).toContain("dist/kit-api.js");
    expect(packedFiles).toContain("dist/kit-api.d.ts");
    expect(packedFiles).toContain("dist/purchase-flow.js");
    expect(packedFiles).toContain("dist/purchase-flow.d.ts");
  });

  test("loads every runtime export in standard Node", () => {
    const output = execFileSync(
      "node",
      [
        "--input-type=module",
        "--eval",
        [
          'import { ErrorCode } from "@hyodotdev/openiap-client-protocol";',
          'import { kitApi } from "@hyodotdev/openiap-client-protocol/kit-api";',
          'import { createPurchaseFlow } from "@hyodotdev/openiap-client-protocol/purchase-flow";',
          "console.log(ErrorCode.Unknown, typeof kitApi, typeof createPurchaseFlow);",
        ].join(" "),
      ],
      { cwd: consumerRoot, encoding: "utf8" },
    );

    expect(output.trim()).toBe("unknown function function");
  });

  test("resolves every public subpath in standard TypeScript", () => {
    writeFileSync(
      join(consumerRoot, "consumer.ts"),
      [
        'import { ErrorCode } from "@hyodotdev/openiap-client-protocol";',
        'import { kitApi } from "@hyodotdev/openiap-client-protocol/kit-api";',
        'import type { PurchaseConfirmation } from "@hyodotdev/openiap-client-protocol/purchase-flow";',
        "const code: ErrorCode = ErrorCode.Unknown;",
        'const confirmation: PurchaseConfirmation = { status: "linked" };',
        "void code;",
        "void kitApi;",
        "void confirmation;",
      ].join("\n"),
    );

    execFileSync(
      resolve(packageRoot, "node_modules/.bin/tsc"),
      [
        "--noEmit",
        "--strict",
        "--exactOptionalPropertyTypes",
        "--erasableSyntaxOnly",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        join(consumerRoot, "consumer.ts"),
      ],
      { cwd: consumerRoot, stdio: "pipe" },
    );
  });
});
