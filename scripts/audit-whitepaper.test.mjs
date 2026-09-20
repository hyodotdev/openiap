import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BUILT_FROM,
  PUBLISHED_PDF,
  PUBLISHED_DIAGRAMS,
  publishedDiagrams,
  parseManifest,
  staleEntries,
  unexpectedFiles,
  unrecordedFiles,
} from "./audit-whitepaper.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

test("manifest lines parse into hash and path pairs", () => {
  assert.deepEqual(
    parseManifest(`${HASH_A}  specs/commerce-protocol/DESIGN.md\n`),
    [{ hash: HASH_A, file: "specs/commerce-protocol/DESIGN.md" }],
  );
});

test("a malformed manifest fails loudly instead of passing empty", () => {
  assert.throws(() => parseManifest("not-a-hash  file.md\n"), /unparsable/);
});

test("a manifest missing a required path is reported", () => {
  const entries = [{ hash: HASH_A, file: "scripts/whitepaper.css" }];
  assert.deepEqual(
    unrecordedFiles(entries, ["a.md", "scripts/whitepaper.css"]),
    ["a.md"],
  );
  assert.deepEqual(unrecordedFiles(entries), [
    "specs/commerce-protocol/DESIGN.md",
    "scripts/mermaid.json",
    "scripts/build-whitepaper.sh",
    PUBLISHED_PDF,
    ...PUBLISHED_DIAGRAMS,
  ]);
});

test("named source diagrams require both their rendered image and editable source", () => {
  assert.deepEqual(
    publishedDiagrams(
      "<!-- commerce-diagram: purchase -->\n\n```mermaid\nsequenceDiagram\n```",
    ),
    [
      "packages/docs/public/commerce-diagrams/purchase.svg",
      "packages/docs/public/commerce-diagrams/purchase.mmd",
    ],
  );
  const recordedInputs = [...BUILT_FROM, PUBLISHED_PDF].map((file) => ({
    file,
    hash: HASH_A,
  }));
  assert.deepEqual(unrecordedFiles(recordedInputs), PUBLISHED_DIAGRAMS);
});

test("a manifest naming something the build never reads is reported", () => {
  assert.deepEqual(
    unexpectedFiles([{ hash: HASH_A, file: "notes/scratch.md" }]),
    ["notes/scratch.md"],
  );
});

test("an input that changed since the build is reported", () => {
  const entries = [
    { hash: HASH_A, file: "specs/commerce-protocol/DESIGN.md" },
    { hash: HASH_B, file: "scripts/whitepaper.css" },
  ];
  assert.deepEqual(
    staleEntries(entries, {
      "specs/commerce-protocol/DESIGN.md": HASH_B,
      "scripts/whitepaper.css": HASH_B,
    }),
    [{ hash: HASH_A, file: "specs/commerce-protocol/DESIGN.md" }],
  );
});

test("a deleted file counts as drift rather than passing", () => {
  const entries = [{ hash: HASH_A, file: "scripts/mermaid.json" }];
  assert.deepEqual(staleEntries(entries, {}), entries);
});

test("the audit's file list matches what the builder actually reads", () => {
  // Two hand-kept lists would drift; this pins them to each other.
  const builder = fs.readFileSync(
    path.join(repositoryRoot, "scripts/build-whitepaper.sh"),
    "utf8",
  );
  const block = /\ninputs = \[\n([\s\S]*?)\n\]\n/.exec(builder);
  assert.ok(block, "builder no longer declares an `inputs` list");
  const declared = [...block[1].matchAll(/\("([^"]+)",/g)].map((m) => m[1]);
  assert.deepEqual(declared, BUILT_FROM);

  const output = /\nrel_out="([^"]+)"\n/.exec(builder);
  assert.ok(output, "builder no longer declares `rel_out`");
  assert.equal(output[1], PUBLISHED_PDF);
});
