#!/usr/bin/env node

/**
 * Direct runtime dependency extractors, one per ecosystem this repository
 * actually publishes into.
 *
 * Each extractor reads the same manifest the build reads, so the inventory
 * cannot drift from what is shipped. Transitive closure is not resolved here —
 * that needs the ecosystem's own resolver, which only the release runners have.
 * `mergeResolved` folds a resolver export in when one is supplied.
 *
 * Test-only and build-only dependencies are excluded on purpose: they are not
 * present in the published artifact, so listing them would misrepresent the
 * consumer's attack surface.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readText(root, relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

/** Gradle `val name = "value"` locals, used to resolve `$name` interpolation. */
function readGradleLocals(source) {
  const locals = new Map();
  for (const match of source.matchAll(
    /\bval\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]+)"/gu,
  )) {
    locals.set(match[1], match[2]);
  }

  // `val x = (project.findProperty("PROP") as String?) ?: "fallback"` — the
  // gradle.properties entry wins at build time, so prefer it and fall back to
  // the literal only when the property is absent.
  for (const match of source.matchAll(
    /\bval\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(\s*project\.findProperty\(\s*"([^"]+)"\s*\)[^)]*\)\s*\?:\s*"([^"]+)"/gu,
  )) {
    locals.set(match[1], { property: match[2], fallback: match[3] });
  }

  return locals;
}

function readGradleProperties(root, manifest) {
  const properties = new Map();
  const segments = manifest.split("/");
  // Walk from the module directory up to the repository root, mirroring how
  // Gradle layers project and root properties.
  for (let depth = segments.length - 1; depth > 0; depth -= 1) {
    const candidate = [...segments.slice(0, depth), "gradle.properties"].join(
      "/",
    );
    let source;
    try {
      source = readText(root, candidate);
    } catch {
      continue;
    }
    for (const line of source.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.+?)\s*$/u);
      if (match && !properties.has(match[1])) {
        properties.set(match[1], match[2]);
      }
    }
  }
  return properties;
}

/**
 * Resolve locals that a sibling module owns.
 *
 * The Godot Android plugin computes its coordinates from `openiap-versions.json`
 * and from packages/google's build script. Reading the same files keeps the
 * coordinate correct without duplicating a version into this table.
 */
function readExternalLocals(root, externalLocals = {}) {
  const resolved = new Map();
  for (const [name, spec] of Object.entries(externalLocals)) {
    if (spec.json) {
      resolved.set(name, readJson(root, spec.file)[spec.json]);
    } else if (spec.gradleLocal) {
      const value = readGradleLocals(readText(root, spec.file)).get(
        spec.gradleLocal,
      );
      if (typeof value === "string") resolved.set(name, value);
    }
  }
  return resolved;
}

function flattenLocals(locals, properties) {
  const flat = new Map();
  for (const [name, value] of locals) {
    if (typeof value === "string") {
      flat.set(name, value);
    } else if (value?.property) {
      flat.set(name, properties.get(value.property) ?? value.fallback);
    }
  }
  return flat;
}

function interpolateGradle(coordinate, locals) {
  return coordinate.replace(
    /\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/gu,
    (whole, name) => locals.get(name) ?? whole,
  );
}

function parseMavenCoordinate(coordinate) {
  const parts = coordinate.split(":");
  if (parts.length !== 3) return null;
  const [group, artifact, version] = parts.map((part) => part.trim());
  if (!group || !artifact || !version) return null;
  // An unresolved `$name` means the build computes this coordinate in a way
  // this reader did not model. Returning null here would silently drop a real
  // runtime dependency, so the caller escalates it instead.
  if (coordinate.includes("$")) {
    return { unresolved: coordinate };
  }
  return {
    name: `${group}:${artifact}`,
    version,
    purl: `pkg:maven/${group}/${artifact}@${version}`,
  };
}

/**
 * Remove a balanced `val <name>Test by getting { ... }` source-set block.
 *
 * Kotlin Multiplatform declares test dependencies with the same
 * `implementation(...)` configuration name as production ones; only the
 * enclosing source set distinguishes them.
 */
