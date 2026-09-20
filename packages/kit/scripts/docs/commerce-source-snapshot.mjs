import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

// The recorded input set, shared by the runner and the freshness audit so the
// two can never disagree about which files the evidence covers.
export const inventories = {
  openiap: (kit) => [
    ...new Bun.Glob("{server,convex}/**/*.{ts,js,json}").scanSync({ cwd: kit }),
    "src/convex.ts",
    "convex.json",
    "tsconfig.json",
    "package.json",
  ],
  workspace: (repo) => [
    "bun.lock",
    "package.json",
    "packages/mcp-server/package.json",
    "packages/mcp-server/src/kit-client.ts",
    "specs/commerce-protocol/package.json",
    ...new Bun.Glob(
      "specs/commerce-protocol/{src,generated,examples}/**/*.{mjs,js,json}",
    ).scanSync({ cwd: repo }),
  ],
  harness: (dir) =>
    [...new Bun.Glob("*.{mjs,ts}").scanSync({ cwd: dir })].filter(
      (name) => !name.includes(".test."),
    ),
};

export function diffSourceHashes(
  root,
  hashes,
  { allowMissing = [], inventory = [] } = {},
) {
  assert(
    hashes && Object.keys(hashes).length > 0,
    `Missing source fingerprints: ${root}`,
  );
  assert(
    allowMissing.every(
      (name) => /(^|\/)_?generated\//.test(name) && Object.hasOwn(hashes, name),
    ),
    "Only recorded generated inputs may be absent",
  );
  const changed = [],
    missing = [],
    skipped = [];
  for (const [name, expected] of Object.entries(hashes)) {
    const path = join(root, name);
    if (!existsSync(path)) {
      (allowMissing.includes(name) ? skipped : missing).push(name);
      continue;
    }
    if (hash(readFileSync(path)) !== expected) changed.push(name);
  }
  const added = [...new Set(inventory)]
    .filter((name) => !Object.hasOwn(hashes, name))
    .sort();
  return { changed, missing, skipped, added };
}

// Throws on the first drifted input and returns the recorded generated inputs
// this checkout may legitimately lack.
export function assertSourceHashes(root, hashes, options = {}) {
  const { changed, missing, skipped } = diffSourceHashes(root, hashes, options);
  const drifted = changed[0] ?? missing[0];
  assert(
    drifted === undefined,
    `Source input changed during execution or since recording: ${drifted}`,
  );
  return skipped;
}

export function pinSources(root, files) {
  const names = () => [...new Set(files())].sort();
  const contents = new Map(
    names().map((name) => [name, readFileSync(join(root, name))]),
  );
  const hashes = Object.freeze(
    Object.fromEntries(
      [...contents].map(([name, bytes]) => [name, hash(bytes)]),
    ),
  );
  return {
    hashes,
    write(name, target) {
      assert(contents.has(name), `Source was not pinned: ${name}`);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents.get(name));
    },
    assertUnchanged() {
      assert.deepEqual(
        names(),
        Object.keys(hashes),
        `Source input inventory changed during execution: ${root}`,
      );
      assertSourceHashes(root, hashes);
    },
  };
}
