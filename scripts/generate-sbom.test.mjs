import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  __testing as generatorTesting,
  buildSbom,
  generateSbom,
  listComponentIds,
  normalizeLicense,
  readComponentVersion,
  readVexStatements,
  releaseTagFor,
  sbomFileName,
} from "./generate-sbom.mjs";
import {
  __testing as dependencyTesting,
  mergeResolved,
} from "./sbom-dependencies.mjs";
import { versionSources } from "./release-branch-policy.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { COMPONENTS } = generatorTesting;
const {
  expandGradleForLoops,
  extractGradle,
  extractNuget,
  extractPub,
  isRuntimeGradleConfiguration,
  parseMavenCoordinate,
  parseVersionCatalog,
  stripTestSourceSets,
} = dependencyTesting;

const stubCommit = "0".repeat(40);
const stubGit = (args) =>
  args[0] === "rev-parse" ? stubCommit : "2026-01-02T03:04:05+00:00";

test("every releasable component has SBOM metadata", () => {
  // The release SSOT decides what ships. A component that can be released but
  // has no SBOM definition would ship without an inventory.
  assert.deepEqual(listComponentIds(), Object.keys(versionSources).sort());
});

test("component versions come from the release SSOT", () => {
  for (const componentId of listComponentIds()) {
    const fromSbom = readComponentVersion(componentId, repoRoot);
    const fromPolicy = versionSources[componentId].read(repoRoot);
    assert.equal(fromSbom, fromPolicy, componentId);
  }
});

test("SBOM file name matches the documented convention", () => {
  assert.equal(
    sbomFileName("react-native", "16.3.0"),
    "react-native-iap-16.3.0.cdx.json",
  );
  assert.equal(
    sbomFileName("conformance", "1.0.0"),
    "openiap-conformance-1.0.0.cdx.json",
  );
});

test("release tags match the release-tag SSOT", () => {
  assert.equal(
    releaseTagFor("react-native", "16.3.0"),
    "react-native-iap-16.3.0",
  );
  assert.equal(releaseTagFor("google", "3.3.0"), "google-3.3.0");
  assert.equal(releaseTagFor("docs", "3.2.0"), "docs-3.2.0");
});

test("serial number is derived from release identity, not randomness", () => {
  const identity = {
    componentId: "expo",
    version: "5.3.0",
    commit: stubCommit,
  };
  const first = buildSbom({
    ...identity,
    timestamp: "2026-01-01T00:00:00.000Z",
    dependencies: [],
  });
  const second = buildSbom({
    ...identity,
    timestamp: "2026-01-01T00:00:00.000Z",
    dependencies: [],
  });
  assert.equal(first.serialNumber, second.serialNumber);
  assert.match(first.serialNumber, /^urn:uuid:[0-9a-f-]{36}$/u);

  const otherCommit = buildSbom({
    ...identity,
    commit: "1".repeat(40),
    timestamp: "2026-01-01T00:00:00.000Z",
    dependencies: [],
  });
  assert.notEqual(first.serialNumber, otherCommit.serialNumber);
});

test("SBOM carries the metadata a release must be traceable by", () => {
  const document = buildSbom({
    componentId: "react-native",
    version: "16.3.0",
    commit: stubCommit,
    timestamp: "2026-01-01T00:00:00.000Z",
    dependencies: [],
  });

  assert.equal(document.bomFormat, "CycloneDX");
  assert.equal(document.specVersion, "1.6");

  const component = document.metadata.component;
  assert.equal(component.name, "react-native-iap");
  assert.equal(component.version, "16.3.0");
  assert.equal(component.purl, "pkg:npm/react-native-iap@16.3.0");

  const referenceTypes = component.externalReferences.map((ref) => ref.type);
  assert.ok(referenceTypes.includes("vcs"));
  assert.ok(referenceTypes.includes("distribution"));

  const properties = Object.fromEntries(
    component.properties.map((property) => [property.name, property.value]),
  );
  assert.equal(properties["openiap:release:commit"], stubCommit);
  assert.equal(properties["openiap:release:tag"], "react-native-iap-16.3.0");
});

