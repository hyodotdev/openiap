#!/usr/bin/env node

/**
 * Generate a CycloneDX SBOM for one releasable OpenIAP component.
 *
 * The component list, its version source, and its release tag are read from the
 * existing release SSOT (`release-branch-policy.mjs` and
 * `assert-release-tag.mjs`) so a component cannot be released without also
 * being describable here, and a version can never disagree with the release
 * that produced it.
 *
 * Output is deterministic for a given (component, version, commit): the
 * document timestamp comes from the commit, and the serial number is derived
 * from the release identity rather than randomly generated. Re-running this on
 * the same commit reproduces the same bytes.
 *
 * Usage:
 *   node scripts/generate-sbom.mjs <component> [--output-dir DIR]
 *                                              [--commit SHA]
 *                                              [--resolved FILE]
 *                                              [--stdout]
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PACKAGE_CONFIG } from "./assert-release-tag.mjs";
import { validateVersion, versionSources } from "./release-branch-policy.mjs";
import {
  extractDirectDependencies,
  mergeResolved,
} from "./sbom-dependencies.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REPOSITORY_URL = "https://github.com/hyodotdev/openiap";
const SUPPLIER = {
  name: "OpenIAP",
  url: ["https://openiap.dev"],
};
const GENERATOR_NAME = "openiap-sbom-generator";
const GENERATOR_VERSION = "1.0.0";
const SPEC_VERSION = "1.6";

/**
 * SBOM-specific metadata per releasable component.
 *
 * `versionSources` (release SSOT) supplies the label and version; this table
 * adds only what an SBOM needs on top: how the component is distributed, and
 * where its runtime dependencies are declared.
 */
const COMPONENTS = {
  apple: {
    sbomName: "openiap-apple",
    type: "library",
    purl: (version) => `pkg:cocoapods/openiap@${version}`,
    distribution: (version) => `https://cocoapods.org/pods/openiap`,
    directory: "packages/apple",
    // Package.swift declares `dependencies: []`; StoreKit is an OS framework,
    // not a distributed package, so it is not an SBOM component.
    source: { kind: "swift", manifest: "packages/apple/Package.swift" },
  },
  conformance: {
    sbomName: "openiap-conformance",
    type: "library",
    purl: (version) => `pkg:npm/openiap-conformance@${version}`,
    distribution: (version) =>
      `https://www.npmjs.com/package/openiap-conformance/v/${version}`,
    directory: "packages/conformance",
    source: { kind: "npm", manifest: "packages/conformance/package.json" },
  },
  docs: {
    sbomName: "openiap-spec",
    type: "data",
    purl: (version) => `pkg:generic/openiap-spec@${version}`,
    distribution: (version) => `${REPOSITORY_URL}/releases/tag/docs-${version}`,
    directory: "packages/gql",
    // The spec release publishes the GraphQL contract and generated types.
    // It carries no third-party runtime code.
    source: { kind: "none" },
  },
  expo: {
    sbomName: "expo-iap",
    type: "library",
    purl: (version) => `pkg:npm/expo-iap@${version}`,
    distribution: (version) =>
      `https://www.npmjs.com/package/expo-iap/v/${version}`,
    directory: "libraries/expo-iap",
    source: { kind: "npm", manifest: "libraries/expo-iap/package.json" },
  },
  flutter: {
    sbomName: "flutter_inapp_purchase",
    type: "library",
    purl: (version) => `pkg:pub/flutter_inapp_purchase@${version}`,
    distribution: (version) =>
      `https://pub.dev/packages/flutter_inapp_purchase/versions/${version}`,
    directory: "libraries/flutter_inapp_purchase",
    source: {
      kind: "pub",
      manifest: "libraries/flutter_inapp_purchase/pubspec.yaml",
    },
    resolver: "flutter pub deps --json",
  },
  godot: {
    sbomName: "godot-iap",
    type: "library",
    purl: (version) => `pkg:generic/godot-iap@${version}`,
    distribution: (version) =>
      `${REPOSITORY_URL}/releases/tag/godot-iap-${version}`,
    directory: "libraries/godot-iap",
    source: {
      kind: "gradle",
      manifest: "libraries/godot-iap/android/build.gradle.kts",
      // The plugin derives these at configuration time from sibling modules.
      externalLocals: {
        openiapGoogleVersion: { file: "openiap-versions.json", json: "google" },
        googleCoroutinesVersion: {
          file: "packages/google/openiap/build.gradle.kts",
          gradleLocal: "coroutinesVersion",
        },
      },
    },
    resolver: "gradlew :dependencies",
  },
  google: {
    sbomName: "openiap-google",
    type: "library",
    purl: (version) =>
      `pkg:maven/io.github.hyochan.openiap/openiap-google@${version}`,
    distribution: (version) =>
      `https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google/${version}`,
    directory: "packages/google",
    source: {
      kind: "gradle",
      manifest: "packages/google/openiap/build.gradle.kts",
    },
    resolver: "gradlew :openiap:dependencies",
  },
  kmp: {
    sbomName: "kmp-iap",
    type: "library",
    purl: (version) => `pkg:maven/io.github.hyochan/kmp-iap@${version}`,
    distribution: (version) =>
      `https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap/${version}`,
    directory: "libraries/kmp-iap",
    source: {
      kind: "gradle-catalog",
      manifest: "libraries/kmp-iap/library/build.gradle.kts",
      catalog: "libraries/kmp-iap/gradle/libs.versions.toml",
    },
    resolver: "gradlew :library:dependencies",
  },
  maui: {
    sbomName: "OpenIap.Maui",
    type: "library",
    purl: (version) => `pkg:nuget/OpenIap.Maui@${version}`,
    distribution: (version) =>
      `https://www.nuget.org/packages/OpenIap.Maui/${version}`,
    directory: "libraries/maui-iap",
    source: {
      kind: "nuget",
      manifest: "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
      propertyFiles: [
        "libraries/maui-iap/Directory.Build.props",
        "libraries/maui-iap/src/Directory.Build.props",
      ],
    },
    resolver: "dotnet list package --include-transitive",
  },
  "react-native": {
    sbomName: "react-native-iap",
    type: "library",
    purl: (version) => `pkg:npm/react-native-iap@${version}`,
    distribution: (version) =>
      `https://www.npmjs.com/package/react-native-iap/v/${version}`,
    directory: "libraries/react-native-iap",
    source: {
      kind: "npm",
      manifest: "libraries/react-native-iap/package.json",
    },
  },
};

