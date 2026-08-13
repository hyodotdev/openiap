import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  __testing as generatorTesting,
  buildSbom,
  componentFromTag,
  findMissingLatestSbomTags,
  generateSbom,
  listComponentIds,
  normalizeLicense,
  PUBLISHED_METADATA_UNAVAILABLE_EXIT_CODE,
  readComponentVersion,
  readVexStatements,
  releaseTagFor,
  sbomFileName,
} from "./generate-sbom.mjs";
import { PACKAGE_CONFIG } from "./assert-release-tag.mjs";
import {
  __testing as dependencyTesting,
  extractDirectDependencies,
  mergeResolved,
  PublishedMetadataUnavailableError,
} from "./sbom-dependencies.mjs";
import { versionSources } from "./release-branch-policy.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const historicalGoogleRoot = resolve(
  repoRoot,
  "scripts/fixtures/historical-releases/google-v1.3.0",
);
const { COMPONENTS, fetchPublishedText } = generatorTesting;
const {
  extractGradle,
  extractPub,
  isRuntimeGradleConfiguration,
  parseMavenCoordinate,
  parseMavenPom,
  parseNugetNuspec,
} = dependencyTesting;

function mavenPom(dependencies) {
  return `<project><dependencies>${dependencies
    .map(
      ([group, artifact, version, scope = "runtime"]) =>
        `<dependency><groupId>${group}</groupId><artifactId>${artifact}</artifactId>` +
        `<version>${version}</version><scope>${scope}</scope></dependency>`,
    )
    .join("")}</dependencies></project>`;
}

const googleDependencies = [
  ["com.android.billingclient", "billing", "9.1.0", "compile"],
  ["org.jetbrains.kotlin", "kotlin-stdlib", "2.2.0", "compile"],
  ["androidx.core", "core", "1.18.0"],
  ["androidx.lifecycle", "lifecycle-runtime", "2.10.0"],
  ["org.jetbrains.kotlinx", "kotlinx-coroutines-core", "1.11.0"],
  ["org.jetbrains.kotlinx", "kotlinx-coroutines-android", "1.11.0"],
  ["androidx.lifecycle", "lifecycle-viewmodel", "2.10.0"],
  ["com.google.code.gson", "gson", "2.14.0"],
  ["androidx.compose.runtime", "runtime", "1.11.4"],
  ["androidx.compose.ui", "ui", "1.11.4"],
];

const historicalGoogleDependencies = [
  ["com.android.billingclient", "billing-ktx", "8.0.0", "compile"],
  [
    "com.meta.horizon.billingclient.api",
    "horizon-billing-compatibility",
    "1.1.1",
    "compile",
  ],
  ["org.jetbrains.kotlin", "kotlin-stdlib", "2.0.21", "compile"],
  ["androidx.core", "core-ktx", "1.12.0"],
  ["androidx.lifecycle", "lifecycle-runtime-ktx", "2.7.0"],
  ["org.jetbrains.kotlinx", "kotlinx-coroutines-core", "1.9.0"],
  ["org.jetbrains.kotlinx", "kotlinx-coroutines-android", "1.9.0"],
  ["androidx.lifecycle", "lifecycle-viewmodel-ktx", "2.7.0"],
  ["com.google.code.gson", "gson", "2.10.1"],
  ["androidx.compose.runtime", "runtime", "1.6.8"],
  ["androidx.compose.ui", "ui", "1.6.8"],
];

const kmpDependencies = [
  ["org.jetbrains.kotlinx", "kotlinx-coroutines-core-jvm", "1.11.0", "compile"],
  ["org.jetbrains.kotlin", "kotlin-stdlib", "2.4.10", "compile"],
  ["io.github.hyochan.openiap", "openiap-google", "3.3.0"],
  ["org.jetbrains.kotlinx", "kotlinx-datetime-jvm", "0.8.0"],
  ["org.jetbrains.kotlinx", "kotlinx-serialization-json-jvm", "1.11.0"],
];

