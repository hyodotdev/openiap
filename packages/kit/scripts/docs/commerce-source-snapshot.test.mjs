import { expect, test } from "vitest";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { assertSourceHashes, pinSources } from "./commerce-source-snapshot.mjs";

test("unchanged execution and copied source retain the initial fingerprints", async () => {
  const directory = mkdtempSync(join(tmpdir(), "commerce-source-test-"));
  try {
    writeFileSync(
      join(directory, "provider.mjs"),
      "export default () => 42;\n",
    );
    const pinned = pinSources(directory, () => ["provider.mjs"]);
    const copied = join(directory, "deployment/provider.mjs");
    pinned.write("provider.mjs", copied);
    const { default: execute } = await import(pathToFileURL(copied).href);
    expect(execute()).toBe(42);
    expect(() => pinned.assertUnchanged()).not.toThrow();
    expect(pinned.hashes["provider.mjs"]).toBe(
      createHash("sha256").update(readFileSync(copied)).digest("hex"),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test.each(["provider.mjs", "harness.mjs"])(
  "%s changing after execution cannot certify a report for its new bytes",
  async (name) => {
    const directory = mkdtempSync(join(tmpdir(), "commerce-source-test-"));
    try {
      const source = join(directory, name);
      writeFileSync(source, "export default () => 42;\n");
      const pinned = pinSources(directory, () => [name]);
      const { default: execute } = await import(pathToFileURL(source).href);
      expect(execute()).toBe(42);
      writeFileSync(source, "export default () => 0;\n");
      const copied = join(directory, "deployment", name);
      pinned.write(name, copied);
      expect(readFileSync(copied, "utf8")).toBe("export default () => 42;\n");
      expect(() => pinned.assertUnchanged()).toThrow(
        `Source input changed during execution or since recording: ${name}`,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test.each([
  "convex/purchases/unexported-handler.ts",
  "specs/commerce-protocol/generated/schema.json",
])("export and build guards reject changed recorded input %s", (name) => {
  const directory = mkdtempSync(join(tmpdir(), "commerce-source-test-"));
  try {
    const source = join(directory, name);
    mkdirSync(dirname(source), { recursive: true });
    writeFileSync(source, "original source\n");
    const report = pinSources(directory, () => [name]).hashes;
    expect(() => assertSourceHashes(directory, report)).not.toThrow();
    writeFileSync(source, "changed source\n");
    expect(() => assertSourceHashes(directory, report)).toThrow(name);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CI may omit recorded optional generated inputs but cannot change or omit required source", () => {
  const directory = mkdtempSync(join(tmpdir(), "commerce-source-test-"));
  try {
    const generated = "_generated/optional.js";
    mkdirSync(join(directory, "_generated"));
    writeFileSync(join(directory, generated), "generated source\n");
    writeFileSync(join(directory, "provider.mjs"), "provider source\n");
    const report = pinSources(directory, () => [
      generated,
      "provider.mjs",
    ]).hashes;
    rmSync(join(directory, generated));
    expect(() => assertSourceHashes(directory, report)).toThrow();
    expect(
      assertSourceHashes(directory, report, { allowMissing: [generated] }),
    ).toEqual([generated]);
    writeFileSync(join(directory, generated), "changed generated source\n");
    expect(() =>
      assertSourceHashes(directory, report, { allowMissing: [generated] }),
    ).toThrow(generated);
    rmSync(join(directory, generated));
    rmSync(join(directory, "provider.mjs"));
    expect(() =>
      assertSourceHashes(directory, report, { allowMissing: [generated] }),
    ).toThrow();
    expect(() =>
      assertSourceHashes(directory, report, { allowMissing: ["provider.mjs"] }),
    ).toThrow("Only recorded generated inputs may be absent");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("missing recorded fingerprints cannot silently skip a source group", () => {
  expect(() => assertSourceHashes("unused", undefined)).toThrow(
    "Missing source fingerprints",
  );
  expect(() => assertSourceHashes("unused", {})).toThrow(
    "Missing source fingerprints",
  );
});

test.each(["addition", "removal"])(
  "a source file %s invalidates the pinned input inventory",
  (change) => {
    const directory = mkdtempSync(join(tmpdir(), "commerce-source-test-"));
    try {
      writeFileSync(join(directory, "provider.mjs"), "export default 42;\n");
      const pinned = pinSources(directory, () => readdirSync(directory));
      if (change === "addition")
        writeFileSync(
          join(directory, "new-handler.mjs"),
          "export default 0;\n",
        );
      else rmSync(join(directory, "provider.mjs"));
      expect(() => pinned.assertUnchanged()).toThrow(
        "Source input inventory changed during execution",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