export function listComponentIds() {
  return Object.keys(COMPONENTS).sort();
}

function defaultRunGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function readComponentVersion(componentId, root = repoRoot) {
  const source = versionSources[componentId];
  if (!source) {
    throw new Error(`Unknown release component: ${componentId}`);
  }
  return validateVersion(source.read(root), source.label);
}

export function releaseTagFor(componentId, version) {
  // `docs` releases the spec and is absent from the release-tag SSOT, which
  // only covers packages with their own version file.
  if (componentId === "docs") return `docs-${version}`;
  const tags = PACKAGE_CONFIG[componentId]?.tags(version);
  if (!tags?.length) {
    throw new Error(`No release tag pattern for component: ${componentId}`);
  }
  return tags[0];
}

export function sbomFileName(componentId, version) {
  return `${COMPONENTS[componentId].sbomName}-${version}.cdx.json`;
}

/**
 * Longest-prefix first, so `google-` cannot swallow a tag that a more specific
 * component owns. Apple publishes a bare semver tag and is matched last.
 */
const TAG_PREFIXES = [
  ["openiap-conformance-", "conformance"],
  ["react-native-iap-", "react-native"],
  ["flutter-iap-", "flutter"],
  ["godot-iap-", "godot"],
  ["expo-iap-", "expo"],
  ["maui-iap-", "maui"],
  ["kmp-iap-", "kmp"],
  ["google-v", "google"],
  ["google-", "google"],
  ["apple-v", "apple"],
  ["docs-", "docs"],
].sort((left, right) => right[0].length - left[0].length);

/**
 * Map a published release tag back to the component that produced it.
 *
 * Returns null for tags this repository does not release components under, so
 * the workflow can skip them rather than fail.
 */