const mauiDependencies = [
  ["GoogleGson", "2.14.0.1"],
  ["Xamarin.Android.Google.BillingClient", "9.1.0.1"],
  ["Xamarin.AndroidX.Activity", "1.13.0.1"],
  ["Xamarin.AndroidX.Activity.Ktx", "1.13.0.1"],
  ["Xamarin.AndroidX.Collection.Ktx", "1.6.0.1"],
  ["Xamarin.AndroidX.Fragment", "1.8.9.3"],
  ["Xamarin.AndroidX.Fragment.Ktx", "1.8.9.4"],
  ["Xamarin.AndroidX.Lifecycle.LiveData", "2.11.0.1"],
  ["Xamarin.AndroidX.Lifecycle.LiveData.Core", "2.11.0.1"],
  ["Xamarin.AndroidX.Lifecycle.LiveData.Core.Ktx", "2.11.0.1"],
  ["Xamarin.AndroidX.Lifecycle.Process", "2.11.0.1"],
  ["Xamarin.AndroidX.Lifecycle.Runtime", "2.11.0.1"],
  ["Xamarin.AndroidX.Lifecycle.Runtime.Ktx", "2.11.0.1"],
  ["Xamarin.AndroidX.Lifecycle.Runtime.Ktx.Android", "2.11.0.1"],
  ["Xamarin.AndroidX.Lifecycle.ViewModel", "2.11.0.1"],
  ["Xamarin.AndroidX.Lifecycle.ViewModel.Ktx", "2.11.0.1"],
  ["Xamarin.AndroidX.SavedState", "1.5.0.1"],
  ["Xamarin.AndroidX.SavedState.SavedState.Ktx", "1.5.0.1"],
  ["Xamarin.Kotlin.StdLib", "2.4.0.1"],
  ["Xamarin.KotlinX.Coroutines.Android", "1.11.0.1"],
  ["Xamarin.KotlinX.Coroutines.Core", "1.11.0.1"],
  ["Xamarin.KotlinX.Coroutines.Core.Jvm", "1.11.0.1"],
];

const mauiNuspec = `<package><metadata><dependencies><group targetFramework="net10.0-android36.0">${mauiDependencies
  .map(([name, version]) => `<dependency id="${name}" version="${version}" />`)
  .join("")}</group></dependencies></metadata></package>`;

globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes("openiap-google/1.3.0/")) {
    return new Response(mavenPom(historicalGoogleDependencies));
  }
  if (url.includes("openiap-google/")) {
    return new Response(mavenPom(googleDependencies));
  }
  if (url.includes("kmp-iap-android-play/")) {
    return new Response(mavenPom(kmpDependencies));
  }
  if (url.includes("openiap.maui.nuspec")) {
    return new Response(mauiNuspec);
  }
  return new Response("", { status: 404 });
};

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
  assert.equal(sbomFileName("apple", "3.2.0"), "openiap-3.2.0.cdx.json");
});

test("release tags match the release-tag SSOT", () => {
  assert.equal(
    releaseTagFor("react-native", "16.3.0"),
    "react-native-iap-16.3.0",
  );
  assert.equal(releaseTagFor("google", "3.3.0"), "google-3.3.0");
  assert.equal(releaseTagFor("docs", "3.2.0"), "docs-3.2.0");
});

test("every release tag pattern resolves back to its own component", () => {
  // `sbom.yml` identifies the component from the published tag alone. If a tag
  // pattern is added to the release SSOT and TAG_PREFIXES does not learn it,
  // that release is silently skipped and ships with no SBOM. This iterates the
  // SSOT so the divergence fails here rather than at release time.
  for (const [componentId, config] of Object.entries(PACKAGE_CONFIG)) {
    for (const tag of config.tags("9.9.9")) {
      assert.deepEqual(
        componentFromTag(tag),
        { componentId, version: "9.9.9" },
        `${componentId} tag ${tag}`,
      );
    }
  }

  // `docs` releases the spec and is absent from PACKAGE_CONFIG.
  assert.deepEqual(componentFromTag("docs-9.9.9"), {
    componentId: "docs",
    version: "9.9.9",
  });

  // A prefix must not swallow a longer one, and a tag we do not own is skipped
  // rather than misattributed.
  assert.equal(componentFromTag("google-v1.2.3").componentId, "google");
  assert.equal(componentFromTag("apple-v1.2.3").componentId, "apple");
  assert.equal(componentFromTag("1.2.3").componentId, "apple");
  assert.equal(componentFromTag("some-unrelated-tag"), null);
  assert.equal(componentFromTag("google-1.2.3-not-a-version!"), null);
  assert.equal(componentFromTag(""), null);
});