function stripTestSourceSets(source) {
  const opener =
    /\bval\s+[A-Za-z0-9_]*[Tt]est[A-Za-z0-9_]*\s+by\s+getting\s*\{/gu;
  let result = source;
  let match;

  while ((match = opener.exec(result)) !== null) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < result.length && depth > 0) {
      if (result[index] === "{") depth += 1;
      else if (result[index] === "}") depth -= 1;
      index += 1;
    }
    // The counter also sees braces inside strings and comments. If it never
    // returns to zero, everything after this point would be discarded and the
    // SBOM would silently lose real dependencies — the one failure mode this
    // module exists to prevent.
    if (depth !== 0) {
      throw new Error(
        `Unbalanced braces while removing a test source set at offset ${match.index}; ` +
          `refusing to drop the remainder of the manifest.`,
      );
    }
    result = result.slice(0, match.index) + result.slice(index);
    opener.lastIndex = 0;
  }

  return result;
}

/**
 * Expand `for (name in listOf("a", "b")) { ... $name ... }` bodies.
 *
 * packages/google declares the Horizon platform SDK modules this way, so
 * without expansion three real runtime dependencies would be unresolvable.
 */
function expandGradleForLoops(source) {
  return source.replace(
    /\bfor\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s+in\s+listOf\(([^)]*)\)\s*\)\s*\{([^{}]*)\}/gu,
    (whole, variable, rawItems, body) => {
      const items = [...rawItems.matchAll(/"([^"]+)"/gu)].map(
        (item) => item[1],
      );
      if (items.length === 0) return whole;
      return items
        .map((item) =>
          body.replace(new RegExp(`\\$\\{?${variable}\\}?`, "gu"), item),
        )
        .join("\n");
    },
  );
}

/**
 * Gradle configurations that place a dependency on the consumer's runtime
 * classpath. `compileOnly` and every test configuration are deliberately absent.
 */
const GRADLE_RUNTIME_CONFIGURATIONS = new Set([
  "api",
  "implementation",
  "runtimeOnly",
]);

/**
 * Configuration prefixes that never reach a consumer. These must be checked
 * before the flavored-configuration pattern below, because `testImplementation`
 * and `androidTestImplementation` both match it.
 */
const GRADLE_NON_RUNTIME_PREFIXES = [
  "test",
  "androidTest",
  "debug",
  "compileOnly",
  "annotationProcessor",
  "ksp",
  "kapt",
  "lintChecks",
];

function isRuntimeGradleConfiguration(configuration) {
  if (GRADLE_RUNTIME_CONFIGURATIONS.has(configuration)) return true;
  if (
    GRADLE_NON_RUNTIME_PREFIXES.some((prefix) =>
      configuration.startsWith(prefix),
    )
  ) {
    return false;
  }
  // Flavored configurations such as `playApi` / `horizonImplementation`.
  return /^[a-z][A-Za-z0-9]*(Api|Implementation|RuntimeOnly)$/u.test(
    configuration,
  );
}

function extractGradle(root, { manifest, externalLocals }) {
  const rawSource = readText(root, manifest);
  const locals = flattenLocals(
    readGradleLocals(rawSource),
    readGradleProperties(root, manifest),
  );
  for (const [name, value] of readExternalLocals(root, externalLocals)) {
    locals.set(name, value);
  }
  const source = expandGradleForLoops(stripTestSourceSets(rawSource));
  const found = new Map();
  const unresolved = [];

  const record = (configuration, rawCoordinate) => {
    if (!isRuntimeGradleConfiguration(configuration)) return;
    const parsed = parseMavenCoordinate(
      interpolateGradle(rawCoordinate, locals),
    );
    if (!parsed) return;
    if (parsed.unresolved) {
      unresolved.push(parsed.unresolved);
      return;
    }
    found.set(parsed.purl, parsed);
  };

  // implementation("group:artifact:version")
  for (const match of source.matchAll(
    /\b([a-zA-Z][A-Za-z0-9]*)\s*\(\s*"([^"]+:[^"]+:[^"]+)"\s*\)/gu,
  )) {
    record(match[1], match[2]);
  }

  // add("playApi", "group:artifact:version")
  for (const match of source.matchAll(
    /\badd\s*\(\s*"([^"]+)"\s*,\s*"([^"]+:[^"]+:[^"]+)"\s*\)/gu,
  )) {
    record(match[1], match[2]);
  }

  if (unresolved.length > 0) {
    throw new Error(
      `Unresolved Gradle coordinates in ${manifest}: ${[...new Set(unresolved)].join(", ")}. ` +
        `Model the declaration in sbom-dependencies.mjs, or supply a resolver export with --resolved.`,
    );
  }

  return [...found.values()].sort((left, right) =>
    left.purl.localeCompare(right.purl),
  );
}

