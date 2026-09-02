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
      "--no-package-lock",
      "--no-save",
      join(consumerRoot, filename),
    ],
    { stdio: "pipe" },
  );
});

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
  });

  test("loads both runtime exports in standard Node", () => {
    const output = execFileSync(
      "node",
      [
        "--input-type=module",
        "--eval",
        [
          'import { ErrorCode } from "@hyodotdev/openiap";',
          'import { kitApi } from "@hyodotdev/openiap/kit-api";',
          "console.log(ErrorCode.Unknown, typeof kitApi);",
        ].join(" "),
      ],
      { cwd: consumerRoot, encoding: "utf8" },
    );

    expect(output.trim()).toBe("unknown function");
  });

  test("resolves both public subpaths in standard TypeScript", () => {
    writeFileSync(
      join(consumerRoot, "consumer.ts"),
      [
        'import { ErrorCode } from "@hyodotdev/openiap";',
        'import { kitApi } from "@hyodotdev/openiap/kit-api";',
        "const code: ErrorCode = ErrorCode.Unknown;",
        "void code;",
        "void kitApi;",
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