test("backfill selects only the newest missing SBOM per component", () => {
  const releases = [
    {
      tag_name: "google-3.3.0",
      published_at: "2026-08-11T00:00:00Z",
      assets: [{ name: "openiap-google-3.3.0.cdx.json" }],
    },
    {
      tag_name: "kmp-iap-3.3.0",
      published_at: "2026-08-11T00:00:00Z",
      assets: [{ name: "release-artifacts.zip" }],
    },
    {
      tag_name: "kmp-iap-3.2.2",
      published_at: "2026-08-10T00:00:00Z",
      assets: [],
    },
    {
      tag_name: "draft-1.0.0",
      published_at: null,
      draft: true,
      assets: [],
    },
  ];
  assert.deepEqual(findMissingLatestSbomTags(releases), ["kmp-iap-3.3.0"]);
});

test("every GitHub release workflow dispatches the SBOM workflow", () => {
  const workflowDir = resolve(repoRoot, ".github/workflows");
  const workflows = readdirSync(workflowDir)
    .filter((name) => name.endsWith(".yml"))
    .map((name) => [name, readFileSync(resolve(workflowDir, name), "utf8")])
    .filter(([, source]) =>
      /softprops\/action-gh-release|gh release create/u.test(source),
    );

  assert.ok(
    workflows.length > 0,
    "release workflow discovery must not be empty",
  );
  for (const [name, source] of workflows) {
    const releaseIndex = Math.max(
      source.lastIndexOf("softprops/action-gh-release"),
      source.lastIndexOf("gh release create"),
    );
    const dispatchIndex = source.indexOf("gh workflow run sbom.yml");
    assert.ok(dispatchIndex > releaseIndex, `${name} dispatch order`);
    const dispatchCommand = source
      .slice(dispatchIndex)
      .match(/^gh workflow run sbom\.yml[^\n]*(?:\\\n\s+[^\n]*)*/u)?.[0];
    assert.match(dispatchCommand, /-f tag="\$RELEASE_TAG"/u, `${name} tag`);
    assert.match(source, /actions: write/u, name);
  }
});