export function componentFromTag(tag) {
  const normalized = String(tag ?? "").trim();
  if (!normalized) return null;

  for (const [prefix, componentId] of TAG_PREFIXES) {
    if (!normalized.startsWith(prefix)) continue;
    const version = normalized.slice(prefix.length);
    if (!/^\d+\.\d+\.\d+/u.test(version)) continue;
    return { componentId, version };
  }

  // packages/apple releases under a bare version tag.
  if (/^\d+\.\d+\.\d+/u.test(normalized)) {
    return { componentId: "apple", version: normalized };
  }

  return null;
}

/**
 * RFC 4122 §4.3 name-based UUID (SHA-1, version 5) over the release identity,
 * so the same release always yields the same serial number.
 */
function deterministicSerialNumber(identity) {
  // DNS namespace UUID, per RFC 4122 Appendix C.
  const namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const namespaceBytes = Buffer.from(namespace.replace(/-/gu, ""), "hex");
  const hash = createHash("sha1")
    .update(Buffer.concat([namespaceBytes, Buffer.from(identity, "utf8")]))
    .digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * SPDX identifiers seen in this repository's dependency tree. A registry value
 * outside this set is recorded as a free-text license name rather than being
 * asserted as an SPDX id, because a wrong identifier is worse than an absent
 * one — downstream tooling treats ids as authoritative.
 */
const KNOWN_SPDX_IDS = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "EPL-1.0",
  "EPL-2.0",
  "GPL-2.0-only",
  "GPL-2.0-with-classpath-exception",
  "ISC",
  "LGPL-2.1-only",
  "MIT",
  "MPL-2.0",
  "Unlicense",
]);

/** Common registry spellings that are unambiguous but not SPDX-formatted. */
const LICENSE_ALIASES = new Map([
  ["apache license 2.0", "Apache-2.0"],
  ["apache license, version 2.0", "Apache-2.0"],
  ["apache-2.0", "Apache-2.0"],
  ["apache 2.0", "Apache-2.0"],
  ["the apache license, version 2.0", "Apache-2.0"],
  ["the apache software license, version 2.0", "Apache-2.0"],
  ["mit", "MIT"],
  ["mit license", "MIT"],
  ["the mit license", "MIT"],
  ["bsd-3-clause", "BSD-3-Clause"],
  ["eclipse public license 1.0", "EPL-1.0"],
  ["eclipse public license - v 2.0", "EPL-2.0"],
]);

export function normalizeLicense(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (KNOWN_SPDX_IDS.has(value)) return { license: { id: value } };

  const alias = LICENSE_ALIASES.get(value.toLowerCase());
  if (alias) return { license: { id: alias } };

  // A compound expression such as "MIT AND Apache-2.0" is valid CycloneDX only
  // in the `expression` form, and only if every operand is a known id.
  if (/\s(AND|OR|WITH)\s/u.test(value)) {
    const operands = value.split(/\s(?:AND|OR|WITH)\s/u).map((p) => p.trim());
    if (operands.every((operand) => KNOWN_SPDX_IDS.has(operand))) {
      return { expression: value };
    }
  }

  return { license: { name: value } };
}

function dependencyComponent(entry) {
  const component = {
    "bom-ref": entry.purl,
    type: "library",
    name: entry.name,
    version: entry.version,
    purl: entry.purl,
    scope: "required",
  };
  // NTIA minimum elements name the supplier as required data.
  if (entry.supplier) {
    component.supplier = { name: entry.supplier };
  }
  if (entry.licenses?.length) {
    component.licenses = entry.licenses;
  }
  if (entry.transitive) {
    component.properties = [
      { name: "openiap:sbom:relationship", value: "transitive" },
    ];
  }
  return component;
}