function parseVersionCatalog(source) {
  const versions = new Map();
  const libraries = new Map();
  let section = "";

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("#") || line === "") continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/u);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    if (section === "versions") {
      const match = line.match(/^([\w.-]+)\s*=\s*"([^"]+)"/u);
      if (match) versions.set(match[1], match[2]);
      continue;
    }
    if (section === "libraries") {
      const match = line.match(/^([\w.-]+)\s*=\s*\{(.+)\}/u);
      if (!match) continue;
      const module = match[2].match(/module\s*=\s*"([^"]+)"/u)?.[1];
      const versionRef = match[2].match(/version\.ref\s*=\s*"([^"]+)"/u)?.[1];
      const literal = match[2].match(/version\s*=\s*"([^"]+)"/u)?.[1];
      if (module) libraries.set(match[1], { module, versionRef, literal });
    }
  }

  return { versions, libraries };
}

/** `libs.kotlinx.coroutines.core` -> catalog alias `kotlinx-coroutines-core`. */
function catalogAliasFromAccessor(accessor) {
  return accessor.replace(/\./gu, "-");
}

function extractGradleCatalog(root, { manifest, catalog }) {
  const source = stripTestSourceSets(readText(root, manifest));
  const { versions, libraries } = parseVersionCatalog(readText(root, catalog));
  const found = new Map();

  for (const match of source.matchAll(
    /\b([a-zA-Z][A-Za-z0-9]*)\s*\(\s*libs\.([A-Za-z0-9.]+)\s*\)/gu,
  )) {
    if (!isRuntimeGradleConfiguration(match[1])) continue;
    const entry = libraries.get(catalogAliasFromAccessor(match[2]));
    if (!entry) continue;
    const version = entry.literal ?? versions.get(entry.versionRef);
    if (!version) continue;
    const parsed = parseMavenCoordinate(`${entry.module}:${version}`);
    if (parsed) found.set(parsed.purl, parsed);
  }

  return [...found.values()].sort((left, right) =>
    left.purl.localeCompare(right.purl),
  );
}

function readMsBuildProperties(root, propertyFiles) {
  const properties = new Map();
  for (const file of propertyFiles) {
    let source;
    try {
      source = readText(root, file);
    } catch {
      continue;
    }
    for (const match of source.matchAll(
      /<([A-Za-z_][\w.-]*)>([^<>$]+)<\/\1>/gu,
    )) {
      properties.set(match[1], match[2].trim());
    }
  }
  return properties;
}

function interpolateMsBuild(value, properties) {
  return value.replace(
    /\$\(([A-Za-z_][\w.-]*)\)/gu,
    (whole, name) => properties.get(name) ?? whole,
  );
}

function extractNuget(root, { manifest, propertyFiles = [] }) {
  const source = readText(root, manifest);
  const properties = readMsBuildProperties(root, [...propertyFiles, manifest]);
  const found = new Map();

  for (const match of source.matchAll(/<PackageReference\b([^>]*)\/?>/gu)) {
    const attributes = match[1];
    const name = attributes.match(/\bInclude\s*=\s*"([^"]+)"/u)?.[1];
    const rawVersion = attributes.match(/\bVersion\s*=\s*"([^"]+)"/u)?.[1];
    if (!name || !rawVersion) continue;

    // PrivateAssets="all" means the reference is not propagated to consumers
    // of the produced package, so it is a build input rather than a runtime
    // dependency of the shipped artifact.
    if (/\bPrivateAssets\s*=\s*"all"/iu.test(attributes)) continue;

    const version = interpolateMsBuild(rawVersion, properties);
    if (version.includes("$")) continue;
    const purl = `pkg:nuget/${name}@${version}`;
    found.set(purl, { name, version, purl });
  }

  return [...found.values()].sort((left, right) =>
    left.purl.localeCompare(right.purl),
  );
}