test("generated SBOM version always matches the shipped manifest", async () => {
  for (const componentId of listComponentIds()) {
    const result = await generateSbom(componentId, {
      root: repoRoot,
      runGit: stubGit,
    });
    assert.equal(
      result.document.metadata.component.version,
      readComponentVersion(componentId, repoRoot),
      componentId,
    );
    assert.ok(result.fileName.endsWith(".cdx.json"), componentId);
  }
});

test("generated SBOMs never embed local filesystem paths", async () => {
  for (const componentId of listComponentIds()) {
    const { document } = await generateSbom(componentId, {
      root: repoRoot,
      runGit: stubGit,
    });
    const serialized = JSON.stringify(document);
    assert.doesNotMatch(serialized, /\/Users\//u, componentId);
    assert.doesNotMatch(serialized, /\/home\/[a-z]/u, componentId);
    assert.doesNotMatch(serialized, /\/tmp\//u, componentId);
  }
});

test("test-only Gradle configurations stay out of the inventory", () => {
  assert.equal(isRuntimeGradleConfiguration("implementation"), true);
  assert.equal(isRuntimeGradleConfiguration("api"), true);
  assert.equal(isRuntimeGradleConfiguration("playApi"), true);
  assert.equal(isRuntimeGradleConfiguration("horizonImplementation"), true);

  assert.equal(isRuntimeGradleConfiguration("testImplementation"), false);
  assert.equal(
    isRuntimeGradleConfiguration("androidTestImplementation"),
    false,
  );
  assert.equal(isRuntimeGradleConfiguration("compileOnly"), false);
  assert.equal(isRuntimeGradleConfiguration("playCompileOnly"), false);
  assert.equal(isRuntimeGradleConfiguration("kaptImplementation"), false);
});

test("packages/google inventory excludes its test dependencies", () => {
  const dependencies = extractGradle(repoRoot, COMPONENTS.google.source);
  const names = dependencies.map((entry) => entry.name);

  assert.ok(names.includes("com.android.billingclient:billing"));
  assert.ok(names.includes("com.google.code.gson:gson"));
  // Declared with `testImplementation` / `androidTestImplementation`.
  assert.ok(!names.includes("junit:junit"));
  assert.ok(!names.includes("org.robolectric:robolectric"));
  assert.ok(!names.includes("androidx.test:core"));
  assert.ok(!names.includes("org.jetbrains.kotlinx:kotlinx-coroutines-test"));
});

test("Gradle for-loop module lists expand to real coordinates", () => {
  const expanded = expandGradleForLoops(
    'for (module in listOf("a-kotlin", "b-kotlin")) {\n' +
      '  add("horizonApi", "com.example:$module:1.2.3")\n' +
      "}",
  );
  assert.match(expanded, /com\.example:a-kotlin:1\.2\.3/u);
  assert.match(expanded, /com\.example:b-kotlin:1\.2\.3/u);

  const names = extractGradle(repoRoot, COMPONENTS.google.source).map(
    (entry) => entry.name,
  );
  for (const module of [
    "core-kotlin",
    "user-age-category-kotlin",
    "iap-kotlin",
  ]) {
    assert.ok(
      names.includes(`com.meta.horizon.platform.sdk:${module}`),
      module,
    );
  }
});

test("an unmodelled Gradle coordinate fails instead of silently vanishing", () => {
  // A dropped dependency is worse than a failed build: the SBOM would claim
  // completeness it does not have.
  assert.deepEqual(parseMavenCoordinate("com.example:lib:$unknownVersion"), {
    unresolved: "com.example:lib:$unknownVersion",
  });
});

test("KMP test source sets are excluded", async () => {
  const stripped = stripTestSourceSets(
    "val commonMain by getting {\n dependencies { api(libs.a) }\n}\n" +
      "val commonTest by getting {\n dependencies { implementation(libs.b) }\n}\n",
  );
  assert.match(stripped, /libs\.a/u);
  assert.doesNotMatch(stripped, /libs\.b/u);

  const kmp = await generateSbom("kmp", { root: repoRoot, runGit: stubGit });
  const names = kmp.document.components.map((entry) => entry.name);
  assert.ok(!names.includes("org.jetbrains.kotlin:kotlin-test"));
  assert.ok(!names.includes("org.jetbrains.kotlinx:kotlinx-coroutines-test"));
});

test("version catalog aliases resolve through version.ref", () => {
  const { versions, libraries } = parseVersionCatalog(
    '[versions]\nfoo = "1.2.3"\n\n[libraries]\n' +
      'bar-baz = { module = "com.example:bar", version.ref = "foo" }\n',
  );
  assert.equal(versions.get("foo"), "1.2.3");
  assert.deepEqual(libraries.get("bar-baz"), {
    module: "com.example:bar",
    versionRef: "foo",
    literal: undefined,
  });
});

test("NuGet references marked PrivateAssets=all are build-only", () => {
  const dependencies = extractNuget(repoRoot, COMPONENTS.maui.source);
  const names = dependencies.map((entry) => entry.name);
  assert.ok(names.includes("Xamarin.Android.Google.BillingClient"));
  // PrivateAssets="all" is not propagated to consumers of the package.
  assert.ok(!names.includes("Microsoft.Maui.Controls"));
  // Every MSBuild property must have been interpolated.
  for (const entry of dependencies) {
    assert.doesNotMatch(entry.version, /\$\(/u, entry.name);
  }
});

test("pub dependencies exclude the Flutter SDK itself", () => {
  const names = extractPub(repoRoot, COMPONENTS.flutter.source).map(
    (entry) => entry.name,
  );
  assert.deepEqual(names, ["http", "meta", "platform"]);
});

test("npm components publish no third-party runtime dependencies", async () => {
  // These ship with an empty `dependencies` block; peer dependencies are the
  // host app's to provide, so they are not part of this artifact's inventory.
  for (const componentId of ["conformance", "expo", "react-native"]) {
    const { document } = await generateSbom(componentId, {
      root: repoRoot,
      runGit: stubGit,
    });
    assert.deepEqual(document.components, [], componentId);
  }
});

test("resolver output adds transitive entries without losing direct ones", () => {
  const direct = [{ name: "a", version: "1.0.0", purl: "pkg:maven/g/a@1.0.0" }];
  const merged = mergeResolved(direct, [
    { name: "a", version: "1.0.0", purl: "pkg:maven/g/a@1.0.0" },
    { name: "b", version: "2.0.0", purl: "pkg:maven/g/b@2.0.0" },
  ]);

  assert.equal(merged.length, 2);
  assert.equal(merged.find((e) => e.name === "a").transitive, undefined);
  assert.equal(merged.find((e) => e.name === "b").transitive, true);
});

test("a registry license only becomes an SPDX id when it really is one", () => {
  // Downstream tooling treats `license.id` as authoritative, so an unrecognised
  // string must degrade to a free-text name rather than be asserted as SPDX.
  assert.deepEqual(normalizeLicense("MIT"), { license: { id: "MIT" } });
  assert.deepEqual(
    normalizeLicense("The Apache Software License, Version 2.0"),
    {
      license: { id: "Apache-2.0" },
    },
  );
  assert.deepEqual(normalizeLicense("MIT AND Apache-2.0"), {
    expression: "MIT AND Apache-2.0",
  });
  assert.deepEqual(
    normalizeLicense("Android Software Development Kit License"),
    {
      license: { name: "Android Software Development Kit License" },
    },
  );
  // A compound expression with an unknown operand is not a valid SPDX
  // expression, so it stays free text.
  assert.deepEqual(normalizeLicense("MIT AND Some-Proprietary-Thing"), {
    license: { name: "MIT AND Some-Proprietary-Thing" },
  });
  assert.equal(normalizeLicense(""), null);
  assert.equal(normalizeLicense(undefined), null);
});

test("license lookup is opt-in so generation stays offline by default", async () => {
  const { document } = await generateSbom("google", {
    root: repoRoot,
    runGit: stubGit,
  });
  assert.ok(document.components.length > 0);
  for (const component of document.components) {
    assert.equal(component.licenses, undefined, component.name);
  }
});

test("VEX statements are validated, and absent by default", (t) => {
  const scratch = mkdtempSync(resolve(tmpdir(), "openiap-vex-"));
  const vexDir = resolve(scratch, "security/vex");
  mkdirSync(vexDir, { recursive: true });
  t.after(() => rmSync(scratch, { recursive: true, force: true }));

  // No file is the normal state and must not be an error.
  assert.deepEqual(readVexStatements(scratch, "google"), []);

  const write = (body) =>
    writeFileSync(resolve(vexDir, "google.json"), JSON.stringify(body));

  write({
    vulnerabilities: [
      {
        id: "CVE-2026-0001",
        affects: [{ ref: "pkg:maven/g/a@1.0.0" }],
        analysis: { state: "not_affected", justification: "code_not_present" },
      },
    ],
  });
  assert.equal(readVexStatements(scratch, "google").length, 1);

  write({ vulnerabilities: [{ id: "CVE-2026-0002", analysis: {} }] });
  assert.throws(() => readVexStatements(scratch, "google"), /expected one of/u);

  // "not affected" with no stated reason is not reviewable.
  write({
    vulnerabilities: [
      { id: "CVE-2026-0003", analysis: { state: "not_affected" } },
    ],
  });
  assert.throws(
    () => readVexStatements(scratch, "google"),
    /without a justification or detail/u,
  );

  write({ vulnerabilities: [{ analysis: { state: "in_triage" } }] });
  assert.throws(() => readVexStatements(scratch, "google"), /without an id/u);
});

test("a VEX statement must point at a component this SBOM contains", () => {
  const dependencies = [
    { name: "a", version: "1.0.0", purl: "pkg:maven/g/a@1.0.0" },
  ];
  const base = {
    componentId: "google",
    version: "3.3.0",
    commit: stubCommit,
    timestamp: "2026-01-01T00:00:00.000Z",
    dependencies,
  };

  const good = buildSbom({
    ...base,
    vulnerabilities: [
      {
        id: "CVE-2026-0001",
        affects: [{ ref: "pkg:maven/g/a@1.0.0" }],
        analysis: { state: "not_affected", justification: "code_not_present" },
      },
    ],
  });
  assert.equal(good.vulnerabilities.length, 1);

  assert.throws(
    () =>
      buildSbom({
        ...base,
        vulnerabilities: [
          {
            id: "CVE-2026-0002",
            affects: [{ ref: "pkg:maven/g/typo@9.9.9" }],
            analysis: { state: "exploitable" },
          },
        ],
      }),
    /is not a component of/u,
  );
});

test("an SBOM with no analysed vulnerabilities omits the section", () => {
  const document = buildSbom({
    componentId: "google",
    version: "3.3.0",
    commit: stubCommit,
    timestamp: "2026-01-01T00:00:00.000Z",
    dependencies: [],
  });
  // An empty array would read as "checked, none found", which is a stronger
  // claim than the absence of analysis.
  assert.equal("vulnerabilities" in document, false);
});

test("only direct dependencies are listed as the component's dependsOn", () => {
  const document = buildSbom({
    componentId: "google",
    version: "3.3.0",
    commit: stubCommit,
    timestamp: "2026-01-01T00:00:00.000Z",
    dependencies: [
      { name: "a", version: "1.0.0", purl: "pkg:maven/g/a@1.0.0" },
      {
        name: "b",
        version: "2.0.0",
        purl: "pkg:maven/g/b@2.0.0",
        transitive: true,
      },
    ],
  });

  const root = document.dependencies.find(
    (entry) => entry.ref === document.metadata.component.purl,
  );
  assert.deepEqual(root.dependsOn, ["pkg:maven/g/a@1.0.0"]);
  assert.equal(document.components.length, 2);
});