export function buildSbom({
  componentId,
  version,
  commit,
  timestamp,
  dependencies,
  vulnerabilities = [],
}) {
  const definition = COMPONENTS[componentId];
  if (!definition) {
    throw new Error(`Unknown SBOM component: ${componentId}`);
  }

  const purl = definition.purl(version);
  const tag = releaseTagFor(componentId, version);
  const componentRef = purl;

  // A VEX statement that points at a bom-ref this SBOM does not contain says
  // nothing a consumer's scanner can act on. Catch it here rather than
  // shipping an analysis nobody can match to a component.
  const knownRefs = new Set([componentRef, ...dependencies.map((d) => d.purl)]);
  for (const statement of vulnerabilities) {
    for (const affected of statement.affects ?? []) {
      if (!knownRefs.has(affected.ref)) {
        throw new Error(
          `VEX statement ${statement.id} affects '${affected.ref}', which is not a component of ${definition.sbomName}@${version}`,
        );
      }
    }
  }

  const externalReferences = [
    { type: "vcs", url: `${REPOSITORY_URL}.git` },
    { type: "distribution", url: definition.distribution(version) },
    { type: "website", url: "https://openiap.dev" },
  ];

  return {
    $schema: `http://cyclonedx.org/schema/bom-${SPEC_VERSION}.schema.json`,
    bomFormat: "CycloneDX",
    specVersion: SPEC_VERSION,
    serialNumber: deterministicSerialNumber(`${purl}@${commit}`),
    version: 1,
    metadata: {
      timestamp,
      lifecycles: [{ phase: "build" }],
      // NTIA minimum elements require an author distinct from the supplier.
      authors: [{ name: SUPPLIER.name }],
      tools: {
        components: [
          {
            type: "application",
            name: GENERATOR_NAME,
            version: GENERATOR_VERSION,
          },
        ],
      },
      component: {
        "bom-ref": componentRef,
        type: definition.type,
        name: definition.sbomName,
        version,
        purl,
        supplier: SUPPLIER,
        licenses: [{ license: { id: "MIT" } }],
        externalReferences,
        properties: [
          { name: "openiap:release:tag", value: tag },
          { name: "openiap:release:commit", value: commit },
          { name: "openiap:release:component", value: componentId },
        ],
      },
      supplier: SUPPLIER,
    },
    components: dependencies.map(dependencyComponent),
    dependencies: [
      {
        ref: componentRef,
        dependsOn: dependencies
          .filter((entry) => !entry.transitive)
          .map((entry) => entry.purl),
      },
      ...dependencies.map((entry) => ({ ref: entry.purl, dependsOn: [] })),
    ],
    // Omitted entirely when there is nothing analysed, rather than emitted as
    // an empty array that reads like "we checked and found none".
    ...(vulnerabilities.length > 0 ? { vulnerabilities } : {}),
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": `${GENERATOR_NAME}/${GENERATOR_VERSION}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;
  return response.text();
}

/**
 * Look up a dependency's declared license and supplier in its own registry.
 *
 * Both are NTIA minimum elements, and both come from the same document, so
 * they are fetched together rather than in two passes.
 *
 * The registry is the only authoritative source; guessing from a name would
 * produce confident, wrong compliance data. A lookup that fails leaves the
 * field empty rather than failing the build — this is compliance metadata,
 * not part of the security inventory, and a registry outage must not block a
 * release.
 *
 * (name, version) pairs are immutable in every registry used here, so this
 * stays reproducible in practice.
 */
async function lookupComponentMetadata(entry) {
  try {
    if (entry.purl.startsWith("pkg:maven/")) {
      const [, coordinates] = entry.purl.split("pkg:maven/");
      const [group, rest] = coordinates.split("/");
      const [artifact] = rest.split("@");
      const groupPath = group.replace(/\./gu, "/");
      const path = `${groupPath}/${artifact}/${entry.version}/${artifact}-${entry.version}.pom`;

      // androidx, com.android.*, and com.google.android.* publish to Google's
      // Maven repository, not Maven Central.
      for (const base of [
        "https://repo1.maven.org/maven2",
        "https://dl.google.com/dl/android/maven2",
      ]) {
        const pom = await fetchText(`${base}/${path}`);
        if (!pom) continue;
        const license = pom.match(
          /<licenses>[\s\S]*?<name>([^<]+)<\/name>/u,
        )?.[1];
        // The publishing organisation, falling back to the group id, which is
        // the coordinate's own namespace claim.
        const supplier =
          pom.match(/<organization>[\s\S]*?<name>([^<]+)<\/name>/u)?.[1] ??
          group;
        if (license || supplier) {
          return { license: normalizeLicense(license), supplier };
        }
      }
      return null;
    }

    if (entry.purl.startsWith("pkg:nuget/")) {
      const id = entry.name.toLowerCase();
      const nuspec = await fetchText(
        `https://api.nuget.org/v3-flatcontainer/${id}/${entry.version}/${id}.nuspec`,
      );
      if (!nuspec) return null;
      const expression = nuspec.match(
        /<license\s+type="expression">([^<]+)<\/license>/u,
      )?.[1];
      const url = nuspec.match(/<licenseUrl>([^<]+)<\/licenseUrl>/u)?.[1];
      const fromUrl = url?.match(/licenses\.nuget\.org\/(.+)$/u)?.[1];
      const raw = expression ?? (fromUrl && decodeURIComponent(fromUrl));
      return {
        license: normalizeLicense(raw),
        supplier: nuspec.match(/<authors>([^<]+)<\/authors>/u)?.[1]?.trim(),
      };
    }

    if (entry.purl.startsWith("pkg:npm/")) {
      // A scoped name contains a slash, which would otherwise be read as a
      // path separator and 404.
      const raw = await fetchText(
        `https://registry.npmjs.org/${encodeURIComponent(entry.name)}/${entry.version}`,
      );
      if (!raw) return null;
      const metadata = JSON.parse(raw);
      const license = metadata.license;
      const author = metadata.author;
      return {
        license: normalizeLicense(
          typeof license === "string" ? license : license?.type,
        ),
        supplier: typeof author === "string" ? author : author?.name,
      };
    }
  } catch {
    // Network failure, timeout, or malformed registry response.
    return null;
  }

  // pub.dev has no standard license field in package metadata; Dart packages
  // declare licensing in a LICENSE file that the API does not expose.
  return null;
}

async function attachRegistryMetadata(dependencies) {
  return Promise.all(
    dependencies.map(async (entry) => {
      const found = await lookupComponentMetadata(entry);
      if (!found) return entry;
      return {
        ...entry,
        ...(found.license ? { licenses: [found.license] } : {}),
        ...(found.supplier ? { supplier: found.supplier } : {}),
      };
    }),
  );
}

/** CycloneDX 1.6 analysis states, in the order a finding moves through them. */
const VEX_STATES = new Set([
  "in_triage",
  "exploitable",
  "resolved",
  "resolved_with_pedigree",
  "false_positive",
  "not_affected",
]);

/**
 * Load recorded VEX statements for a component, if any exist.
 *
 * Unlike the dependency inventory, VEX cannot be generated: whether a CVE
 * actually affects this product is a human judgement. What automation can do
 * is make sure a recorded judgement travels with the release it applies to,
 * and refuse a malformed one.
 *
 * No file means no analysed vulnerabilities, which is the normal state.
 */
export function readVexStatements(root, componentId) {
  const path = resolve(root, "security/vex", `${componentId}.json`);
  if (!existsSync(path)) return [];

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const statements = Array.isArray(parsed) ? parsed : parsed.vulnerabilities;
  if (!Array.isArray(statements)) {
    throw new Error(
      `VEX file must be an array or {"vulnerabilities": [...]}: ${path}`,
    );
  }

  for (const statement of statements) {
    if (!statement?.id) {
      throw new Error(`VEX statement without an id in ${path}`);
    }
    const state = statement.analysis?.state;
    if (!VEX_STATES.has(state)) {
      throw new Error(
        `VEX statement ${statement.id} has state '${state ?? "(missing)"}'; ` +
          `expected one of ${[...VEX_STATES].join(", ")}`,
      );
    }
    // An unaffected claim without a reason is not reviewable, and reviewers
    // are the whole point of publishing one.
    if (
      (state === "not_affected" || state === "false_positive") &&
      !statement.analysis.justification &&
      !statement.analysis.detail
    ) {
      throw new Error(
        `VEX statement ${statement.id} claims '${state}' without a justification or detail`,
      );
    }
  }

  return statements;
}

function readResolvedFile(path) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const entries = Array.isArray(parsed) ? parsed : parsed.components;
  if (!Array.isArray(entries)) {
    throw new Error(
      `Resolved dependency file must be an array or {"components": [...]}: ${path}`,
    );
  }
  return entries;
}