test("SBOM publication waits for registry propagation and repairs daily", () => {
  const source = readFileSync(
    resolve(repoRoot, ".github/workflows/sbom.yml"),
    "utf8",
  );
  assert.match(source, /cron: "23 3 \* \* \*"/u);
  assert.match(source, /for attempt in \{1\.\.16\}/u);
  assert.match(source, /\[ "\$STATUS" -ne 75 \]/u);
  assert.doesNotMatch(source, /grep.+Published/u);
  assert.match(source, /ASSET_NAMES=\$\(gh release view/u);
  assert.match(source, /persist-credentials: false/u);
  assert.match(source, /sleep 120/u);
});

test("Google releases fail when an unpublished flavor lacks credentials", () => {
  const source = readFileSync(
    resolve(repoRoot, ".github/workflows/release-google.yml"),
    "utf8",
  );
  assert.equal(
    source.match(/Maven Central credentials are required to publish/gu)?.length,
    3,
  );
  assert.doesNotMatch(source, /Skipping publish/u);
});

test("generated SBOMs preserve accepted release tag aliases", () => {
  for (const [componentId, config] of Object.entries(PACKAGE_CONFIG)) {
    for (const tag of config.tags("9.9.9")) {
      const document = buildSbom({
        componentId,
        version: "9.9.9",
        commit: stubCommit,
        generatorCommit: stubCommit,
        releaseTag: tag,
        timestamp: "2026-01-01T00:00:00.000Z",
        dependencies: [],
      });
      const properties = Object.fromEntries(
        document.metadata.component.properties.map((property) => [
          property.name,
          property.value,
        ]),
      );
      assert.equal(properties["openiap:release:tag"], tag, tag);
    }
  }
});

test("current generator supports the google-v1.3.0 release tree", async () => {
  const releaseCommit = "768dc142634a3f34e6a97b9eda4cdd9574d9c2ed";
  const generatorCommit = "f".repeat(40);
  const { document, directCount } = await generateSbom("google", {
    root: historicalGoogleRoot,
    commit: releaseCommit,
    generatorCommit,
    releaseTag: "google-v1.3.0",
    runGit: stubGit,
  });

  assert.equal(document.metadata.component.version, "1.3.0");
  assert.equal(directCount, 11);
  assert.deepEqual(
    document.components.map((component) => component.name),
    [
      "androidx.compose.runtime:runtime",
      "androidx.compose.ui:ui",
      "androidx.core:core-ktx",
      "androidx.lifecycle:lifecycle-runtime-ktx",
      "androidx.lifecycle:lifecycle-viewmodel-ktx",
      "com.android.billingclient:billing-ktx",
      "com.google.code.gson:gson",
      "com.meta.horizon.billingclient.api:horizon-billing-compatibility",
      "org.jetbrains.kotlin:kotlin-stdlib",
      "org.jetbrains.kotlinx:kotlinx-coroutines-android",
      "org.jetbrains.kotlinx:kotlinx-coroutines-core",
    ],
  );

  const releaseProperties = Object.fromEntries(
    document.metadata.component.properties.map((property) => [
      property.name,
      property.value,
    ]),
  );
  assert.equal(releaseProperties["openiap:release:tag"], "google-v1.3.0");
  assert.equal(releaseProperties["openiap:release:commit"], releaseCommit);

  const toolProperties = Object.fromEntries(
    document.metadata.tools.components[0].properties.map((property) => [
      property.name,
      property.value,
    ]),
  );
  assert.equal(toolProperties["openiap:generator:commit"], generatorCommit);
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
  const toolProperties = Object.fromEntries(
    document.metadata.tools.components[0].properties.map((property) => [
      property.name,
      property.value,
    ]),
  );
  assert.equal(toolProperties["openiap:generator:commit"], stubCommit);
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

test("Gradle declarations are classified or fail closed", () => {
  assert.equal(isRuntimeGradleConfiguration("implementation"), true);
  assert.equal(isRuntimeGradleConfiguration("api"), true);
  assert.equal(isRuntimeGradleConfiguration("testImplementation"), false);
  assert.equal(
    isRuntimeGradleConfiguration("androidTestImplementation"),
    false,
  );
  assert.equal(isRuntimeGradleConfiguration("compileOnly"), false);
  assert.equal(isRuntimeGradleConfiguration("playCompileOnly"), false);
  assert.equal(isRuntimeGradleConfiguration("kaptImplementation"), false);
  assert.throws(
    () => isRuntimeGradleConfiguration("playApi"),
    /Unclassified Gradle dependency configuration/u,
  );
});

test("an unmodelled Gradle coordinate fails instead of silently vanishing", () => {
  assert.throws(
    () => parseMavenCoordinate("com.example:lib:$unknownVersion"),
    /Unresolved Maven coordinate/u,
  );
  assert.throws(
    () => parseMavenCoordinate("com.example:lib:1.0.0:sources"),
    /Unsupported Maven coordinate/u,
  );
});

test("published metadata matches the consumer-visible artifacts", async () => {
  const google = await generateSbom("google", {
    root: repoRoot,
    runGit: stubGit,
  });
  const googleNames = google.document.components.map((entry) => entry.name);
  assert.equal(google.directCount, 10);
  assert.ok(googleNames.includes("org.jetbrains.kotlin:kotlin-stdlib"));
  assert.ok(!googleNames.some((name) => name.includes("horizon")));
  assert.ok(!googleNames.some((name) => name.includes("amazon")));

  const kmp = await generateSbom("kmp", { root: repoRoot, runGit: stubGit });
  const kmpNames = kmp.document.components.map((entry) => entry.name);
  assert.equal(kmp.directCount, 5);
  assert.ok(kmpNames.includes("io.github.hyochan.openiap:openiap-google"));
  assert.ok(kmpNames.includes("org.jetbrains.kotlin:kotlin-stdlib"));

  const maui = await generateSbom("maui", { root: repoRoot, runGit: stubGit });
  assert.equal(maui.directCount, 22);
  assert.ok(
    !maui.document.components.some((entry) =>
      entry.name.includes("Serialization"),
    ),
  );
});

test("published metadata parsers reject unsupported dependencies", () => {
  assert.throws(
    () =>
      parseMavenPom(
        "<project><dependencies><dependency><groupId>g</groupId>" +
          "<artifactId>a</artifactId></dependency></dependencies></project>",
        { url: "fixture.pom", version: "1.0.0" },
      ),
    /Incomplete runtime dependency/u,
  );
  assert.throws(
    () =>
      parseNugetNuspec(
        '<package><dependencies><dependency id="A" /></dependencies></package>',
        { url: "fixture.nuspec" },
      ),
    /Incomplete published NuGet dependency/u,
  );
  assert.throws(
    () =>
      parseMavenPom(mavenPom([["g", "a", "1.0.0", "unclassified"]]), {
        url: "fixture.pom",
        version: "1.0.0",
      }),
    /Unsupported Maven scope/u,
  );
  assert.throws(
    () =>
      parseMavenPom(
        "<project><profiles><profile><dependencies><dependency>" +
          "<groupId>g</groupId><artifactId>a</artifactId>" +
          "<version>1.0.0</version></dependency></dependencies>" +
          "</profile></profiles></project>",
        { url: "fixture.pom", version: "1.0.0" },
      ),
    /Unsupported profiled Maven dependency/u,
  );
});

test("published metadata fetches retry transport failures", async () => {
  let attempts = 0;
  const result = await fetchPublishedText("https://example.com/package.pom", {
    fetcher: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary DNS failure");
      return "<project />";
    },
    retryDelays: [0],
    wait: async () => {},
  });

  assert.equal(result, "<project />");
  assert.equal(attempts, 2);
});

test("missing published metadata has a dedicated error type", async () => {
  assert.equal(PUBLISHED_METADATA_UNAVAILABLE_EXIT_CODE, 75);
  await assert.rejects(
    () =>
      extractDirectDependencies(
        repoRoot,
        {
          kind: "maven-pom",
          coordinate: "example:package",
          repositories: ["https://example.com/maven"],
        },
        { version: "1.0.0", fetchText: async () => null },
      ),
    (error) => error instanceof PublishedMetadataUnavailableError,
  );
});

test("pub dependencies exclude the Flutter SDK itself", () => {
  const dependencies = extractPub(repoRoot, COMPONENTS.flutter.source);
  assert.deepEqual(
    dependencies.map((entry) => entry.name),
    ["http", "meta", "platform"],
  );
  assert.deepEqual(
    dependencies.map((entry) => entry.version),
    ["^1.2.0", "^1.11.0", "^3.1.4"],
  );
  assert.ok(dependencies.every((entry) => entry.purl.includes("@%5E")));
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
  assert.throws(
    () => mergeResolved(direct, [{ name: "missing-version" }]),
    /Incomplete resolved dependency/u,
  );
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

test("each component's declared licence matches what it publishes", async () => {
  // A wrong licence is worse than a missing one: it is confident and it is
  // consumed by compliance tooling. kmp-iap ships Apache-2.0 while the rest of
  // the repository is MIT, so the SBOM must not blanket-assert MIT.
  const declared = async (componentId) => {
    const { document } = await generateSbom(componentId, {
      root: repoRoot,
      runGit: stubGit,
    });
    return document.metadata.component.licenses[0].license.id;
  };

  assert.equal(await declared("kmp"), "Apache-2.0");
  for (const componentId of ["apple", "expo", "react-native", "conformance"]) {
    assert.equal(await declared(componentId), "MIT", componentId);
  }

  // The npm components state it in their own manifest; keep the two in step.
  for (const [componentId, manifest] of [
    ["expo", "libraries/expo-iap/package.json"],
    ["react-native", "libraries/react-native-iap/package.json"],
    ["conformance", "packages/conformance/package.json"],
  ]) {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, manifest), "utf8"));
    assert.equal(await declared(componentId), pkg.license, componentId);
  }

  // kmp declares Apache-2.0 in its POM block; fail if that ever diverges.
  const kmpBuild = readFileSync(
    resolve(repoRoot, "libraries/kmp-iap/library/build.gradle.kts"),
    "utf8",
  );
  assert.match(kmpBuild, /Apache-2\.0|Apache License 2\.0/u);
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

test("every component is reachable from the root of the dependency graph", () => {
  // A transitive entry missing from `dependsOn` would still appear under
  // `components`, but a consumer walking the graph from the root would never
  // reach it. Standard CycloneDX tooling uses the graph, not our property.
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
  assert.deepEqual(root.dependsOn, [
    "pkg:maven/g/a@1.0.0",
    "pkg:maven/g/b@2.0.0",
  ]);
  assert.equal(document.components.length, 2);

  // The transitive marker stays a property, so the distinction is not lost.
  const transitive = document.components.find((c) => c.name === "b");
  assert.deepEqual(transitive.properties, [
    { name: "openiap:sbom:relationship", value: "transitive" },
  ]);
});