function extractPub(root, { manifest }) {
  const source = readText(root, manifest);
  const lines = source.split("\n");
  const found = new Map();
  let inDependencies = false;

  for (const line of lines) {
    if (/^[A-Za-z_]+:/u.test(line)) {
      inDependencies = line.startsWith("dependencies:");
      continue;
    }
    if (!inDependencies) continue;

    const match = line.match(/^ {2}([a-z0-9_]+):\s*(.*)$/u);
    if (!match) continue;
    const [, name, rawConstraint] = match;
    const constraint = rawConstraint.trim();
    // `flutter: sdk: flutter` is the SDK itself, not a pub.dev package.
    if (constraint === "") continue;
    const version = constraint.replace(/^[\^~><= ]+/u, "").trim();
    if (!version) continue;
    found.set(name, {
      name,
      version,
      purl: `pkg:pub/${name}@${version}`,
      scope: "required",
    });
  }

  return [...found.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function extractNpm(root, { manifest }) {
  const packageJson = readJson(root, manifest);
  const dependencies = packageJson.dependencies ?? {};
  return Object.entries(dependencies)
    .map(([name, range]) => ({
      name,
      version: String(range)
        .replace(/^[\^~><= ]+/u, "")
        .trim(),
      purl: `pkg:npm/${name}@${String(range)
        .replace(/^[\^~><= ]+/u, "")
        .trim()}`,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function extractSwift(root, { manifest }) {
  const source = readText(root, manifest);
  const found = new Map();
  for (const match of source.matchAll(
    /\.package\s*\(\s*url:\s*"([^"]+)"[^)]*?(?:from|exact):\s*"([^"]+)"/gu,
  )) {
    const url = match[1];
    const version = match[2];
    const name =
      url
        .replace(/\.git$/u, "")
        .split("/")
        .pop() ?? url;
    const owner =
      url
        .replace(/\.git$/u, "")
        .split("/")
        .at(-2) ?? "";
    found.set(url, {
      name,
      version,
      purl: `pkg:swift/github.com/${owner}/${name}@${version}`,
    });
  }
  return [...found.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

/** No dependency manifest: the component ships no third-party runtime code. */
function extractNone() {
  return [];
}

const EXTRACTORS = {
  gradle: extractGradle,
  "gradle-catalog": extractGradleCatalog,
  npm: extractNpm,
  none: extractNone,
  nuget: extractNuget,
  pub: extractPub,
  swift: extractSwift,
};

export function extractDirectDependencies(root, source) {
  const extractor = EXTRACTORS[source.kind];
  if (!extractor) {
    throw new Error(`Unsupported dependency source kind: ${source.kind}`);
  }
  return extractor(root, source);
}

/**
 * Fold an ecosystem resolver export into the direct dependency list.
 *
 * The resolver output is the only place a full transitive closure can come
 * from, and only a release runner with that ecosystem's toolchain can produce
 * it. Entries already present as direct dependencies keep their direct scope.
 */
export function mergeResolved(direct, resolvedEntries) {
  const merged = new Map(direct.map((entry) => [entry.purl, { ...entry }]));
  for (const entry of resolvedEntries) {
    if (!entry?.purl) continue;
    if (merged.has(entry.purl)) continue;
    merged.set(entry.purl, { ...entry, transitive: true });
  }
  return [...merged.values()].sort((left, right) =>
    left.purl.localeCompare(right.purl),
  );
}

export const __testing = {
  expandGradleForLoops,
  extractGradle,
  extractGradleCatalog,
  extractNpm,
  extractNuget,
  extractPub,
  extractSwift,
  isRuntimeGradleConfiguration,
  parseMavenCoordinate,
  parseVersionCatalog,
  stripTestSourceSets,
};
