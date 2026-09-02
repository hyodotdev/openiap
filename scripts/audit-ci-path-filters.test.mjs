import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  auditCiPathFilters,
  cases,
  findPolicyViolations,
  matchesFilter,
  selectJobs,
} from "./audit-ci-path-filters.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function withPatchedWorkflows(patch, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openiap-ci-paths-"));

  try {
    fs.cpSync(
      path.join(repositoryRoot, ".github/workflows"),
      path.join(root, ".github/workflows"),
      { recursive: true },
    );
    patch(path.join(root, ".github/workflows"));
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

for (const { name, files, jobs } of cases) {
  test(`selects the expected jobs for ${name}`, () => {
    assert.deepEqual(selectJobs(files), [...jobs].sort());
  });
}

test("workflow path filters satisfy the audited policy", () => {
  assert.deepEqual(auditCiPathFilters(), []);
});

test("rejects dropping the client contract from MCP verification", () => {
  withPatchedWorkflows(
    (workflows) => {
      const file = path.join(workflows, "deploy-kit.yml");
      fs.writeFileSync(
        file,
        fs
          .readFileSync(file, "utf8")
          .replace('      - "specs/openiap/client/src/kit-api.ts"\n', ""),
      );
    },
    (root) => {
      assert.ok(
        findPolicyViolations(root).includes(
          "deploy-kit.yml: pull_request.paths must include 'specs/openiap/client/src/kit-api.ts' — MCP compiles against this client contract",
        ),
      );
    },
  );
});

test("rejects dropping the Commerce Protocol from kit verification or deployment", () => {
  withPatchedWorkflows(
    (workflows) => {
      const file = path.join(workflows, "deploy-kit.yml");
      fs.writeFileSync(
        file,
        fs
          .readFileSync(file, "utf8")
          .replaceAll('      - "specs/openiap/commerce-protocol/**"\n', ""),
      );
    },
    (root) => {
      assert.deepEqual(
        findPolicyViolations(root).filter((finding) =>
          finding.includes("kit binary embeds this runtime contract"),
        ),
        [
          "deploy-kit.yml: pull_request.paths must include 'specs/openiap/commerce-protocol/**' — the kit binary embeds this runtime contract",
          "deploy-kit.yml: push.paths must include 'specs/openiap/commerce-protocol/**' — the kit binary embeds this runtime contract",
        ],
      );
    },
  );
});

test("rejects moving the kit Docker build context below the monorepo root", () => {
  withPatchedWorkflows(
    (workflows) => {
      const file = path.join(workflows, "deploy-kit.yml");
      const source = fs.readFileSync(file, "utf8");
      const marker = "        working-directory: ${{ github.workspace }}\n";
      const markerIndex = source.lastIndexOf(marker);
      assert.notEqual(markerIndex, -1);
      fs.writeFileSync(
        file,
        source.slice(0, markerIndex) + source.slice(markerIndex + marker.length),
      );
    },
    (root) => {
      assert.ok(
        findPolicyViolations(root).includes(
          "deploy-kit.yml: Deploy must run from github.workspace so the monorepo Docker context contains root manifests and nested specifications",
        ),
      );
    },
  );
});

test("markdown exclusion is final and cannot be re-included", () => {
  const patterns = ["packages/apple/**", "!**/*.md"];

  assert.equal(matchesFilter(patterns, ["packages/apple/README.md"]), false);
  assert.equal(
    matchesFilter(patterns, ["packages/apple/Sources/A.swift"]),
    true,
  );
  // Order must not change the answer; that is what makes one list safe in both
  // dorny (polarity) and GitHub native paths (last match wins).
  assert.equal(
    matchesFilter(
      ["!**/*.md", "packages/apple/**"],
      ["packages/apple/README.md"],
    ),
    false,
  );
});

test("rejects negation without the some-with-excludes quantifier", () => {
  withPatchedWorkflows(
    (workflows) => {
      const file = path.join(workflows, "codeql.yml");
      fs.writeFileSync(
        file,
        fs
          .readFileSync(file, "utf8")
          .replaceAll(
            "          predicate-quantifier: some-with-excludes\n",
            "",
          ),
      );
    },
    (root) => {
      assert.deepEqual(
        findPolicyViolations(root).filter((finding) =>
          finding.includes("predicate-quantifier"),
        ),
        [
          "codeql.yml:codeql-scope/core: negated patterns require predicate-quantifier: some-with-excludes",
          "codeql.yml:codeql-scope/wrappers: negated patterns require predicate-quantifier: some-with-excludes",
        ],
      );
    },
  );
});

test("rejects negation forms outside the audited vocabulary", () => {
  withPatchedWorkflows(
    (workflows) => {
      const file = path.join(workflows, "codeql.yml");
      fs.writeFileSync(
        file,
        fs
          .readFileSync(file, "utf8")
          .replace(
            "              - 'libraries/expo-iap/**'\n              - 'libraries-versions.jsonc'",
            "              - 'libraries/expo-iap/**'\n              - '!libraries/expo-iap/docs/**'\n              - 'libraries-versions.jsonc'",
          ),
      );
    },
    (root) => {
      assert.ok(
        findPolicyViolations(root).some((finding) =>
          finding.includes(
            "unsupported negation '!libraries/expo-iap/docs/**'",
          ),
        ),
      );
    },
  );
});

test("rejects a workflow-level paths filter on ci.yml or codeql.yml", () => {
  withPatchedWorkflows(
    (workflows) => {
      const file = path.join(workflows, "ci.yml");
      fs.writeFileSync(
        file,
        fs
          .readFileSync(file, "utf8")
          .replace(
            "on:\n  pull_request:\n    branches:\n      - main\n      - next\n",
            "on:\n  pull_request:\n    branches:\n      - main\n      - next\n    paths:\n      - 'packages/**'\n",
          ),
      );
    },
    (root) => {
      assert.ok(
        findPolicyViolations(root).some(
          (finding) =>
            finding ===
            "ci.yml: pull_request must stay unfiltered; job-level gating keeps skipped checks reportable",
        ),
      );
    },
  );
});

test("rejects rewiring a gated job onto the wrong filter", () => {
  withPatchedWorkflows(
    (workflows) => {
      const file = path.join(workflows, "ci.yml");
      fs.writeFileSync(
        file,
        fs
          .readFileSync(file, "utf8")
          .replace(
            "    if: needs.changes.outputs.ios == 'true'",
            "    if: needs.changes.outputs.docs == 'true'",
          ),
      );
    },
    (root) => {
      assert.ok(
        findPolicyViolations(root).includes(
          "ci.yml: job test-ios must gate on needs.changes.outputs.ios",
        ),
      );
    },
  );
});

test("rejects deleting a filter that a job still gates on", () => {
  withPatchedWorkflows(
    (workflows) => {
      const file = path.join(workflows, "ci.yml");
      const source = fs.readFileSync(file, "utf8");
      const mutated = source.replace(
        /\n            docs:\n[\s\S]*?(?=\n            web:)/u,
        "",
      );
      assert.notEqual(mutated, source, "docs filter fixture did not match");
      fs.writeFileSync(file, mutated);
    },
    (root) => {
      assert.ok(
        findPolicyViolations(root).includes(
          "ci.yml: filter 'docs' was removed but job test-docs still gates on it",
        ),
      );
    },
  );
});

test("rejects gating a job that guards the markdown corpus", () => {
  withPatchedWorkflows(
    (workflows) => {
      const file = path.join(workflows, "ci.yml");
      fs.writeFileSync(
        file,
        fs
          .readFileSync(file, "utf8")
          .replace(
            "  audit-parity:\n    name: Audit SDK Parity\n",
            "  audit-parity:\n    name: Audit SDK Parity\n    needs: changes\n",
          ),
      );
    },
    (root) => {
      assert.ok(
        findPolicyViolations(root).includes(
          "ci.yml: job audit-parity must stay unconditional",
        ),
      );
    },
  );
});