export async function generateSbom(
  componentId,
  {
    root = repoRoot,
    commit,
    resolvedFile,
    withLicenses = false,
    runGit = defaultRunGit,
  } = {},
) {
  const definition = COMPONENTS[componentId];
  if (!definition) {
    throw new Error(
      `Unknown SBOM component '${componentId}'. Known: ${listComponentIds().join(", ")}`,
    );
  }

  const version = readComponentVersion(componentId, root);
  const resolvedCommit = commit || runGit(["rev-parse", "HEAD"]);
  // Commit time, not wall-clock time, keeps regeneration byte-identical.
  const timestamp = new Date(
    runGit(["show", "-s", "--format=%cI", resolvedCommit]),
  ).toISOString();

  const direct = extractDirectDependencies(root, definition.source);
  const merged = resolvedFile
    ? mergeResolved(direct, readResolvedFile(resolvedFile))
    : direct;
  const dependencies = withLicenses
    ? await attachRegistryMetadata(merged)
    : merged;

  const vulnerabilities = readVexStatements(root, componentId);

  const document = buildSbom({
    componentId,
    version,
    commit: resolvedCommit,
    timestamp,
    dependencies,
    vulnerabilities,
  });

  return {
    document,
    version,
    fileName: sbomFileName(componentId, version),
    directCount: direct.length,
    totalCount: dependencies.length,
    licensedCount: dependencies.filter((entry) => entry.licenses?.length)
      .length,
    vexCount: vulnerabilities.length,
  };
}

