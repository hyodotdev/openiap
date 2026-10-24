import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    expect(packedFiles).toContain("dist/purchase-flow-confirmers.js");
    expect(packedFiles).toContain("dist/purchase-flow-confirmers.d.ts");
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
          'import { createIapkitConfirmation, createDeviceConfirmationIOS, toIapkitVerificationProps, readIapkitVerification } from "@hyodotdev/openiap-client-protocol/purchase-flow";',
          "console.log(ErrorCode.Unknown, typeof kitApi, typeof createPurchaseFlow, typeof createIapkitConfirmation, typeof createDeviceConfirmationIOS, typeof toIapkitVerificationProps, typeof readIapkitVerification);",
        ].join(" "),
      ],
      { cwd: consumerRoot, encoding: "utf8" },
    );

    expect(output.trim()).toBe(
      "unknown function function function function function function",
    );
  });

  test("marks every retired helper and type deprecated in the published declarations", () => {
    const declarations = readFileSync(
      join(
        consumerRoot,
        "node_modules/@hyodotdev/openiap-client-protocol/dist/purchase-flow.d.ts",
      ),
      "utf8",
    );
    for (const name of [
      "createIapkitConfirmation",
      "createDeviceConfirmationIOS",
      "toIapkitVerificationProps",
      "readIapkitVerification",
      "IapkitConfirmationOptions",
      "IapkitVerificationProps",
      "IapkitVerificationResult",
    ]) {
      expect(declarations).toMatch(
        new RegExp(
          "/\\*\\* @deprecated [^\\n]+Removed in the next major release\\. \\*/\\nexport (?:declare function|interface) " +
            name,
        ),
      );
    }
  });

  test("resolves every public subpath in standard TypeScript", () => {
    writeFileSync(
      join(consumerRoot, "consumer.ts"),
      [
        'import { ErrorCode } from "@hyodotdev/openiap-client-protocol";',
        'import { kitApi } from "@hyodotdev/openiap-client-protocol/kit-api";',
        'import type { PurchaseConfirmation, PurchaseConfirmer, PurchaseFlowPurchase } from "@hyodotdev/openiap-client-protocol/purchase-flow";',
        'import { createIapkitConfirmation, createDeviceConfirmationIOS, toIapkitVerificationProps, readIapkitVerification, type IapkitConfirmationOptions, type IapkitVerificationProps, type IapkitVerificationResult } from "@hyodotdev/openiap-client-protocol/purchase-flow";',
        "const code: ErrorCode = ErrorCode.Unknown;",
        'const confirmation: PurchaseConfirmation = { status: "linked" };',
        "const confirm: PurchaseConfirmer = async () => confirmation;",
        "const options: IapkitConfirmationOptions = {};",
        "void code;",
        "void kitApi;",
        "void confirm;",
        "const props: IapkitVerificationProps = { provider: 'iapkit', iapkit: {} };",
        "const result: IapkitVerificationResult = {};",
        "const verify = async (_props: IapkitVerificationProps) => result;",
        "const legacy: PurchaseConfirmer[] = [createIapkitConfirmation(verify, options), createDeviceConfirmationIOS<PurchaseFlowPurchase>(async () => [])];",
        "void props; void legacy; void toIapkitVerificationProps; void readIapkitVerification;",
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
      { cwd: consumerRoot, stdio: "inherit" },
    );
  });
});
