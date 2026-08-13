import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  auditWorkflowFiles,
  extractExternalUrls,
  findWorkflowRunInterpolations,
} from "./audit-security.mjs";

test("workflow scan detects expressions in scalar and block run steps", () => {
  const workflow = `steps:
  - run: echo "${"${{"} inputs.scalar }}"
  - name: Block
    run: |
      echo "safe"
      echo "${"${{"} github.event.issue.title }}"
  - uses: actions/checkout@v7
`;
  assert.deepEqual(findWorkflowRunInterpolations(workflow, "fixture.yml"), [
    'fixture.yml:2: - run: echo "${{ inputs.scalar }}"',
    'fixture.yml:6: echo "${{ github.event.issue.title }}"',
  ]);
});

test("workflow scan recognizes YAML block-scalar header variants", () => {
  for (const header of ["|2", ">-2", "|2-", ">+2", "| # note", "|2 # note"]) {
    const workflow = `steps:\n  - run: ${header}\n      echo "${"${{"} inputs.value }}"\n`;
    assert.deepEqual(findWorkflowRunInterpolations(workflow, "fixture.yml"), [
      'fixture.yml:3: echo "${{ inputs.value }}"',
    ]);
  }
});

test("URL extraction removes JSX and Markdown delimiters", () => {
  const source =
    `href='https://example.com/path' [docs](https://example.org/a). ` +
    `https://example.net/releases/<version>`;
  assert.deepEqual(extractExternalUrls(source), [
    "https://example.com/path",
    "https://example.org/a",
  ]);
});

test("empty workflow scans fail instead of reporting a vacuous pass", async (t) => {
  const scratch = mkdtempSync(resolve(tmpdir(), "openiap-security-audit-"));
  const workflow = resolve(scratch, "empty.yml");
  writeFileSync(workflow, "steps:\n  - run: echo safe\n");
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  assert.deepEqual(
    findWorkflowRunInterpolations("steps:\n  - run: echo safe\n"),
    [],
  );
  await assert.rejects(
    () => auditWorkflowFiles([workflow]),
    /refusing to report a vacuous pass/u,
  );
});

test("empty URL extraction is explicit", () => {
  assert.deepEqual(extractExternalUrls("no links"), []);
});
