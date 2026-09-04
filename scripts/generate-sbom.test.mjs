import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
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
  PUBLISHED_METADATA_UNAVAILABLE_EXIT_CODE,
  SBOM_COVERAGE_FLOOR,
  __testing as generatorTesting,
  buildSbom,
  componentFromTag,
  findMissingCoverageTags,
  findMissingLatestSbomTags,
  generateSbom,
  latestSbomAssets,
  listComponentIds,
  normalizeLicense,
  prepareSbomForExactVulnerabilityScan,
  publishedSbomAssets,
  readComponentVersion,
  readVexStatements,
  releaseTagFor,
  repairSbomDigestForTag,
  sbomFileName,
  sbomRevisionForTag,
  verifyPublishedSbom,
  verifySbomGeneratorAttestation,
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
const {
  COMPONENTS,
  fetchPublishedText,
  GRADLE_COORDINATE_PATTERN,
  GRADLE_PROJECT_PATTERN,
} = generatorTesting;
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

const horizonDependencies = [
  [
    "com.meta.horizon.billingclient.api",
    "horizon-billing-compatibility",
    "2.0.0",
    "compile",
  ],
  ["com.meta.horizon.platform.sdk", "core-kotlin", "0.2.2", "compile"],
  [
    "com.meta.horizon.platform.sdk",
    "user-age-category-kotlin",
    "0.2.2",
    "compile",
  ],
  ["com.meta.horizon.platform.sdk", "iap-kotlin", "0.2.2", "compile"],
  ["org.jetbrains.kotlinx", "kotlinx-serialization-json", "1.9.0", "compile"],
  ...googleDependencies.slice(1),
];

