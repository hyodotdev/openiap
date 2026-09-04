import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  SBOM_DOC,
  collectSbomDocFailures,
  parseDocumentedComponents,
} from "./audit-sbom-docs.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("the documented component matrix matches the release and SBOM sources", () => {
  assert.deepEqual(collectSbomDocFailures(repoRoot), []);
});

test("matrix rows are read as id and SBOM name pairs", () => {
  const rows = parseDocumentedComponents(
    [
      "| Component | SBOM name | Distribution | Release tag |",
      "| --- | --- | --- | --- |",
      "| `godot` | `godot-iap` | GitHub Release | `godot-iap-<version>` |",
      "| `commerce-protocol` | `openiap-commerce-protocol` | npm | `x` |",
      "not a row",
    ].join("\n"),
  );
  assert.deepEqual(rows, [
    { id: "godot", sbomName: "godot-iap" },
    { id: "commerce-protocol", sbomName: "openiap-commerce-protocol" },
  ]);
});

const withDoc = (markdown, run) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sbom-docs-"));
  try {
    fs.mkdirSync(path.join(root, "security"), { recursive: true });
    fs.writeFileSync(path.join(root, SBOM_DOC), markdown);
    run(collectSbomDocFailures(root));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

test("a component missing from the documentation is reported", () => {
  // The real matrix minus commerce-protocol — the exact drift that shipped.
  const markdown = fs
    .readFileSync(path.join(repoRoot, SBOM_DOC), "utf8")
    .split("\n")
    // Only the component-matrix row; the coverage-floor table names the same
    // component and dropping that too would report a second, different gap.
    .filter(
      (line) =>
        !(
          line.includes("`commerce-protocol`") &&
          line.includes("`openiap-commerce-protocol`")
        ),
    )
    .join("\n");
  withDoc(markdown, (failures) => {
    assert.equal(failures.length, 1);
    assert.match(failures[0], /omits released components: `commerce-protocol`/);
  });
});

test("a component the generator no longer emits is reported as stale", () => {
  // The row has to sit inside the component table; a row after it belongs to
  // whatever section follows and is not a component claim.
  const source = fs.readFileSync(path.join(repoRoot, SBOM_DOC), "utf8");
  const lastRow = "| `commerce-protocol` |";
  const insertAt = source.indexOf("\n", source.indexOf(lastRow));
  const markdown =
    source.slice(0, insertAt) +
    "\n| `retired` | `openiap-retired` | npm | `retired-<version>` |" +
    source.slice(insertAt);
  withDoc(markdown, (failures) => {
    assert.equal(failures.length, 1);
    assert.match(failures[0], /no longer exist: `retired`/);
  });
});

test("a wrong SBOM name is reported", () => {
  const markdown = fs
    .readFileSync(path.join(repoRoot, SBOM_DOC), "utf8")
    .replace("`godot-iap`", "`godot-iap-addon`");
  withDoc(markdown, (failures) => {
    assert.equal(failures.length, 1);
    assert.match(failures[0], /lists `godot` as `godot-iap-addon`/);
  });
});

test("the audit reports a missing document instead of passing", () => {
  const failures = collectSbomDocFailures(
    path.join(repoRoot, "does-not-exist"),
  );
  assert.deepEqual(failures, [`${SBOM_DOC} is missing`]);
});