function parseArguments(argv) {
  const options = { componentId: "", outputDir: "sbom", toStdout: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output-dir") {
      options.outputDir = argv[++index];
    } else if (argument === "--commit") {
      options.commit = argv[++index];
    } else if (argument === "--resolved") {
      options.resolvedFile = argv[++index];
    } else if (argument === "--tag") {
      options.tag = argv[++index];
    } else if (argument === "--stdout") {
      options.toStdout = true;
    } else if (argument === "--with-licenses") {
      options.withLicenses = true;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (!options.componentId) {
      options.componentId = argument;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }

  if (options.tag && !options.componentId) {
    const resolved = componentFromTag(options.tag);
    if (!resolved) {
      throw new Error(
        `Release tag '${options.tag}' does not belong to a known SBOM component`,
      );
    }
    options.componentId = resolved.componentId;
  }

  if (!options.componentId) {
    throw new Error(
      `Usage: generate-sbom.mjs <${listComponentIds().join("|")}|--tag TAG> [--output-dir DIR] [--commit SHA] [--resolved FILE] [--with-licenses] [--stdout]`,
    );
  }
  return options;
}

async function main() {
  const [maybeCommand] = process.argv.slice(2);

  // `resolve-tag` lets a workflow map a published release back to its component
  // without duplicating the tag conventions in YAML.
  if (maybeCommand === "resolve-tag") {
    const tag = process.argv[3];
    const resolved = componentFromTag(tag);
    const line = resolved
      ? `component=${resolved.componentId}\nversion=${resolved.version}\nmatched=true\n`
      : "matched=false\n";
    process.stdout.write(line);
    if (process.env.GITHUB_OUTPUT) {
      writeFileSync(process.env.GITHUB_OUTPUT, line, { flag: "a" });
    }
    return;
  }

  const options = parseArguments(process.argv.slice(2));
  const result = await generateSbom(options.componentId, {
    commit: options.commit,
    resolvedFile: options.resolvedFile,
    withLicenses: options.withLicenses,
  });
  const serialized = `${JSON.stringify(result.document, null, 2)}\n`;

  if (options.toStdout) {
    process.stdout.write(serialized);
    return;
  }

  const outputDir = resolve(repoRoot, options.outputDir);
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, result.fileName);
  writeFileSync(outputPath, serialized);

  console.log(
    `${result.fileName}: ${result.directCount} direct` +
      (result.totalCount !== result.directCount
        ? `, ${result.totalCount - result.directCount} transitive`
        : "") +
      ` runtime dependencies` +
      (options.withLicenses
        ? `, ${result.licensedCount}/${result.totalCount} with license data`
        : "") +
      (result.vexCount > 0 ? `, ${result.vexCount} VEX statements` : ""),
  );
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `sbom-file=${outputPath}\nsbom-name=${result.fileName}\nversion=${result.version}\n`,
      { flag: "a" },
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}

export const __testing = { COMPONENTS, deterministicSerialNumber };