const amazonDependencies = [
  ["com.amazon.device", "amazon-appstore-sdk", "3.0.9", "compile"],
  ...googleDependencies.slice(1),
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
  ["org.jetbrains.kotlinx", "kotlinx-coroutines-core", "1.11.0"],
  ["org.jetbrains.kotlin", "kotlin-stdlib", "2.4.10"],
  ["org.jetbrains.kotlinx", "kotlinx-datetime", "0.8.0"],
  ["org.jetbrains.kotlinx", "kotlinx-serialization-json", "1.11.0"],
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
  .join(
    "",
  )}</group><group targetFramework="net10.0-ios26.0" /><group targetFramework="net10.0-maccatalyst26.0" /></dependencies></metadata></package>`;

globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes("openiap-google/1.3.0/")) {
    return new Response(mavenPom(historicalGoogleDependencies));
  }
  if (
    url.includes("openiap-google-horizon/1.3.0/") ||
    url.includes("openiap-google-amazon/1.3.0/")
  ) {
    return new Response("", { status: 404 });
  }
  if (url.includes("openiap-google-horizon/")) {
    return new Response(mavenPom(horizonDependencies));
  }
  if (url.includes("openiap-google-amazon/")) {
    return new Response(mavenPom(amazonDependencies));
  }
  if (url.includes("openiap-google/")) {
    return new Response(mavenPom(googleDependencies));
  }
  if (url.includes("/kmp-iap/")) {
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

test("Commerce Protocol SBOMs support the historical manifest path", async () => {
  const root = mkdtempSync(resolve(tmpdir(), "openiap-commerce-sbom-"));
  const manifest = resolve(root, "specs/openiap-kit/package.json");
  mkdirSync(dirname(manifest), { recursive: true });
  writeFileSync(
    manifest,
    JSON.stringify({
      name: "openiap-commerce-protocol",
      version: "0.1.0",
      license: "MIT",
    }),
  );

  try {
    assert.equal(readComponentVersion("commerce-protocol", root), "0.1.0");
    const { document } = await generateSbom("commerce-protocol", {
      root,
      runGit: stubGit,
    });
    assert.equal(document.metadata.component.version, "0.1.0");
  } finally {
    rmSync(root, { recursive: true, force: true });
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

test("backfill repairs only exact guarded legacy SBOMs", () => {
  const published_at = "2026-08-11T00:00:00Z";
  const repairs = [
    [
      "google-3.3.0",
      "openiap-google-3.3.0.cdx.json",
      "sha256:704362aa07a458ccd76b1d0e89358c8db3d4e3ad4b6d8ff0521c90634597936b",
    ],
    [
      "google-3.3.1",
      "openiap-google-3.3.1.cdx.json",
      "sha256:f38d4c8cae6fedbbcac4790d7ee920f0880ce698aa63e27f36125297509890df",
    ],
    [
      "react-native-iap-16.3.0",
      "react-native-iap-16.3.0.cdx.json",
      "sha256:47cc1b6a63c27918df1fe15a83d6cc8aff5320a378f6f0f0454d0f542a1aa12a",
    ],
    [
      "react-native-iap-16.3.1",
      "react-native-iap-16.3.1.cdx.json",
      "sha256:807c9fb163aa18ed75bb471eed5c4eb62c7ef566c2686bd432e9da9ad01b2ef8",
    ],
    [
      "expo-iap-5.3.0",
      "expo-iap-5.3.0.cdx.json",
      "sha256:a5875e9cdd861387ee0887252f9009e848d85a1e62b245ba22972e9fbe83da70",
    ],
    [
      "expo-iap-5.3.1",
      "expo-iap-5.3.1.cdx.json",
      "sha256:ac221c082413c0a9df586028f86bed3d0d9a3915bcb1adea237064efeb5c9a6a",
    ],
    [
      "flutter-iap-10.3.0",
      "flutter_inapp_purchase-10.3.0.cdx.json",
      "sha256:52b11ca531fa7a8e5250bd6a83d6400412ad4cbb0f527f0b134fa515b0659c8e",
    ],
    [
      "flutter-iap-10.3.1",
      "flutter_inapp_purchase-10.3.1.cdx.json",
      "sha256:82f658347af445d497083b50c133867c87d2fd9426412aa6f7ff2ffe1b79e99e",
    ],
    [
      "godot-iap-3.3.0",
      "godot-iap-3.3.0.cdx.json",
      "sha256:23fd3f2a48c01d5d276b43adabcec1f98630bb0615d20c4ce94b59fb26b210e5",
    ],
    [
      "godot-iap-3.3.1",
      "godot-iap-3.3.1.cdx.json",
      "sha256:70724bcaf51c3ad79b2767f89606ab3f24f1543bfc804dcba0c8377541e0239b",
    ],
    [
      "kmp-iap-3.3.0",
      "kmp-iap-3.3.0.cdx.json",
      "sha256:533ffbcb5670d3826a508ecc74c49eea3da46d0a8a5f0672e00bb491857236dc",
    ],
    [
      "kmp-iap-3.3.1",
      "kmp-iap-3.3.1.cdx.json",
      "sha256:63ad3182a4a96690d385d701d77dd200676ee65d54d74ba6e960a796af6684e6",
    ],
    [
      "maui-iap-2.3.0",
      "OpenIap.Maui-2.3.0.cdx.json",
      "sha256:b87c308bf9e5bf9480fca2764190098103611b4df60658f218a50c9f9851baef",
    ],
    [
      "maui-iap-2.3.1",
      "OpenIap.Maui-2.3.1.cdx.json",
      "sha256:376b57fd4fa83bb0d67f6fe78b6b146b6e11c0952d3a56af19941814d8e06ed4",
    ],
  ];

  for (const [tag, name, expectedDigest] of repairs) {
    const repairDigest = repairSbomDigestForTag(tag);
    assert.equal(repairDigest, expectedDigest);
    assert.deepEqual(
      findMissingLatestSbomTags([
        {
          tag_name: tag,
          published_at,
          assets: [{ name, digest: repairDigest }],
        },
      ]),
      [tag],
    );
    assert.deepEqual(
      findMissingLatestSbomTags([
        {
          tag_name: tag,
          published_at,
          assets: [{ name, digest: `sha256:${"0".repeat(64)}` }],
        },
      ]),
      [],
    );
  }

  assert.equal(sbomRevisionForTag("google-3.3.0"), 2);
  assert.equal(sbomRevisionForTag("react-native-iap-16.3.0"), 2);
  assert.equal(sbomRevisionForTag("google-3.3.1"), 2);
  assert.equal(sbomRevisionForTag("expo-iap-5.3.1"), 2);
  assert.equal(sbomRevisionForTag("google-9.9.9"), 1);

  const [tag, name] = repairs[0];
  const repairDigest = repairSbomDigestForTag(tag);
  assert.deepEqual(
    findMissingLatestSbomTags([
      {
        tag_name: tag,
        published_at,
        assets: [
          { name, digest: `sha256:${"0".repeat(64)}` },
          { name: `${name}.replacement` },
        ],
      },
    ]),
    [tag],
  );
  assert.deepEqual(
    findMissingLatestSbomTags([
      {
        tag_name: "google-3.4.0",
        published_at: "2026-08-12T00:00:00Z",
        assets: [{ name: "openiap-google-3.4.0.cdx.json" }],
      },
      {
        tag_name: tag,
        published_at,
        assets: [{ name, digest: repairDigest }],
      },
    ]),
    [tag],
  );
});

test("latest release inventory fails closed when an asset is missing", () => {
  const published_at = "2026-08-11T00:00:00Z";
  const digest = `sha256:${"1".repeat(64)}`;
  assert.deepEqual(
    latestSbomAssets([
      {
        tag_name: "google-3.3.0",
        published_at,
        assets: [
          {
            name: "openiap-google-3.3.0.cdx.json",
            digest,
          },
        ],
      },
    ]),
    [
      {
        componentId: "google",
        version: "3.3.0",
        tag: "google-3.3.0",
        fileName: "openiap-google-3.3.0.cdx.json",
        digest,
      },
    ],
  );
  assert.throws(
    () =>
      latestSbomAssets([
        { tag_name: "google-3.3.0", published_at, assets: [] },
      ]),
    /Missing published SBOM asset/u,
  );
  assert.throws(() => latestSbomAssets([]), /No published component releases/u);
});

test("scheduled release inventory ignores unsupported prereleases", () => {
  const stableDigest = `sha256:${"1".repeat(64)}`;
  const prereleaseDigest = `sha256:${"2".repeat(64)}`;
  const releases = [
    {
      tag_name: "google-3.4.0-rc.1",
      published_at: "2026-08-12T00:00:00Z",
      prerelease: true,
      assets: [
        {
          name: "openiap-google-3.4.0-rc.1.cdx.json",
          digest: prereleaseDigest,
        },
      ],
    },
    {
      tag_name: "google-3.3.0",
      published_at: "2026-08-11T00:00:00Z",
      prerelease: false,
      assets: [{ name: "openiap-google-3.3.0.cdx.json", digest: stableDigest }],
    },
  ];

  assert.deepEqual(latestSbomAssets(releases), [
    {
      componentId: "google",
      version: "3.3.0",
      tag: "google-3.3.0",
      fileName: "openiap-google-3.3.0.cdx.json",
      digest: stableDigest,
    },
  ]);
  assert.deepEqual(
    findMissingLatestSbomTags(
      releases.map((release) => ({ ...release, assets: [] })),
    ),
    ["google-3.3.0"],
  );
});

test("historical release inventory retains every stable SBOM", () => {
  const digest = `sha256:${"3".repeat(64)}`;
  const releases = ["3.3.1", "3.3.0"].map((version, index) => ({
    tag_name: `google-${version}`,
    published_at: `2026-08-${12 - index}T00:00:00Z`,
    assets: [{ name: `openiap-google-${version}.cdx.json`, digest }],
  }));
  assert.deepEqual(
    publishedSbomAssets(releases).map(({ tag }) => tag),
    ["google-3.3.1", "google-3.3.0"],
  );
});

test("exact vulnerability scan copy omits version constraints", () => {
  const rootRef = "pkg:pub/example@1.0.0";
  const exactRef = "pkg:pub/exact@2.0.0";
  const constraintRef = "pkg:pub/ranged@%5E1.2.0";
  const dynamicRef = "pkg:maven/com.facebook.react/react-native@%2B";
  const prepared = prepareSbomForExactVulnerabilityScan({
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    components: [
      { "bom-ref": exactRef, name: "exact", version: "2.0.0" },
      {
        "bom-ref": constraintRef,
        name: "ranged",
        version: "^1.2.0",
        properties: [
          {
            name: "openiap:sbom:version-constraint",
            value: "^1.2.0",
          },
        ],
      },
      {
        "bom-ref": dynamicRef,
        name: "react-native",
        version: "+",
        properties: [
          {
            name: "openiap:sbom:version-constraint",
            value: "+",
          },
        ],
      },
    ],
    dependencies: [
      { ref: rootRef, dependsOn: [exactRef, constraintRef, dynamicRef] },
      { ref: exactRef, dependsOn: [] },
      { ref: constraintRef, dependsOn: [] },
      { ref: dynamicRef, dependsOn: [] },
    ],
    vulnerabilities: [
      { id: "OSV-1", affects: [{ ref: exactRef }, { ref: constraintRef }] },
      { id: "OSV-2", affects: [{ ref: constraintRef }] },
    ],
  });
  assert.equal(prepared.skippedConstraints, 2);
  assert.deepEqual(
    prepared.document.components.map((component) => component["bom-ref"]),
    [exactRef],
  );
  assert.deepEqual(prepared.document.dependencies, [
    { ref: rootRef, dependsOn: [exactRef] },
    { ref: exactRef, dependsOn: [] },
  ]);
  assert.deepEqual(prepared.document.vulnerabilities, [
    { id: "OSV-1", affects: [{ ref: exactRef }] },
  ]);
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
    assert.match(dispatchCommand, /--ref main/u, `${name} workflow ref`);
    assert.match(dispatchCommand, /-f tag="\$RELEASE_TAG"/u, `${name} tag`);
    assert.match(source, /actions: write/u, name);
  }
});

test("SBOM publication waits for registry propagation and repairs daily", () => {
  const source = readFileSync(
    resolve(repoRoot, ".github/workflows/sbom.yml"),
    "utf8",
  );
  assert.doesNotMatch(source, /^  release:$/mu);
  assert.match(
    source,
    /github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/u,
  );
  assert.match(source, /cron: "23 3 \* \* \*"/u);
  assert.match(source, /node-version: 24/u);
  assert.match(source, /name: Dispatch stable SBOM repairs/u);
  const backfillJob = source.slice(
    source.indexOf("  backfill:"),
    source.indexOf("  sbom:"),
  );
  assert.match(backfillJob, /actions\/setup-node@[0-9a-f]{40} # v7/u);
  assert.match(backfillJob, /node-version: 24/u);
  assert.match(source, /for attempt in \{1\.\.16\}/u);
  assert.match(source, /\[ "\$STATUS" -ne 75 \]/u);
  assert.doesNotMatch(source, /grep.+Published/u);
  assert.match(source, /A staged legacy repair will be reconciled/u);
  assert.match(source, /CURRENT_DIGEST.*!=.*REPAIR_DIGEST/u);
  const stagedUpload = source.indexOf(
    'gh release upload "$RELEASE_TAG" "$STAGED_FILE"',
  );
  const legacyDelete = source.indexOf(
    'gh api --method DELETE \\\n            "repos/$GITHUB_REPOSITORY/releases/assets/$CANONICAL_ASSET_ID"',
  );
  const stagedRename = source.indexOf(
    "\n          finalize_staged_asset\n",
    legacyDelete,
  );
  assert.ok(stagedUpload >= 0, "replacement must be uploaded before deletion");
  assert.ok(legacyDelete > stagedUpload, "legacy deletion must follow staging");
  assert.ok(stagedRename > legacyDelete, "staged asset must be finalized last");
  assert.match(source, /STAGED_DIGEST.*!=.*LOCAL_DIGEST/u);
  assert.match(source, /STAGED_NAME="\$SBOM_NAME\.replacement"/u);
  assert.match(source, /if \[ -z "\$CANONICAL_ASSET_ID" \]/u);
  assert.match(source, /STAGED_DIGEST" = "\$LOCAL_DIGEST/u);
  assert.match(source, /verify-file "\$EXISTING_FILE"/u);
  assert.match(source, /--digest "\$ASSET_DIGEST"/u);
  assert.match(source, /verify-file "\$SBOM_FILE"/u);
  assert.match(source, /install-security-tool\.sh cyclonedx/u);
  assert.match(source, /cyclonedx" validate/u);
  assert.match(source, /gh attestation verify "\$EXISTING_FILE"/u);
  assert.match(source, /gh attestation verify "\$PUBLISHED_FILE"/u);
  assert.match(source, /--cert-identity "\$CERT_IDENTITY"/u);
  assert.match(source, /refs\/heads\/\$DEFAULT_BRANCH/u);
  assert.doesNotMatch(source, /--signer-workflow/u);
  assert.match(source, /--deny-self-hosted-runners/u);
  assert.match(source, /GENERATOR_COMMIT: \$\{\{ github\.sha \}\}/u);
  assert.doesNotMatch(
    source,
    /GENERATOR_COMMIT=\$\(git rev-parse FETCH_HEAD\)/u,
  );
  const releaseCheckout = source.slice(
    source.indexOf("- name: Checkout the released commit"),
    source.indexOf("- name: Take the generator from the default branch"),
  );
  assert.match(releaseCheckout, /^[ \t]+fetch-depth: 0$/mu);
  const generatorCheckout = source.slice(
    source.indexOf("- name: Take the generator from the default branch"),
    source.indexOf("- name: Setup Node", source.indexOf("  sbom:")),
  );
  assert.match(
    generatorCheckout,
    /^[ \t]+git fetch --no-tags origin "\$GENERATOR_COMMIT"$/mu,
  );
  assert.doesNotMatch(
    generatorCheckout,
    /--(?:depth|deepen|shallow-since|shallow-exclude)(?:=|\s|$)/mu,
    "fetching the generator must not make the release checkout shallow",
  );
  assert.equal((source.match(/verify-attested-generator/gu) ?? []).length, 2);
  const attachIndex = source.indexOf("- name: Attach SBOM to the release");
  const publishedVerifyIndex = source.indexOf(
    "- name: Verify the published SBOM",
  );
  assert.ok(
    publishedVerifyIndex > attachIndex,
    "the uploaded release asset must be verified after publication",
  );
  const publishedVerifyBlock = source.slice(publishedVerifyIndex);
  assert.match(publishedVerifyBlock, /ASSET_COUNT.*-ne 1/u);
  assert.match(publishedVerifyBlock, /--digest "\$ASSET_DIGEST"/u);
  assert.match(
    publishedVerifyBlock,
    /--generator-commit "\$EXPECTED_GENERATOR_COMMIT"/u,
  );
  assert.match(publishedVerifyBlock, /for attempt in \{1\.\.12\}/u);
  assert.ok(
    source.indexOf('verify-file "$EXISTING_FILE"') <
      source.indexOf("A staged legacy repair will be reconciled"),
    "canonical verification must precede staged repair reconciliation",
  );
  assert.match(source, /Removed a stale staged repair after verifying/u);
  const changedDuringRepair = source.indexOf(
    "changed during repair; leaving the staged asset",
  );
  assert.ok(
    changedDuringRepair > stagedUpload,
    "a repair race must leave a staged marker for the next verified retry",
  );
  const finalRaceBlock = source.match(
    /if \[ "\$CURRENT_DIGEST" != "\$REPAIR_DIGEST" \]; then\n([\s\S]*?)\n\s+fi/u,
  )?.[1];
  assert.ok(finalRaceBlock, "final live-digest race guard is missing");
  assert.match(finalRaceBlock, /leaving the staged asset/u);
  assert.match(finalRaceBlock, /^\s+exit 1$/mu);
  assert.doesNotMatch(finalRaceBlock, /--method DELETE|STAGED_ASSET_ID/u);
  assert.doesNotMatch(
    source,
    /already corrected; any staged repair was removed/u,
  );
  assert.match(source, /persist-credentials: false/u);
  assert.match(source, /sleep 120/u);
  const provenanceIndex = source.indexOf(
    "- name: Verify release tag provenance",
  );
  const generateIndex = source.indexOf("- name: Generate CycloneDX SBOM");
  const attestIndex = source.indexOf("- name: Attest SBOM provenance");
  assert.match(source, /assert-release-tag\.mjs/u);
  assert.ok(
    provenanceIndex >= 0 &&
      provenanceIndex < generateIndex &&
      provenanceIndex < attestIndex,
    "release tag provenance must be verified before generation and attestation",
  );
});

test("published release SBOMs and the Kit image are rescanned read-only", () => {
  const source = readFileSync(
    resolve(repoRoot, ".github/workflows/security-rescan.yml"),
    "utf8",
  );
  const deploy = readFileSync(
    resolve(repoRoot, ".github/workflows/deploy-kit.yml"),
    "utf8",
  );
  const trivyExceptions = readFileSync(
    resolve(repoRoot, "packages/kit/.trivyignore.yaml"),
    "utf8",
  );
  const releaseJob = source.slice(
    source.indexOf("  release-sboms:"),
    source.indexOf("  kit-container:"),
  );

  assert.match(source, /cron: "41 5 \* \* 1"/u);
  assert.match(source, /node-version: 24/u);
  assert.match(source, /permissions:\n  contents: read/u);
  assert.doesNotMatch(source, /contents: write/u);
  assert.match(releaseJob, /fetch-depth: 0/u);
  assert.match(source, /missing-release-tags/u);
  assert.match(
    source,
    /Newest stable releases or approved legacy repairs are missing a verified SBOM/u,
  );
  assert.match(source, /published-release-assets/u);
  assert.match(source, /assert-release-tag\.mjs/u);
  assert.match(
    source,
    /"\$COMPONENT" "\$DEFAULT_BRANCH" "\$RELEASE_TAG" "\$VERSION"/u,
  );
  assert.match(source, /verify-file "\$SBOM_FILE"/u);
  assert.match(source, /gh attestation verify "\$SBOM_FILE"/u);
  assert.match(source, /verify-attested-generator/u);
  assert.match(source, /scan-copy "\$SBOM_FILE" "\$SCAN_FILE"/u);
  assert.match(source, /REPORT_RELEASE_DIR="\$REPORT_DIR\/\$RELEASE_TAG"/u);
  assert.match(source, /--dir "\$RELEASE_DIR"/u);
  assert.match(source, /-L="\$SCAN_FILE"/u);
  assert.match(source, /\(\.components \/\/ \[\]\) \| length > 0/u);
  assert.match(source, /SBOM declares no exact third-party components/u);
  assert.match(source, /install-security-tool\.sh osv-scanner/u);
  assert.match(source, /install-security-tool\.sh trivy/u);
  assert.doesNotMatch(source, /--ignore-unfixed/u);
  assert.match(source, /--severity HIGH,CRITICAL/u);
  assert.match(source, /--exit-on-eol 1/u);
  assert.match(deploy, /tags: openiap-kit:security-scan/u);
  assert.match(deploy, /install-security-tool\.sh trivy/u);
  for (const workflow of [deploy, source]) {
    assert.match(workflow, /--ignorefile packages\/kit\/\.trivyignore\.yaml/u);
  }
  assert.match(trivyExceptions, /id: CVE-2026-14456/u);
  assert.match(trivyExceptions, /pkg:deb\/debian\/libssl3@3\.0\.20-1~deb12u2/u);
  assert.match(trivyExceptions, /expired_at: 2026-09-14/u);
  assert.match(trivyExceptions, /statement: >-/u);
});

test("Google releases require complete credentials before version mutation", () => {
  const source = readFileSync(
    resolve(repoRoot, ".github/workflows/release-google.yml"),
    "utf8",
  );
  const preflightStart = source.indexOf(
    "- name: Preflight Maven Central publication",
  );
  const versionMutationStart = source.indexOf(
    "- name: Update version in openiap-versions.json",
  );
  const preflight = source.slice(preflightStart, versionMutationStart);

  assert.ok(preflightStart >= 0 && preflightStart < versionMutationStart);
  for (const flavor of ["HORIZON", "AMAZON", "PLAY"]) {
    assert.match(preflight, new RegExp(`\\$${flavor}_EXISTS" = "false"`, "u"));
  }
  for (const credential of [
    "MAVEN_CENTRAL_USERNAME",
    "MAVEN_CENTRAL_PASSWORD",
    "GPG_KEY_CONTENTS",
    "SIGNING_KEY_ID",
    "SIGNING_PASSWORD",
  ]) {
    assert.match(preflight, new RegExp(`\\$${credential}`, "u"));
  }
  assert.equal(
    source.match(
      /Complete Maven Central and signing credentials are required before creating the release tag/gu,
    )?.length,
    1,
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

test("published SBOM verification requires reproducible release evidence", () => {
  const generatorCommit = "1".repeat(40);
  const document = buildSbom({
    componentId: "react-native",
    version: "16.3.0",
    commit: stubCommit,
    generatorCommit,
    timestamp: "2026-01-01T00:00:00.000Z",
    dependencies: [],
  });
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  const digest = `sha256:${createHash("sha256").update(serialized).digest("hex")}`;

  assert.deepEqual(
    verifyPublishedSbom(serialized, {
      fileName: "/tmp/react-native-iap-16.3.0.cdx.json",
      releaseTag: "react-native-iap-16.3.0",
      releaseCommit: stubCommit,
      generatorCommit,
      digest,
    }),
    { componentId: "react-native", version: "16.3.0", generatorCommit },
  );

  const legacy = structuredClone(document);
  delete legacy.metadata.tools.components[0].properties;
  assert.throws(
    () =>
      verifyPublishedSbom(JSON.stringify(legacy), {
        fileName: "react-native-iap-16.3.0.cdx.json",
        releaseTag: "react-native-iap-16.3.0",
        releaseCommit: stubCommit,
      }),
    /openiap:generator:commit/u,
  );
  assert.throws(
    () =>
      verifyPublishedSbom(serialized, {
        fileName: "react-native-iap-16.3.0.cdx.json",
        releaseTag: "react-native-iap-16.3.0",
        releaseCommit: "2".repeat(40),
      }),
    /properties do not match/u,
  );
  assert.throws(
    () =>
      verifyPublishedSbom(serialized, {
        fileName: "react-native-iap-16.3.0.cdx.json",
        releaseTag: "react-native-iap-16.3.0",
        releaseCommit: stubCommit,
        digest: `sha256:${"0".repeat(64)}`,
      }),
    /digest/u,
  );
  assert.throws(
    () =>
      verifyPublishedSbom(serialized, {
        fileName: "react-native-iap-16.3.0.cdx.json",
        releaseTag: "react-native-iap-16.3.0",
        releaseCommit: stubCommit,
        digest: "",
      }),
    /Invalid published SBOM digest/u,
  );

  const missingAuthorName = structuredClone(document);
  missingAuthorName.metadata.authors = [{}];
  assert.throws(
    () =>
      verifyPublishedSbom(JSON.stringify(missingAuthorName), {
        fileName: "react-native-iap-16.3.0.cdx.json",
        releaseTag: "react-native-iap-16.3.0",
        releaseCommit: stubCommit,
      }),
    /author name/u,
  );

  const missingRootSupplier = structuredClone(document);
  delete missingRootSupplier.metadata.component.supplier;
  assert.throws(
    () =>
      verifyPublishedSbom(JSON.stringify(missingRootSupplier), {
        fileName: "react-native-iap-16.3.0.cdx.json",
        releaseTag: "react-native-iap-16.3.0",
        releaseCommit: stubCommit,
      }),
    /supplier name/u,
  );

  const incomplete = structuredClone(document);
  delete incomplete.components;
  assert.throws(
    () =>
      verifyPublishedSbom(JSON.stringify(incomplete), {
        fileName: "react-native-iap-16.3.0.cdx.json",
        releaseTag: "react-native-iap-16.3.0",
        releaseCommit: stubCommit,
      }),
    /components array/u,
  );
});

test("SBOM generator commit matches the verified workflow attestation", () => {
  const generatorCommit = "a".repeat(40);
  const document = buildSbom({
    componentId: "docs",
    version: "9.9.9",
    commit: stubCommit,
    generatorCommit,
    releaseTag: "docs-9.9.9",
    timestamp: "2026-01-01T00:00:00.000Z",
    dependencies: [],
  });
  const result = (
    commit,
    uri = "git+https://github.com/hyodotdev/openiap@refs/heads/main",
  ) => [
    {
      verificationResult: {
        statement: {
          predicate: {
            buildDefinition: {
              resolvedDependencies: [{ uri, digest: { gitCommit: commit } }],
            },
          },
        },
      },
    },
  ];
  const options = { repository: "hyodotdev/openiap", branch: "main" };

  assert.equal(
    verifySbomGeneratorAttestation(
      JSON.stringify(document),
      JSON.stringify(result(generatorCommit)),
      options,
    ),
    generatorCommit,
  );
  assert.throws(
    () =>
      verifySbomGeneratorAttestation(
        JSON.stringify(document),
        JSON.stringify(result("b".repeat(40))),
        options,
      ),
    /does not match attested source/u,
  );
  assert.throws(
    () =>
      verifySbomGeneratorAttestation(
        JSON.stringify(document),
        JSON.stringify(
          result(generatorCommit, "git+https://example.invalid/repo"),
        ),
        options,
      ),
    /found 0/u,
  );
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

test("declared Gradle inventories cover every runtime configuration", () => {
  for (const configuration of [
    "implementation",
    "api",
    "runtimeOnly",
    "compile",
  ]) {
    GRADLE_COORDINATE_PATTERN.lastIndex = 0;
    assert.equal(
      GRADLE_COORDINATE_PATTERN.exec(
        `${configuration} "example:runtime:1.0.0"`,
      )?.[1],
      "example:runtime:1.0.0",
    );
    GRADLE_PROJECT_PATTERN.lastIndex = 0;
    assert.equal(
      GRADLE_PROJECT_PATTERN.exec(`${configuration} project(":runtime")`)?.[1],
      ":runtime",
    );
  }
  GRADLE_COORDINATE_PATTERN.lastIndex = 0;
  const coordinateCall = GRADLE_COORDINATE_PATTERN.exec(
    'api("example:runtime:1.0.0")',
  );
  assert.equal(
    coordinateCall?.[1] ?? coordinateCall?.[2],
    "example:runtime:1.0.0",
  );
  GRADLE_PROJECT_PATTERN.lastIndex = 0;
  assert.equal(
    GRADLE_PROJECT_PATTERN.exec('api(project(":runtime"))')?.[1],
    ":runtime",
  );
  GRADLE_COORDINATE_PATTERN.lastIndex = 0;
  const singleQuoted = GRADLE_COORDINATE_PATTERN.exec(
    "api 'example:runtime:1.0.0'",
  );
  assert.equal(singleQuoted?.[1] ?? singleQuoted?.[2], "example:runtime:1.0.0");
  for (const configuration of ["compileOnly", "testImplementation"]) {
    GRADLE_COORDINATE_PATTERN.lastIndex = 0;
    assert.equal(
      GRADLE_COORDINATE_PATTERN.test(
        `${configuration} "example:build-only:1.0.0"`,
      ),
      false,
    );
  }
});

test("an unmodelled Gradle coordinate fails instead of silently vanishing", (t) => {
  assert.throws(
    () => parseMavenCoordinate("com.example:lib:$unknownVersion"),
    /Unresolved Maven coordinate/u,
  );
  assert.throws(
    () => parseMavenCoordinate("com.example:lib:1.0.0:sources"),
    /Unsupported Maven coordinate/u,
  );

  const scratch = mkdtempSync(resolve(tmpdir(), "openiap-gradle-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'dependencies { implementation(group = "com.example", name = "lib", version = "1.0.0") }\n',
  );
  assert.throws(
    () => extractGradle(scratch, { manifest: "build.gradle.kts" }),
    /Unsupported Gradle dependency declaration/u,
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    "dependencies { customRuntime(libs.example) }\n",
  );
  assert.throws(
    () => extractGradle(scratch, { manifest: "build.gradle.kts" }),
    /Unsupported version-catalog dependency/u,
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'dependencies { implementation(project(":unexpected")) }\n',
  );
  assert.throws(
    () => extractGradle(scratch, { manifest: "build.gradle.kts" }),
    /Unsupported Gradle dependency declaration/u,
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'dependencies { implementation(project(":openiap")) }\n',
  );
  assert.throws(
    () => extractGradle(scratch, { manifest: "build.gradle.kts" }),
    /lacks its published fallback/u,
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'dependencies { customRuntime(group = "com.example", name = "lib", version = "1.0.0") }\n',
  );
  assert.throws(
    () => extractGradle(scratch, { manifest: "build.gradle.kts" }),
    /Unclassified Gradle dependency configuration/u,
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'dependencies { if (enabled == true) customRuntime("com.example:lib:1.0.0") }\n',
  );
  assert.throws(
    () => extractGradle(scratch, { manifest: "build.gradle.kts" }),
    /Unclassified Gradle dependency configuration/u,
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'dependencies { while (enabled) { implementation("real:dependency:2.0.0") } }\n',
  );
  assert.deepEqual(
    extractGradle(scratch, { manifest: "build.gradle.kts" }).map(
      (entry) => entry.name,
    ),
    ["real:dependency"],
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    "android { compileSdk(libs.versions.compileSdk.get()) }\n" +
      'dependencies { // implementation("fake:comment:1.0.0")\n' +
      '  implementation("real:dependency:2.0.0")\n}\n',
  );
  assert.deepEqual(extractGradle(scratch, { manifest: "build.gradle.kts" }), [
    {
      name: "real:dependency",
      purl: "pkg:maven/real/dependency@2.0.0",
      version: "2.0.0",
    },
  ]);
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'buildscript { dependencies { classpath("build:plugin:1.0.0") } }\n' +
      'dependencies { implementation("real:dependency:2.0.0") }\n',
  );
  assert.deepEqual(
    extractGradle(scratch, { manifest: "build.gradle.kts" }).map(
      (entry) => entry.name,
    ),
    ["real:dependency"],
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'subprojects { dependencies { implementation("hidden:dependency:1.0.0") } }\n' +
      'dependencies { implementation("real:dependency:2.0.0") }\n',
  );
  assert.throws(
    () => extractGradle(scratch, { manifest: "build.gradle.kts" }),
    /Unsupported nested dependencies block/u,
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'dependencies { implementation("real:dependency:2.0.0") { exclude(group = "fake") } }\n',
  );
  assert.deepEqual(
    extractGradle(scratch, { manifest: "build.gradle.kts" }).map(
      (entry) => entry.name,
    ),
    ["real:dependency"],
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'dependencies { customContainer("value") { implementation("hidden:dependency:1.0.0") } }\n',
  );
  assert.throws(
    () => extractGradle(scratch, { manifest: "build.gradle.kts" }),
    /Unclassified Gradle dependency configuration/u,
  );
  writeFileSync(
    resolve(scratch, "build.gradle.kts"),
    'dependencies { constraints { implementation("constraint:only:3.0.0") }\n' +
      '  implementation("real:dependency:2.0.0")\n}\n',
  );
  assert.deepEqual(
    extractGradle(scratch, { manifest: "build.gradle.kts" }).map(
      (entry) => entry.name,
    ),
    ["real:dependency"],
  );
});

test("published metadata matches the consumer-visible artifacts", async () => {
  const google = await generateSbom("google", {
    root: repoRoot,
    runGit: stubGit,
  });
  const googleNames = google.document.components.map((entry) => entry.name);
  assert.equal(google.directCount, 18);
  assert.ok(googleNames.includes("org.jetbrains.kotlin:kotlin-stdlib"));
  assert.ok(
    googleNames.includes(
      "com.meta.horizon.billingclient.api:horizon-billing-compatibility",
    ),
  );
  assert.ok(googleNames.includes("com.amazon.device:amazon-appstore-sdk"));
  assert.ok(
    googleNames.includes("io.github.hyochan.openiap:openiap-google-horizon"),
  );
  assert.ok(
    googleNames.includes("io.github.hyochan.openiap:openiap-google-amazon"),
  );

  const kmp = await generateSbom("kmp", { root: repoRoot, runGit: stubGit });
  const kmpNames = kmp.document.components.map((entry) => entry.name);
  assert.equal(kmp.directCount, 8);
  assert.ok(kmpNames.includes("openiap"));
  assert.ok(kmpNames.includes("io.github.hyochan.openiap:openiap-google"));
  assert.ok(
    kmpNames.includes("io.github.hyochan.openiap:openiap-google-horizon"),
  );
  assert.ok(
    kmpNames.includes("io.github.hyochan.openiap:openiap-google-amazon"),
  );
  assert.ok(kmpNames.includes("org.jetbrains.kotlin:kotlin-stdlib"));
  assert.ok(kmpNames.includes("org.jetbrains.kotlinx:kotlinx-datetime"));
  assert.ok(!kmpNames.some((name) => name.endsWith("-jvm")));

  const maui = await generateSbom("maui", { root: repoRoot, runGit: stubGit });
  assert.equal(maui.directCount, 24);
  assert.ok(maui.document.components.some((entry) => entry.name === "openiap"));
  assert.ok(
    maui.document.components.some(
      (entry) => entry.name === "io.github.hyochan.openiap:openiap-google",
    ),
  );
  assert.ok(
    !maui.document.components.some((entry) =>
      entry.name.includes("Serialization"),
    ),
  );
  for (const [name] of mauiDependencies) {
    const dependency = maui.document.components.find(
      (entry) => entry.name === name,
    );
    assert.equal(dependency?.scope, "optional", name);
    assert.deepEqual(
      Object.fromEntries(
        dependency.properties.map((property) => [
          property.name,
          property.value,
        ]),
      ),
      {
        "openiap:platform": "android",
        "openiap:target-framework": "net10.0-android36.0",
      },
      name,
    );
  }
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
      parseNugetNuspec(
        '<package><dependencies><group targetFramework="net10.0-android36.0">' +
          '<dependency id="A" version="1.0.0" /></group>' +
          '<dependency id="B" version="2.0.0" /></dependencies></package>',
        { url: "fixture.nuspec" },
      ),
    /Mixed grouped and ungrouped NuGet dependencies/u,
  );
  assert.deepEqual(
    parseNugetNuspec(
      '<package><dependencies><!-- <dependency id="Fake" version="1.0.0" /> -->' +
        '<group targetFramework="net10.0-ios26.0" /></dependencies></package>',
      { url: "fixture.nuspec" },
    ),
    [],
  );
  for (const malformedComment of [
    "<package><dependencies><!-- nested <!-- -->" +
      '<dependency id="Fake" version="1.0.0" /></dependencies></package>',
    "<package><dependencies><!-- unterminated</dependencies></package>",
    '<package><dependencies>--><dependency id="Fake" version="1.0.0" />' +
      "</dependencies></package>",
  ]) {
    assert.throws(
      () =>
        parseNugetNuspec(malformedComment, {
          url: "fixture.nuspec",
        }),
      /Invalid XML comment/u,
    );
  }
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
  const pubSource = COMPONENTS.flutter.source.sources.find(
    (source) => source.kind === "pub",
  );
  const dependencies = extractPub(repoRoot, pubSource);
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

test("framework SBOMs include every shipped native runtime contract", async () => {
  const conformance = await generateSbom("conformance", {
    root: repoRoot,
    runGit: stubGit,
  });
  assert.deepEqual(conformance.document.components, []);

  const openIapNativeNames = [
    "openiap",
    "io.github.hyochan.openiap:openiap-google",
    "io.github.hyochan.openiap:openiap-google-amazon",
    "io.github.hyochan.openiap:openiap-google-horizon",
  ];
  const expectedByComponent = {
    expo: [...openIapNativeNames, "ExpoModulesCore", "OnsideKit"],
    flutter: [
      ...openIapNativeNames,
      "Flutter",
      "androidx.annotation:annotation",
      "org.jetbrains.kotlinx:kotlinx-coroutines-android",
    ],
    "react-native": [
      ...openIapNativeNames,
      "React-Core",
      "React-jsi",
      "React-callinvoker",
      "com.facebook.react:react-native",
      "com.google.android.gms:play-services-base",
      "org.jetbrains.kotlinx:kotlinx-coroutines-android",
      "react-native-nitro-modules",
    ],
  };
  for (const [componentId, expectedNames] of Object.entries(
    expectedByComponent,
  )) {
    const { document } = await generateSbom(componentId, {
      root: repoRoot,
      runGit: stubGit,
    });
    const actualNames = new Set(
      document.components.map((component) => component.name),
    );
    for (const expectedName of expectedNames) {
      assert.ok(
        actualNames.has(expectedName),
        `${componentId}: ${expectedName}`,
      );
    }
    assert.ok(
      document.metadata.component.properties.some(
        (property) =>
          property.name === "openiap:sbom:aggregation" &&
          property.value === "release-variants",
      ),
      componentId,
    );
  }

  const expo = await generateSbom("expo", { root: repoRoot, runGit: stubGit });
  const onside = expo.document.components.find(
    (component) => component.name === "OnsideKit",
  );
  assert.equal(onside.scope, "optional");
  assert.ok(
    onside.properties.some(
      (property) =>
        property.name === "openiap:dependency:optional" &&
        property.value === "true",
    ),
  );

  const godot = await generateSbom("godot", {
    root: repoRoot,
    runGit: stubGit,
  });
  for (const name of ["SwiftGodotRuntime", "SwiftGodotRuntime-macOS"]) {
    const binary = godot.document.components.find(
      (component) => component.name === name,
    );
    assert.match(binary.version, /^[0-9a-f]{64}$/u);
    assert.deepEqual(binary.hashes, [
      { alg: "SHA-256", content: binary.version },
    ]);
    assert.equal(binary.supplier.name, "Miguel de Icaza");
    assert.equal(binary.licenses[0].license.id, "MIT");
  }

  const kmp = await generateSbom("kmp", { root: repoRoot, runGit: stubGit });
  for (const component of kmp.document.components.filter(
    (entry) =>
      entry.name === "openiap" ||
      entry.name.startsWith("io.github.hyochan.openiap:openiap-google"),
  )) {
    assert.equal(component.supplier.name, "OpenIAP", component.name);
    assert.equal(component.licenses[0].license.id, "MIT", component.name);
  }

  for (const name of ["ExpoModulesCore", "OnsideKit"]) {
    const component = expo.document.components.find(
      (entry) => entry.name === name,
    );
    assert.equal(component.licenses[0].license.id, "MIT", name);
    assert.ok(component.supplier.name, name);
  }

  const reactNative = await generateSbom("react-native", {
    root: repoRoot,
    runGit: stubGit,
  });
  const playServicesBase = reactNative.document.components.find(
    (component) =>
      component.name === "com.google.android.gms:play-services-base",
  );
  assert.equal(playServicesBase.supplier.name, "Google LLC");
  assert.deepEqual(playServicesBase.licenses, [
    { license: { name: "Android Software Development Kit License" } },
  ]);
});

test("declared native dependency inventory fails closed on manifest drift", async (t) => {
  const scratch = mkdtempSync(resolve(tmpdir(), "openiap-declared-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  writeFileSync(resolve(scratch, "manifest.gradle"), "dependencies {}\n");

  await assert.rejects(
    () =>
      extractDirectDependencies(scratch, {
        kind: "declared",
        manifest: "manifest.gradle",
        dependencies: [
          {
            ecosystem: "maven",
            group: "example",
            artifact: "runtime",
            version: "1.0.0",
            marker: "example:runtime:",
          },
        ],
      }),
    /Missing dependency declaration/u,
  );

  const pattern = /^\s*implementation\s+"([^"]+)"/gmu;
  writeFileSync(
    resolve(scratch, "manifest.gradle"),
    '// implementation "example:runtime:1.0.0"\n',
  );
  await assert.rejects(
    () =>
      extractDirectDependencies(scratch, {
        kind: "declared",
        manifest: "manifest.gradle",
        inventories: [
          {
            file: "manifest.gradle",
            pattern,
            expected: ["example:runtime:1.0.0"],
          },
        ],
        dependencies: [],
      }),
    /Unmodelled dependency declaration/u,
  );

  writeFileSync(
    resolve(scratch, "manifest.gradle"),
    'implementation "example:runtime:1.0.0"\n' +
      'implementation "example:unmodelled:2.0.0"\n',
  );
  await assert.rejects(
    () =>
      extractDirectDependencies(scratch, {
        kind: "declared",
        manifest: "manifest.gradle",
        inventories: [
          {
            file: "manifest.gradle",
            pattern,
            expected: ["example:runtime:1.0.0"],
          },
        ],
        dependencies: [],
      }),
    /example:unmodelled:2\.0\.0/u,
  );
});

test("declared property versions and aggregate scopes are order independent", async (t) => {
  const scratch = mkdtempSync(resolve(tmpdir(), "openiap-declared-merge-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  writeFileSync(resolve(scratch, "required.txt"), "dependency required\n");
  writeFileSync(resolve(scratch, "optional.txt"), "dependency optional\n");
  writeFileSync(
    resolve(scratch, "gradle.properties"),
    "  runtimeVersion : 1.0.0\n",
  );

  const dependency = (optional) => ({
    ecosystem: "maven",
    group: "example",
    artifact: "runtime",
    version: { file: "gradle.properties", property: "runtimeVersion" },
    marker: `dependency ${optional ? "optional" : "required"}`,
    optional,
  });
  const source = (optional) => ({
    kind: "declared",
    manifest: optional ? "optional.txt" : "required.txt",
    dependencies: [dependency(optional)],
  });
  for (const sources of [
    [source(true), source(false)],
    [source(false), source(true)],
  ]) {
    const [entry] = await extractDirectDependencies(scratch, {
      kind: "aggregate",
      sources,
    });
    assert.equal(entry.version, "1.0.0");
    assert.equal(entry.scope, "required");
    assert.equal(
      (entry.properties ?? []).some(
        (property) => property.name === "openiap:dependency:optional",
      ),
      false,
    );
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

const pubFetcher = (tags, publisherId) => async (url) =>
  url.includes("/score")
    ? JSON.stringify({ tags })
    : publisherId === null
      ? null
      : JSON.stringify({ publisherId });

const lookupPub = (tags, publisherId = "dart.dev") =>
  generatorTesting.lookupComponentMetadata(
    { name: "http", version: "^1.2.0", purl: "pkg:pub/http@%5E1.2.0" },
    { fetcher: pubFetcher(tags, publisherId) },
  );

test("pub.dev licences come from score tags that resolve to an SPDX id", async () => {
  // pub.dev states the licence as a score tag rather than a metadata field,
  // alongside classification tags that are not licences.
  assert.deepEqual(
    await lookupPub([
      "license:bsd-3-clause",
      "license:fsf-libre",
      "license:osi-approved",
    ]),
    { license: { license: { id: "BSD-3-Clause" } }, supplier: "dart.dev" },
  );
});

test("a pub.dev tag that is not a licence never becomes one", async () => {
  // osi-approved and fsf-libre resolve to no known SPDX id, so they drop out
  // on their own rather than needing a list of tags to ignore.
  assert.deepEqual(
    await lookupPub(["license:osi-approved", "license:fsf-libre"]),
    {
      license: undefined,
      supplier: "dart.dev",
    },
  );
  assert.deepEqual(await lookupPub([]), {
    license: undefined,
    supplier: "dart.dev",
  });
});

test("two declared pub.dev licences yield none rather than a guess", async () => {
  assert.deepEqual(await lookupPub(["license:mit", "license:bsd-3-clause"]), {
    license: undefined,
    supplier: "dart.dev",
  });
  // The same licence stated twice is still one licence.
  assert.deepEqual(await lookupPub(["license:mit", "license:mit"]), {
    license: { license: { id: "MIT" } },
    supplier: "dart.dev",
  });
});

test("a pub.dev publisher lookup failure does not discard the licence", async () => {
  assert.deepEqual(await lookupPub(["license:mit"], null), {
    license: { license: { id: "MIT" } },
    supplier: undefined,
  });
});

const lookupNuspec = (body) =>
  generatorTesting.lookupComponentMetadata(
    { name: "X", version: "1.0.0", purl: "pkg:nuget/X@1.0.0" },
    {
      fetcher: async () => `<package><metadata>${body}</metadata></package>`,
    },
  );

test("a nuspec copyright is recorded rather than discarded", async () => {
  const found = await lookupNuspec(
    '<license type="expression">MIT</license>' +
      "<copyright>Copyright \u00a9 Example 2026</copyright>",
  );
  assert.equal(found.copyright, "Copyright \u00a9 Example 2026");
  assert.deepEqual(found.license, { license: { id: "MIT" } });
});

test("a licence url with no SPDX id is recorded as a url, not dropped", async () => {
  assert.deepEqual(
    (
      await lookupNuspec(
        "<licenseUrl>https://example.test/LICENSE</licenseUrl>",
      )
    ).license,
    { license: { url: "https://example.test/LICENSE" } },
  );
});

test("NuGet's deprecated licence-url placeholder states nothing", async () => {
  // Recording it would assert terms that the placeholder explicitly does not
  // carry. The copyright beside it is still real and is kept.
  const found = await lookupNuspec(
    '<license type="file">LICENSE.md</license>' +
      "<licenseUrl>https://aka.ms/deprecateLicenseUrl</licenseUrl>" +
      "<copyright>\u00a9 Microsoft Corporation.</copyright>",
  );
  assert.equal(found.license, undefined);
  assert.equal(found.copyright, "\u00a9 Microsoft Corporation.");
});

test("registry metadata never guesses suppliers or replaces reviewed values", async () => {
  const lookedUp = await generatorTesting.lookupComponentMetadata(
    {
      name: "com.google.android.gms:play-services-base",
      version: "18.10.0",
      purl: "pkg:maven/com.google.android.gms/play-services-base@18.10.0",
    },
    {
      fetcher: async () =>
        "<project><licenses><license><name>Android Software Development Kit License</name></license></licenses></project>",
    },
  );
  assert.deepEqual(lookedUp, {
    license: {
      license: { name: "Android Software Development Kit License" },
    },
    supplier: undefined,
  });

  const reviewed = {
    name: "com.google.android.gms:play-services-base",
    version: "18.10.0",
    purl: "pkg:maven/com.google.android.gms/play-services-base@18.10.0",
    licenses: [
      { license: { name: "Android Software Development Kit License" } },
    ],
    supplier: "Google LLC",
  };
  const [enriched] = await generatorTesting.attachRegistryMetadata([reviewed], {
    lookup: async () => ({
      license: { license: { id: "MIT" } },
      supplier: "com.google.android.gms",
    }),
  });
  assert.deepEqual(enriched, reviewed);
});

test("registry license lookup is opt-in while reviewed metadata stays offline", async () => {
  const { document } = await generateSbom("google", {
    root: repoRoot,
    runGit: stubGit,
  });
  assert.ok(document.components.length > 0);
  assert.equal(
    document.components.find(
      (component) => component.name === "org.jetbrains.kotlin:kotlin-stdlib",
    ).licenses,
    undefined,
  );
  for (const name of [
    "io.github.hyochan.openiap:openiap-google-horizon",
    "io.github.hyochan.openiap:openiap-google-amazon",
  ]) {
    const component = document.components.find((entry) => entry.name === name);
    assert.equal(component.licenses[0].license.id, "MIT", name);
    assert.equal(component.supplier.name, "OpenIAP", name);
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

test("each released component carries a package-local licence", () => {
  for (const [componentId, component] of Object.entries(COMPONENTS)) {
    const directory = resolve(repoRoot, component.directory);
    assert.ok(
      existsSync(resolve(directory, "LICENSE")) ||
        existsSync(resolve(directory, "LICENSE.md")),
      `${componentId} has no package-local licence`,
    );
  }
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

test("coverage continuity reports mid-train gaps the latest-only scan misses", () => {
  // findMissingLatestSbomTags stops at the newest release per component, so a
  // gap behind it becomes permanent. This is that gap.
  const releases = [
    {
      tag_name: "godot-iap-3.3.0",
      published_at: "2026-01-01T00:00:00Z",
      draft: false,
      prerelease: false,
      assets: [{ name: "godot-iap-3.3.0.cdx.json" }],
    },
    {
      tag_name: "godot-iap-3.4.0",
      published_at: "2026-02-01T00:00:00Z",
      draft: false,
      prerelease: false,
      assets: [],
    },
    {
      tag_name: "godot-iap-3.5.0",
      published_at: "2026-03-01T00:00:00Z",
      draft: false,
      prerelease: false,
      assets: [{ name: "godot-iap-3.5.0.cdx.json" }],
    },
  ];
  assert.deepEqual(findMissingLatestSbomTags(releases), []);
  assert.deepEqual(findMissingCoverageTags(releases), ["godot-iap-3.4.0"]);
});

test("releases before a component's coverage floor are not gaps", () => {
  const releases = [
    {
      tag_name: "godot-iap-3.2.0",
      published_at: "2025-12-01T00:00:00Z",
      draft: false,
      prerelease: false,
      assets: [],
    },
    {
      tag_name: "godot-iap-3.3.0",
      published_at: "2026-01-01T00:00:00Z",
      draft: false,
      prerelease: false,
      assets: [{ name: "godot-iap-3.3.0.cdx.json" }],
    },
  ];
  assert.deepEqual(findMissingCoverageTags(releases), []);
});

test("a component with no floor entry is covered from its first release", () => {
  // conformance and commerce-protocol shipped an SBOM with their first
  // release, so they carry no exemption — and neither does anything added
  // later, which is what stops a new component from being silently skipped.
  assert.equal(SBOM_COVERAGE_FLOOR.conformance, undefined);
  assert.equal(SBOM_COVERAGE_FLOOR["commerce-protocol"], undefined);
  const releases = [
    {
      tag_name: "openiap-conformance-1.0.0",
      published_at: "2026-01-01T00:00:00Z",
      draft: false,
      prerelease: false,
      assets: [],
    },
  ];
  assert.deepEqual(findMissingCoverageTags(releases), [
    "openiap-conformance-1.0.0",
  ]);
});

test("a floor missing from the release list fails loudly", () => {
  // A truncated page would otherwise narrow the scan in silence.
  assert.throws(
    () =>
      findMissingCoverageTags([
        {
          tag_name: "godot-iap-3.4.0",
          published_at: "2026-02-01T00:00:00Z",
          draft: false,
          prerelease: false,
          assets: [{ name: "godot-iap-3.4.0.cdx.json" }],
        },
        {
          tag_name: "godot-iap-3.5.0",
          published_at: "2026-03-01T00:00:00Z",
          draft: false,
          prerelease: false,
          assets: [{ name: "godot-iap-3.5.0.cdx.json" }],
        },
      ]),
    /coverage floor godot-iap-3\.3\.0 for godot is not in the release list/,
  );
});

test("every coverage floor names a real component", () => {
  for (const componentId of Object.keys(SBOM_COVERAGE_FLOOR)) {
    assert.ok(
      generatorTesting.COMPONENTS[componentId],
      `${componentId} is not a released component`,
    );
  }
});
