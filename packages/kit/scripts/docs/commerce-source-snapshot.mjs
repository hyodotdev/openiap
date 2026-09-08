import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function assertSourceHashes(root, hashes, { allowMissing = [] } = {}) {
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
  const missing = [];
  for (const [name, expected] of Object.entries(hashes)) {
    const path = join(root, name);
    if (allowMissing.includes(name) && !existsSync(path)) {
      missing.push(name);
      continue;
    }
    assert.equal(
      hash(readFileSync(path)),
      expected,
      `Source input changed during execution or since recording: ${name}`,
    );
  }
  return missing;
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
