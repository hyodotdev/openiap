import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { inventories } from "../packages/kit/scripts/docs/commerce-source-snapshot.mjs";
import {
  auditCommerceEvidence,
  shortRevision,
} from "./audit-commerce-evidence.mjs";

const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

function write(root, name, text) {
  const file = path.join(root, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "commerce-evidence-"));
  const kit = path.join(root, "packages/kit");
  for (const name of [
    "server/api/commerce/handlers.ts",
    "convex/purchases/action.ts",
    "src/convex.ts",
    "convex.json",
    "tsconfig.json",
    "package.json",
  ])
    write(kit, name, `// ${name}\n`);
  const harness = path.join(kit, "scripts/docs");
  for (const name of [
    "run-commerce-interop.mjs",
    "export-commerce-interop.mjs",
    "commerce-interop-fixture.ts",
    "commerce-source-snapshot.mjs",
    "commerce-store-coverage.mjs",
    "commerce-source-snapshot.test.mjs",
  ])
    write(harness, name, `// ${name}\n`);
  for (const name of [
    "bun.lock",
    "package.json",
    "packages/mcp-server/package.json",
    "packages/mcp-server/src/kit-client.ts",
    "specs/commerce-protocol/package.json",
    "specs/commerce-protocol/src/index.mjs",
  ])
    write(root, name, `# ${name}\n`);
  const hashes = (dir, names) =>
    Object.fromEntries(names.map((name) => [name, hash(path.join(dir, name))]));
  const report = {
    recordedAt: "2026-09-09T00:00:00.000Z",
    command: "bun run-commerce-interop.mjs",
    harnessHashes: hashes(harness, inventories.harness(harness)),
    sources: {
      openiap: {
        baseRevision: "abcdef1234567890",
        hashes: {
          ...hashes(kit, inventories.openiap(kit)),
          "convex/_generated/api.d.ts": "0".repeat(64),
        },
        optionalGeneratedFiles: ["convex/_generated/api.d.ts"],
      },
      workspace: {
        baseRevision: "abcdef1234567890",
        hashes: hashes(root, inventories.workspace(root)),
      },
    },
  };
  write(
    root,
    "packages/docs/public/commerce-composition/iapkit-run.json",
    JSON.stringify(report),
  );
  return { root, kit };
}

describe("audit-commerce-evidence", () => {
  test("reports no drift when every recorded input matches", () => {
    const { root } = fixture();
    try {
      expect(auditCommerceEvidence(root)).toMatchObject({
        baseRevision: "abcdef1234567890",
        drift: [],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("lists changed, added and missing inputs by group", () => {
    const { root, kit } = fixture();
    try {
      writeFileSync(
        path.join(kit, "convex/purchases/action.ts"),
        "// edited\n",
      );
      write(kit, "server/new.ts", "// new\n");
      rmSync(path.join(root, "packages/mcp-server/src/kit-client.ts"));
      expect(auditCommerceEvidence(root).drift).toEqual([
        "openiap/convex/purchases/action.ts changed",
        "openiap/server/new.ts added",
        "workspace/packages/mcp-server/src/kit-client.ts missing",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("recorded input inventory", () => {
  test("the harness inventory covers every module but no test file", () => {
    const { root, kit } = fixture();
    try {
      const names = inventories.harness(path.join(kit, "scripts/docs")).sort();
      expect(names).toEqual([
        "commerce-interop-fixture.ts",
        "commerce-source-snapshot.mjs",
        "commerce-store-coverage.mjs",
        "export-commerce-interop.mjs",
        "run-commerce-interop.mjs",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a report without recorded fingerprints is rejected, not audited", () => {
    const { root } = fixture();
    try {
      write(
        root,
        "packages/docs/public/commerce-composition/iapkit-run.json",
        JSON.stringify({ checks: [] }),
      );
      expect(() => auditCommerceEvidence(root)).toThrow(
        "is not a recorded interop report",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("shortRevision", () => {
  test("keeps the runner's dirty marker", () => {
    expect(shortRevision("abcdef1234567890")).toBe("abcdef12");
    expect(shortRevision("abcdef1234567890-dirty")).toBe("abcdef12-dirty");
  });
});
