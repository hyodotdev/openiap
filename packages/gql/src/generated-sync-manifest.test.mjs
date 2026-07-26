import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GENERATED_DRIFT_PATHS,
  GENERATED_SYNC_EDGES,
  GENERATED_SYNC_MANIFEST,
  GQL_GENERATED_SOURCE_DIRECTORY,
  GQL_GENERATION_INPUT_PATHS,
  generatedSourceFileName,
  gqlPackageRelativePath,
  isGqlGenerationInputPath,
} from "../generated-sync-manifest.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const readRepositoryFile = (path) =>
  readFileSync(resolve(repositoryRoot, path), "utf8");

describe("generated sync manifest", () => {
  it("owns every source and target path exactly once", () => {
    const sourcePaths = Object.values(GENERATED_SYNC_MANIFEST).map(
      (definition) => definition.source,
    );
    const targetPaths = GENERATED_SYNC_EDGES.map((edge) => edge.path);

    expect(new Set(sourcePaths).size).toBe(sourcePaths.length);
    expect(new Set(targetPaths).size).toBe(targetPaths.length);
    expect(
      targetPaths.some((targetPath) => sourcePaths.includes(targetPath)),
    ).toBe(false);
  });

  it("points only to existing canonical files and synchronized copies", () => {
    for (const definition of Object.values(GENERATED_SYNC_MANIFEST)) {
      expect(
        existsSync(resolve(repositoryRoot, definition.source)),
        definition.source,
      ).toBe(true);
      for (const definitionTarget of Object.values(definition.targets)) {
        expect(
          existsSync(resolve(repositoryRoot, definitionTarget.path)),
          definitionTarget.path,
        ).toBe(true);
      }
    }
  });

  it("owns the exact generated source directory inventory", () => {
    const expectedFileNames = Object.entries(GENERATED_SYNC_MANIFEST)
      .filter(([, definition]) => definition.generated)
      .map(([groupName]) => generatedSourceFileName(groupName))
      .sort();
    const entries = readdirSync(
      resolve(repositoryRoot, GQL_GENERATED_SOURCE_DIRECTORY),
      {
        withFileTypes: true,
      },
    );

    expect(entries.every((entry) => entry.isFile())).toBe(true);
    expect(entries.map((entry) => entry.name).sort()).toEqual(
      expectedFileNames,
    );
    expect(gqlPackageRelativePath(GQL_GENERATED_SOURCE_DIRECTORY)).toBe(
      "src/generated",
    );
    expect(() => generatedSourceFileName("missingGroup")).toThrow(
      "Expected a generated manifest group",
    );
  });

  it("covers every generated source and all synchronized targets in drift checks", () => {
    const expected = new Set([
      ...Object.values(GENERATED_SYNC_MANIFEST)
        .filter((definition) => definition.generated)
        .map((definition) => definition.source),
      ...GENERATED_SYNC_EDGES.map((edge) => edge.path),
    ]);

    expect(new Set(GENERATED_DRIFT_PATHS)).toEqual(expected);
  });

  it("distinguishes canonical generator inputs from generated outputs", () => {
    expect(isGqlGenerationInputPath("packages/gql/src/schema.graphql")).toBe(
      true,
    );
    expect(
      isGqlGenerationInputPath("packages/gql/codegen/core/transformer.ts"),
    ).toBe(true);
    expect(isGqlGenerationInputPath("packages/gql/src/kit-api.ts")).toBe(true);
    expect(isGqlGenerationInputPath("package.json")).toBe(true);
    expect(isGqlGenerationInputPath("bun.lock")).toBe(true);
    expect(
      isGqlGenerationInputPath("packages/gql/src/generated/types.ts"),
    ).toBe(false);
    expect(
      isGqlGenerationInputPath("libraries/react-native-iap/src/types.ts"),
    ).toBe(false);
  });

  it("keeps generated-source drift ownership on each manifest group", () => {
    for (const definition of Object.values(GENERATED_SYNC_MANIFEST)) {
      expect(typeof definition.generated, definition.source).toBe("boolean");
      expect(
        GENERATED_DRIFT_PATHS.includes(definition.source),
        definition.source,
      ).toBe(definition.generated);
    }
  });

  it("owns the public GQL export paths", () => {
    const packageJson = JSON.parse(
      readRepositoryFile("packages/gql/package.json"),
    );
    const definitions = Object.values(GENERATED_SYNC_MANIFEST);
    expect(new Set(definitions.map(({ exportKey }) => exportKey)).size).toBe(
      definitions.length,
    );
    expect(new Set(Object.keys(packageJson.exports))).toEqual(
      new Set(definitions.map(({ exportKey }) => exportKey)),
    );
    expect(`./${packageJson.main.replace(/^\.\//, "")}`).toBe(
      packageJson.exports["."],
    );

    for (const definition of definitions) {
      const packageRelativeSource = definition.source.replace(
        /^packages\/gql\//,
        "./",
      );
      expect(
        packageJson.exports[definition.exportKey],
        definition.exportKey,
      ).toBe(packageRelativeSource);
    }
  });

  it("keeps executable sync consumers on the manifest", () => {
    for (const path of [
      "packages/gql/scripts/sync-to-platforms.mjs",
      "packages/gql/scripts/assert-generated-staged.mjs",
      "packages/gql/scripts/verify-generated-sync.mjs",
      "packages/gql/codegen.ts",
      "packages/gql/codegen/index.ts",
      "packages/gql/scripts/fix-generated-types.mjs",
      "scripts/audit-docs.ts",
      "scripts/audit-non-godot-parity.mjs",
    ]) {
      expect(readRepositoryFile(path), path).toContain(
        "generated-sync-manifest.mjs",
      );
    }

    const targetPaths = GENERATED_SYNC_EDGES.map((edge) => edge.path);
    for (const path of [
      "scripts/audit-docs.ts",
      "scripts/audit-non-godot-parity.mjs",
    ]) {
      const source = readRepositoryFile(path);
      for (const targetPath of targetPaths) {
        expect(source, `${path} duplicates ${targetPath}`).not.toContain(
          targetPath,
        );
      }
    }
  });

  it("runs parity unconditionally and checks the whole worktree after synchronization", () => {
    const workflow = readRepositoryFile(".github/workflows/ci.yml");
    const parityJob = workflow.slice(
      workflow.indexOf("  audit-parity:"),
      workflow.indexOf("\n  test-gql:"),
    );
    const normalizedParityJob = parityJob.replace(/\\\r?\n[ \t]*/g, "");
    const syncIndex = normalizedParityJob.indexOf("./scripts/sync-versions.sh");
    const driftIndex = normalizedParityJob.indexOf(
      "node scripts/assert-clean-worktree.mjs",
    );
    const parityIndex = normalizedParityJob.indexOf(
      "node scripts/audit-non-godot-parity.mjs",
    );
    const setupIndex = normalizedParityJob.indexOf(
      "uses: oven-sh/setup-bun@v2",
    );
    const installIndex = normalizedParityJob.indexOf(
      "bun install --frozen-lockfile --filter @hyodotdev/openiap --filter @hyodotdev/openiap-gql",
    );

    expect(syncIndex).toBeGreaterThanOrEqual(0);
    expect(parityJob).toContain("uses: oven-sh/setup-bun@v2");
    expect(parityJob).toContain("bun-version: 1.3.13");
    expect(setupIndex).toBeGreaterThanOrEqual(0);
    expect(installIndex).toBeGreaterThanOrEqual(0);
    expect(installIndex).toBeGreaterThan(setupIndex);
    expect(syncIndex).toBeGreaterThan(installIndex);
    expect(driftIndex).toBeGreaterThan(syncIndex);
    expect(parityIndex).toBeGreaterThan(driftIndex);
    expect(parityJob).not.toContain("needs: changes");
    expect(parityJob).not.toContain("needs.changes.outputs.parity");
    expect(parityJob).not.toContain("assert-generated-staged.mjs");
    expect(parityJob).not.toContain(
      "node packages/gql/scripts/verify-generated-sync.mjs",
    );
    expect(parityJob).toContain(
      "node --test scripts/assert-clean-worktree.test.mjs",
    );
    expect(
      workflow.match(/node scripts\/assert-clean-worktree\.mjs/g),
    ).toHaveLength(3);
    expect(workflow).not.toContain("git status --porcelain");
    const changesJob = workflow.slice(
      workflow.indexOf("  changes:"),
      workflow.indexOf("\n  audit-parity:"),
    );
    expect(changesJob).not.toContain("parity:");
    const parityAudit = readRepositoryFile(
      "scripts/audit-non-godot-parity.mjs",
    );
    expect(parityAudit).toContain("execFileSync(");
    expect(parityAudit).toContain("process.execPath");
    expect(parityAudit).toContain('"--test"');
    expect(parityAudit).toContain(
      "packages/gql/scripts/standalone-generated-refreshers.test.mjs",
    );
    const syncCheck = parityAudit.slice(
      parityAudit.indexOf("function checkGeneratedTypeSync()"),
      parityAudit.indexOf("\nfunction checkGqlRuntimeExports()"),
    );
    expect(syncCheck).toContain("collectGeneratedSyncDrift(root)");
    expect(syncCheck).not.toContain("expectSameFile(");
  });

  it("keeps root generator inputs on CI and the staged-snapshot helper", () => {
    const workflow = readRepositoryFile(".github/workflows/ci.yml");
    const gqlFilter = workflow.slice(
      workflow.indexOf("            gql:"),
      workflow.indexOf("            android:"),
    );
    const [sourceRoot, ...externalInputs] = GQL_GENERATION_INPUT_PATHS;
    expect(gqlFilter).toContain(`- '${sourceRoot}/**'`);
    for (const input of externalInputs) {
      expect(gqlFilter).toContain(`- '${input}'`);
    }

    const preCommit = readRepositoryFile(".husky/pre-commit");
    expect(preCommit).toContain(
      "assert-generation-inputs-staged.mjs has-staged-inputs",
    );
    expect(preCommit).toContain(
      "assert-generation-inputs-staged.mjs assert-staged-clean",
    );
    expect(preCommit).toContain("node scripts/audit-non-godot-parity.mjs");
    const flutterGate = preCommit.slice(
      preCommit.indexOf("# Paths-aware Flutter analyze."),
      preCommit.indexOf("# Paths-aware GQL generator gate."),
    );
    expect(flutterGate).toContain("unset $(git rev-parse --local-env-vars)");
    expect(
      flutterGate.indexOf("unset $(git rev-parse --local-env-vars)"),
    ).toBeLessThan(flutterGate.lastIndexOf("\n      flutter analyze"));

    const harnessRoot = mkdtempSync(join(tmpdir(), "openiap-flutter-hook-"));
    const fakeBin = resolve(harnessRoot, "bin");
    const flutterObservedFile = resolve(harnessRoot, "flutter-env");
    const hookAfterFile = resolve(harnessRoot, "hook-env");
    try {
      mkdirSync(fakeBin);
      const fakeGit = resolve(fakeBin, "git");
      const fakeFlutter = resolve(fakeBin, "flutter");
      writeFileSync(
        fakeGit,
        `#!/bin/sh
if [ "$1" = "diff" ]; then
  printf '%s\\n' 'libraries/flutter_inapp_purchase/lib/types.dart'
elif [ "$1" = "rev-parse" ] && [ "$2" = "--local-env-vars" ]; then
  printf '%s\\n' GIT_INDEX_FILE GIT_DIR
else
  exit 91
fi
`,
      );
      writeFileSync(
        fakeFlutter,
        `#!/bin/sh
[ "$1" = "analyze" ] || exit 92
[ -z "\${GIT_INDEX_FILE+x}" ] || exit 93
[ -z "\${GIT_DIR+x}" ] || exit 94
printf clean > "$FLUTTER_OBSERVED_FILE"
`,
      );
      chmodSync(fakeGit, 0o755);
      chmodSync(fakeFlutter, 0o755);

      const harness = spawnSync(
        "sh",
        [
          "-c",
          `${flutterGate}
printf '%s|%s' "$GIT_INDEX_FILE" "$GIT_DIR" > "$HOOK_AFTER_FILE"
`,
        ],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
            FLUTTER_OBSERVED_FILE: flutterObservedFile,
            HOOK_AFTER_FILE: hookAfterFile,
            GIT_INDEX_FILE: "sentinel-index",
            GIT_DIR: "sentinel-dir",
          },
        },
      );
      expect(harness.status, harness.stderr).toBe(0);
      expect(readFileSync(flutterObservedFile, "utf8")).toBe("clean");
      expect(readFileSync(hookAfterFile, "utf8")).toBe(
        "sentinel-index|sentinel-dir",
      );
    } finally {
      rmSync(harnessRoot, { recursive: true, force: true });
    }
    expect(preCommit).not.toContain(
      "node packages/gql/scripts/verify-generated-sync.mjs",
    );
  });

  it("keeps package entry points on the complete canonical pipeline", () => {
    const gqlPackageJson = JSON.parse(
      readRepositoryFile("packages/gql/package.json"),
    );
    const rootPackageJson = JSON.parse(readRepositoryFile("package.json"));
    expect(rootPackageJson.scripts.generate).toBe(
      "cd packages/gql && bun run generate",
    );
    expect(gqlPackageJson.scripts.generate).toBe(
      "bun run generate:ts && bun codegen/index.ts && bun run sync",
    );

    for (const path of [
      "packages/apple/package.json",
      "packages/google/package.json",
    ]) {
      const packageJson = JSON.parse(readRepositoryFile(path));
      expect(packageJson.scripts["generate:types"], path).toBe(
        "cd ../gql && bun run generate",
      );
    }

    const googleCompatibilityScript = readRepositoryFile(
      "packages/google/scripts/generate-types.sh",
    );
    expect(googleCompatibilityScript).toContain("bun run generate");
    expect(googleCompatibilityScript).not.toContain("bun run generate:");
    expect(googleCompatibilityScript).not.toMatch(/\bcp\s/);

    const appleStandaloneWorkflow = readRepositoryFile(
      "packages/apple/.github/workflows/test.yml",
    );
    expect(appleStandaloneWorkflow).toContain(
      "test -s Sources/Models/Types.swift",
    );
    expect(appleStandaloneWorkflow).not.toContain(
      "./scripts/generate-types.sh",
    );
    expect(
      existsSync(
        resolve(repositoryRoot, "packages/apple/scripts/generate-types.sh"),
      ),
    ).toBe(false);
    expect(
      existsSync(
        resolve(
          repositoryRoot,
          "packages/google/scripts/post-process-types.sh",
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(
        resolve(
          repositoryRoot,
          "packages/gql/.github/workflows/generate-types.yml",
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(
        resolve(
          repositoryRoot,
          "packages/gql/.github/workflows/release-types.yml",
        ),
      ),
    ).toBe(false);
  });

  it("makes every manifest target an executable sync edge", () => {
    const declaredTargets = Object.entries(GENERATED_SYNC_MANIFEST).flatMap(
      ([groupName, definition]) =>
        Object.entries(definition.targets).map(
          ([targetName, definitionTarget]) => ({
            groupName,
            targetName,
            source: definition.source,
            ...definitionTarget,
          }),
        ),
    );

    expect(GENERATED_SYNC_EDGES).toEqual(declaredTargets);
    expect(new Set(GENERATED_SYNC_EDGES.map((edge) => edge.mode))).toEqual(
      new Set(["copy", "google-kotlin", "kmp-kotlin"]),
    );
    expect(
      readRepositoryFile("packages/gql/scripts/sync-to-platforms.mjs"),
    ).toContain("for (const edge of GENERATED_SYNC_EDGES)");
  });
});
