#!/usr/bin/env node

/**
 * Direct runtime dependency readers for the artifacts OpenIAP publishes.
 *
 * Maven and NuGet inventories come from their published POM/nuspec, which is
 * the consumer-visible contract. The remaining readers use simple manifests
 * and fail when a declaration shape cannot be classified.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { compareSemVer } from "./release-branch-policy.mjs";
import { parseXml, XmlParseError } from "./xml-document.mjs";

export class PublishedMetadataUnavailableError extends Error {}

// Published metadata is parsed, not pattern-matched. Regex readers accepted a
// long tail of documents that hold the right tags in the wrong structure — a
// closing tag inside a comment, an attribute value containing text that looks
// like another attribute, a body truncated mid-element — and each one read as
// "this package declares no dependencies". An unparseable body is missing
// metadata, not metadata that declares nothing, so this throws.
function parseXmlDocument(source, context, kind) {
  try {
    return parseXml(source, context);
  } catch (error) {
    if (error instanceof XmlParseError) {
      throw new PublishedMetadataUnavailableError(
        `Published document is not well-formed ${kind}: ${context.url}`,
      );
    }
    throw error;
  }
}

function readText(root, relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function decodeXml(value) {
  return String(value ?? "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function xmlValue(source, tag) {
  const match = source.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "u"),
  );
  return match ? decodeXml(match[1].trim()) : null;
}

function encodePurlVersion(version) {
  return encodeURIComponent(version).replaceAll("%3A", ":");
}

function scanGradleSource(source) {
  const commentFree = [...source];
  const structural = [...source];
  let state = "code";
  let blockDepth = 0;

  const mask = (index, commentsOnly = false) => {
    if (source[index] !== "\n" && source[index] !== "\r") {
      structural[index] = " ";
      if (!commentsOnly) return;
      commentFree[index] = " ";
    }
  };

  for (let index = 0; index < source.length; index += 1) {
    const pair = source.slice(index, index + 2);
    const triple = source.slice(index, index + 3);

    if (state === "line-comment") {
      mask(index, true);
      if (source[index] === "\n" || source[index] === "\r") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (pair === "/*") blockDepth += 1;
      mask(index, true);
      if (pair === "*/") {
        mask(index + 1, true);
        blockDepth -= 1;
        index += 1;
        if (blockDepth === 0) state = "code";
      }
      continue;
    }
    if (state === "raw-string") {
      if (source[index] === '"') {
        let quoteCount = 1;
        while (source[index + quoteCount] === '"') quoteCount += 1;
        for (let offset = 0; offset < quoteCount; offset += 1) {
          mask(index + offset);
        }
        index += quoteCount - 1;
        if (quoteCount >= 3) state = "code";
      } else {
        mask(index);
      }
      continue;
    }
    if (state === "slashy-string") {
      mask(index);
      if (source[index] === "\\") {
        mask(index + 1);
        index += 1;
      } else if (source[index] === "/") {
        state = "code";
      }
      continue;
    }
    if (state === "string" || state === "character") {
      mask(index);
      if (source[index] === "\\") {
        mask(index + 1);
        index += 1;
      } else if (
        (state === "string" && source[index] === '"') ||
        (state === "character" && source[index] === "'")
      ) {
        state = "code";
      }
      continue;
    }

    if (pair === "//") {
      mask(index, true);
      mask(index + 1, true);
      index += 1;
      state = "line-comment";
    } else if (pair === "/*") {
      mask(index, true);
      mask(index + 1, true);
      index += 1;
      blockDepth = 1;
      state = "block-comment";
    } else if (triple === '\"\"\"') {
      mask(index);
      mask(index + 1);
      mask(index + 2);
      index += 2;
      state = "raw-string";
    } else if (source[index] === '"') {
      mask(index);
      state = "string";
    } else if (source[index] === "'") {
      mask(index);
      state = "character";
    } else if (
      source[index] === "/" &&
      /(?:=~|==~)\s*$/u.test(source.slice(Math.max(0, index - 8), index))
    ) {
      mask(index);
      state = "slashy-string";
    }
  }

  if (
    state === "block-comment" ||
    state === "raw-string" ||
    state === "slashy-string"
  ) {
    throw new Error(`Unterminated Gradle ${state.replace("-", " ")}`);
  }
  return {
    commentFree: commentFree.join(""),
    structural: structural.join(""),
  };
}

function previousGradleCodeIndex(source, from) {
  let cursor = from;
  while (cursor >= 0 && /\s/u.test(source[cursor])) cursor -= 1;
  return cursor;
}

function gradleIdentifierBefore(source, from) {
  const end = previousGradleCodeIndex(source, from) + 1;
  let start = end;
  while (start > 0 && /[A-Za-z0-9_]/u.test(source[start - 1])) start -= 1;
  return source.slice(start, end);
}

function gradleCallBefore(source, close) {
  let depth = 1;
  let cursor = close - 1;
  for (; cursor >= 0 && depth > 0; cursor -= 1) {
    if (source[cursor] === ")") depth += 1;
    if (source[cursor] === "(") depth -= 1;
  }
  if (depth !== 0) throw new Error("Unbalanced Gradle call parentheses");
  return gradleIdentifierBefore(source, cursor);
}

function gradleBlockOwner(source, open) {
  const previous = previousGradleCodeIndex(source, open - 1);
  return source[previous] === ")"
    ? gradleCallBefore(source, previous)
    : gradleIdentifierBefore(source, previous);
}

function gradleOwningBlocks(source, end) {
  const owners = [];
  for (let index = 0; index < end; index += 1) {
    if (source[index] === "{") owners.push(gradleBlockOwner(source, index));
    if (source[index] === "}") owners.pop();
  }
  return owners;
}

function gradleDependencySource(source, manifest) {
  const { commentFree, structural } = scanGradleSource(source);
  const braceDepths = new Uint32Array(structural.length);
  let braceDepth = 0;
  for (let index = 0; index < structural.length; index += 1) {
    braceDepths[index] = braceDepth;
    if (structural[index] === "{") braceDepth += 1;
    if (structural[index] === "}") {
      if (braceDepth === 0) throw new Error("Unbalanced Gradle block braces");
      braceDepth -= 1;
    }
  }
  if (braceDepth !== 0) throw new Error("Unbalanced Gradle block braces");

  const blocks = [];
  const pattern = /\bdependencies\s*\{/gu;
  for (
    let match = pattern.exec(structural);
    match;
    match = pattern.exec(structural)
  ) {
    const open = match.index + match[0].lastIndexOf("{");
    if (braceDepths[match.index] !== 0) {
      const owners = gradleOwningBlocks(structural, match.index);
      if (owners.includes("buildscript")) continue;
      throw new Error(`Unsupported nested dependencies block in ${manifest}`);
    }
    let depth = 1;
    let cursor = open + 1;
    for (; cursor < structural.length && depth > 0; cursor += 1) {
      if (structural[cursor] === "{") depth += 1;
      if (structural[cursor] === "}") depth -= 1;
    }
    if (depth !== 0) {
      throw new Error(`Unterminated Gradle dependencies block in ${manifest}`);
    }
    blocks.push(
      filterGradleDependencyBlock(
        commentFree.slice(open + 1, cursor - 1),
        manifest,
      ),
    );
    pattern.lastIndex = cursor;
  }
  if (blocks.length === 0) {
    throw new Error(`Missing Gradle dependencies block in ${manifest}`);
  }
  return { commentFree, dependencies: blocks.join("\n") };
}

function filterGradleDependencyBlock(source, manifest) {
  const { structural } = scanGradleSource(source);
  const filtered = [...source];
  const visible = [true];

  for (let index = 0; index < structural.length; index += 1) {
    if (structural[index] === "{") {
      const parentVisible = visible.at(-1);
      let childVisible = false;
      if (parentVisible) {
        const previous = previousGradleCodeIndex(structural, index - 1);
        const callOwned = structural[previous] === ")";
        const owner = callOwned
          ? gradleCallBefore(structural, previous)
          : gradleIdentifierBefore(structural, previous);
        if (["if", "for", "when", "while", "else"].includes(owner)) {
          childVisible = true;
        } else if (owner === "constraints" && !callOwned) {
          childVisible = false;
        } else if (callOwned && owner === "add") {
          childVisible = false;
        } else if (callOwned) {
          isRuntimeGradleConfiguration(owner);
          childVisible = false;
        } else {
          throw new Error(`Unsupported Gradle block in ${manifest}`);
        }
      }
      visible.push(childVisible);
      filtered[index] = " ";
    } else if (structural[index] === "}") {
      if (visible.length === 1)
        throw new Error("Unbalanced Gradle block braces");
      visible.pop();
      filtered[index] = " ";
    } else if (
      !visible.at(-1) &&
      source[index] !== "\n" &&
      source[index] !== "\r"
    ) {
      filtered[index] = " ";
    }
  }
  if (visible.length !== 1) throw new Error("Unbalanced Gradle block braces");
  return filtered.join("");
}

function topLevelGradleCalls(source) {
  const { structural } = scanGradleSource(source);
  const depths = new Uint32Array(structural.length);
  let depth = 0;
  for (let index = 0; index < structural.length; index += 1) {
    depths[index] = depth;
    if (structural[index] === "(") depth += 1;
    if (structural[index] === ")") {
      if (depth === 0) throw new Error("Unbalanced Gradle call parentheses");
      depth -= 1;
    }
  }
  if (depth !== 0) throw new Error("Unbalanced Gradle call parentheses");

  return [...structural.matchAll(/\b([A-Za-z][A-Za-z0-9]*)\s*\(/gu)]
    .filter((match) => {
      if (depths[match.index] !== 0) return false;
      const previous = previousGradleCodeIndex(structural, match.index - 1);
      if (structural[previous] === ".") return false;
      const lineStart = structural.lastIndexOf("\n", match.index - 1) + 1;
      const prefix = structural.slice(lineStart, match.index);
      return !/^\s*(?:(?:val|var)\s+)?[A-Za-z_][A-Za-z0-9_]*(?:\s*:[^=]+)?\s*=\s*$/u.test(
        prefix,
      );
    })
    .map((match) => ({ index: match.index, name: match[1], text: match[0] }));
}

function isVersionConstraint(version) {
  return (
    version === "any" ||
    /[\s*+^~<>=|,[\](){}]/u.test(version) ||
    /\bx\b/iu.test(version)
  );
}

function dependencyEntry({
  name,
  version,
  purl,
  properties = [],
  hashes,
  licenseName,
  spdxLicense,
  supplier,
  scope = "required",
}) {
  if (!name || !version || !purl) {
    throw new Error(
      `Incomplete dependency entry: ${JSON.stringify({ name, version, purl })}`,
    );
  }
  if (licenseName && spdxLicense) {
    throw new Error(`Dependency ${purl} declares two license forms`);
  }
  const versionProperties = isVersionConstraint(version)
    ? [{ name: "openiap:sbom:version-constraint", value: version }]
    : [];
  return {
    name,
    version,
    purl,
    ...(scope === "optional" ? { scope } : {}),
    ...(hashes?.length ? { hashes } : {}),
    ...(licenseName ? { licenses: [{ license: { name: licenseName } }] } : {}),
    ...(spdxLicense ? { licenses: [{ license: { id: spdxLicense } }] } : {}),
    ...(supplier ? { supplier } : {}),
    ...(versionProperties.length > 0 || properties.length > 0
      ? { properties: [...versionProperties, ...properties] }
      : {}),
  };
}

/** Gradle `val name = "value"` locals used by the Godot release manifest. */
function readGradleLocals(source) {
  const locals = new Map();
  for (const match of source.matchAll(
    /\bval\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]+)"/gu,
  )) {
    locals.set(match[1], match[2]);
  }
  return locals;
}

function readExternalLocals(root, externalLocals = {}) {
  const resolved = new Map();
  for (const [name, spec] of Object.entries(externalLocals)) {
    if (spec.jsonPath) {
      let value = readJson(root, spec.file);
      for (const key of spec.jsonPath) value = value?.[key];
      if (value == null) {
        throw new Error(`Missing ${spec.jsonPath.join(".")} in ${spec.file}`);
      }
      resolved.set(name, String(value));
      continue;
    }
    if (spec.json) {
      const value = readJson(root, spec.file)[spec.json];
      if (value == null) {
        throw new Error(`Missing ${spec.json} in ${spec.file}`);
      }
      resolved.set(name, String(value));
      continue;
    }
    if (spec.gradleLocal) {
      const value = readGradleLocals(readText(root, spec.file)).get(
        spec.gradleLocal,
      );
      if (!value) {
        throw new Error(
          `Missing Gradle local ${spec.gradleLocal} in ${spec.file}`,
        );
      }
      resolved.set(name, value);
      continue;
    }
    if (spec.property) {
      const escapedProperty = spec.property.replace(
        /[.*+?^${}()|[\]\\]/gu,
        "\\$&",
      );
      const separator = new RegExp(
        `^\\s*${escapedProperty}\\s*[=:]\\s*(.*)$`,
        "u",
      );
      const value = readText(root, spec.file)
        .split("\n")
        .map((entry) => entry.match(separator)?.[1]?.trim())
        .find(Boolean);
      if (!value) {
        throw new Error(`Missing property ${spec.property} in ${spec.file}`);
      }
      resolved.set(name, value);
    }
  }
  return resolved;
}

function interpolateGradle(coordinate, locals) {
  return coordinate
    .replace(
      /\$\{readRequiredAndroidGradleProperty\(projectDir,\s*'([^']+)'\)\}/gu,
      (whole, name) => locals.get(name) ?? whole,
    )
    .replace(
      /\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/gu,
      (whole, name) => locals.get(name) ?? whole,
    );
}

function parseMavenCoordinate(coordinate) {
  const parts = coordinate.split(":").map((part) => part.trim());
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error(`Unsupported Maven coordinate '${coordinate}'`);
  }
  if (coordinate.includes("$")) {
    throw new Error(`Unresolved Maven coordinate '${coordinate}'`);
  }
  const [group, artifact, version] = parts;
  return dependencyEntry({
    name: `${group}:${artifact}`,
    version,
    purl: `pkg:maven/${group}/${artifact}@${encodePurlVersion(version)}`,
  });
}

const GRADLE_RUNTIME_CONFIGURATIONS = new Set([
  "api",
  "implementation",
  "runtimeOnly",
]);

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
    ) ||
    /(?:Test|CompileOnly|AnnotationProcessor|LintChecks)/u.test(configuration)
  ) {
    return false;
  }
  throw new Error(
    `Unclassified Gradle dependency configuration '${configuration}'`,
  );
}

function extractGradle(root, { manifest, externalLocals }) {
  const source = readText(root, manifest);
  const { commentFree, dependencies } = gradleDependencySource(
    source,
    manifest,
  );
  const locals = readGradleLocals(commentFree);
  for (const [name, value] of readExternalLocals(root, externalLocals)) {
    locals.set(name, value);
  }

  for (const match of dependencies.matchAll(
    /\b([A-Za-z][A-Za-z0-9]*)\s*\(\s*libs\./gu,
  )) {
    if (match[1] === "alias") continue;
    throw new Error(
      `Unsupported version-catalog dependency in ${manifest}; use published metadata instead`,
    );
  }

  const found = new Map();
  const matchedDeclarations = new Set();
  const topLevelCalls = topLevelGradleCalls(dependencies);
  const topLevelCallIndices = new Set(topLevelCalls.map((call) => call.index));
  let usesLocalOpeniapProject = false;
  const record = (configuration, rawCoordinate) => {
    if (!isRuntimeGradleConfiguration(configuration)) return;
    const parsed = parseMavenCoordinate(
      interpolateGradle(rawCoordinate, locals),
    );
    found.set(parsed.purl, parsed);
  };

  for (const match of dependencies.matchAll(
    /\b([a-zA-Z][A-Za-z0-9]*)\s*\(\s*"([^"]+:[^"]+:[^"]+)"\s*\)/gu,
  )) {
    if (!topLevelCallIndices.has(match.index)) continue;
    matchedDeclarations.add(match.index);
    record(match[1], match[2]);
  }
  for (const match of dependencies.matchAll(
    /\badd\s*\(\s*"([^"]+)"\s*,\s*"([^"]+:[^"]+:[^"]+)"\s*\)/gu,
  )) {
    if (!topLevelCallIndices.has(match.index)) continue;
    matchedDeclarations.add(match.index);
    record(match[1], match[2]);
  }

  for (const call of topLevelCalls) {
    if (["if", "for", "when", "while"].includes(call.name)) continue;
    if (call.name === "project") continue;
    if (matchedDeclarations.has(call.index)) continue;
    if (call.name === "add") {
      throw new Error(
        `Unsupported Gradle dependency declaration in ${manifest}`,
      );
    }
    if (!isRuntimeGradleConfiguration(call.name)) continue;
    const argument = dependencies.slice(call.index + call.text.length);
    if (/^\s*project\s*\(\s*":openiap"\s*\)/u.test(argument)) {
      usesLocalOpeniapProject = true;
      continue;
    }
    throw new Error(`Unsupported Gradle dependency declaration in ${manifest}`);
  }

  if (
    usesLocalOpeniapProject &&
    ![...found.values()].some(
      (entry) => entry.name === "io.github.hyochan.openiap:openiap-google",
    )
  ) {
    throw new Error(
      `Local :openiap dependency in ${manifest} lacks its published fallback`,
    );
  }

  return [...found.values()].sort((left, right) =>
    left.purl.localeCompare(right.purl),
  );
}

function resolveMavenValue(value, properties, context) {
  let resolvedValue = value;
  for (
    let attempt = 0;
    attempt < 10 && resolvedValue.includes("${");
    attempt += 1
  ) {
    const next = resolvedValue.replace(/\$\{([^}]+)\}/gu, (whole, name) => {
      if (name === "project.version" || name === "pom.version") {
        return context.version;
      }
      return properties.get(name) ?? whole;
    });
    if (next === resolvedValue) break;
    resolvedValue = next;
  }
  if (resolvedValue.includes("${")) {
    throw new Error(`Unresolved Maven value '${value}' in ${context.url}`);
  }
  return resolvedValue;
}

// Every descendant with this tag name.
function collectElements(element, name, found = []) {
  if (element.name === name) found.push(element);
  for (const child of element.children) collectElements(child, name, found);
  return found;
}

function parseMavenPom(source, context) {
  // Parsed, not pattern-matched. Reading the raw document counted dependencies
  // inside comments — the published httpmime 4.5.6 POM carries a commented-out
  // one with no version, which threw — and matched only the exact opening tag
  // `<dependency>`, so `<dependency >` read as no dependencies at all.
  const document = parseXmlDocument(source, context, "XML");
  if (document.name !== "project") {
    throw new PublishedMetadataUnavailableError(
      `Published document is not a POM: ${context.url}`,
    );
  }

  const properties = new Map();
  for (const property of document.first("properties")?.children ?? []) {
    properties.set(property.name, property.text.trim());
  }

  const profiles = document.first("profiles");
  if (profiles && collectElements(profiles, "dependency").length > 0) {
    throw new Error(`Unsupported profiled Maven dependency in ${context.url}`);
  }

  // Managed, profiled and build dependencies are not this artifact's runtime
  // inventory; only the project's own <dependencies> is.
  const found = new Map();
  for (const declaration of document.first("dependencies")?.all("dependency") ??
    []) {
    const scope = declaration.value("scope") ?? "compile";
    const optional = declaration.value("optional")?.toLowerCase() === "true";
    if (
      !["compile", "runtime", "test", "provided", "system", "import"].includes(
        scope,
      )
    ) {
      throw new Error(`Unsupported Maven scope '${scope}' in ${context.url}`);
    }
    if (["test", "provided", "system", "import"].includes(scope) || optional) {
      continue;
    }

    const group = declaration.value("groupId");
    const artifact = declaration.value("artifactId");
    const rawVersion = declaration.value("version");
    if (!group || !artifact || !rawVersion) {
      throw new Error(`Incomplete runtime dependency in ${context.url}`);
    }
    const version = resolveMavenValue(rawVersion, properties, context);
    const qualifiers = [];
    const type = declaration.value("type");
    const classifier = declaration.value("classifier");
    if (type && type !== "jar") qualifiers.push(["type", type]);
    if (classifier) qualifiers.push(["classifier", classifier]);
    const qualifier = qualifiers.length
      ? `?${qualifiers
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
          .join("&")}`
      : "";
    const entry = dependencyEntry({
      name: `${group}:${artifact}`,
      version,
      purl: `pkg:maven/${group}/${artifact}@${encodePurlVersion(version)}${qualifier}`,
    });
    found.set(entry.purl, entry);
  }

  return [...found.values()].sort((left, right) =>
    left.purl.localeCompare(right.purl),
  );
}

async function extractMavenPom(_root, source, context) {
  const coordinates = source.coordinates ?? [source.coordinate];
  const failures = [];
  for (const coordinate of coordinates) {
    const [group, artifact] = String(coordinate).split(":");
    if (!group || !artifact || coordinate.split(":").length !== 2) {
      throw new Error(`Invalid published Maven coordinate '${coordinate}'`);
    }
    const path = `${group.replaceAll(".", "/")}/${artifact}/${context.version}/${artifact}-${context.version}.pom`;
    for (const repository of source.repositories) {
      const url = `${repository.replace(/\/$/u, "")}/${path}`;
      const document = await context.fetchText(url);
      if (document) return parseMavenPom(document, { ...context, url });
      failures.push(url);
    }
  }
  throw new PublishedMetadataUnavailableError(
    `Published POM not found: ${failures.join(", ")}`,
  );
}

async function extractMavenArtifact(root, source, context) {
  const dependencies = await extractMavenPom(root, source, context);
  const [group, artifact] = source.coordinate.split(":");
  const variantProperty = source.variant
    ? [{ name: "openiap:release-variant", value: source.variant }]
    : [];
  return [
    dependencyEntry({
      name: `${group}:${artifact}`,
      version: context.version,
      purl: `pkg:maven/${group}/${artifact}@${encodePurlVersion(context.version)}`,
      properties: variantProperty,
      spdxLicense: source.spdxLicense,
      supplier: source.supplier,
      scope: source.optional ? "optional" : "required",
    }),
    ...dependencies.map((entry) => ({
      ...entry,
      scope: source.optional ? "optional" : entry.scope,
      ...(variantProperty.length
        ? {
            properties: [...(entry.properties ?? []), ...variantProperty],
          }
        : {}),
    })),
  ];
}

function parseNugetNuspec(source, context) {
  // fetchText accepts any 200 body, so an error page, a CDN placeholder, or a
  // truncated response would otherwise parse as "this package declares no
  // dependencies" and produce a silently empty inventory. Testing for the four
  // tags independently is not enough: `<package><metadata></package></metadata>`
  // contains all four and is still not a nuspec. Require them in nesting order
  // instead, which is one structural rule rather than a list of rejected shapes.
  const document = parseXmlDocument(source, context, "XML");
  const metadataElement =
    document.name === "package" ? document.first("metadata") : undefined;
  if (!metadataElement) {
    throw new PublishedMetadataUnavailableError(
      `Published document is not a nuspec: ${context.url}`,
    );
  }
  // <dependencies> is this package's inventory only as a child of <metadata>.
  // A sibling elsewhere is a malformed nuspec, not an empty one — and checking
  // that only when metadata declared none let a self-closing <dependencies />
  // inside metadata mask a populated one outside.
  if (document.first("dependencies")) {
    throw new Error(`<dependencies> outside <metadata> in ${context.url}`);
  }
  const dependencyGroups = metadataElement.all("dependencies");
  if (dependencyGroups.length > 1) {
    throw new Error(`Multiple <dependencies> elements in ${context.url}`);
  }
  const dependenciesElement = dependencyGroups[0];
  // No element at all genuinely declares none; so does a self-closing one,
  // which the parser gives us as an empty node.
  if (dependenciesElement === undefined) return [];

  const groups = dependenciesElement.all("group");
  if (groups.length > 0 && dependenciesElement.all("dependency").length > 0) {
    throw new Error(
      `Mixed grouped and ungrouped NuGet dependencies in ${context.url}`,
    );
  }
  const sections = groups.length
    ? groups.map((group) => {
        const targetFramework = group.attribute("targetFramework");
        if (
          typeof targetFramework !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9.+_-]*$/u.test(targetFramework)
        ) {
          throw new Error(`Invalid NuGet target framework in ${context.url}`);
        }
        const normalized = targetFramework.toLowerCase();
        const platform = normalized.includes("-android")
          ? "android"
          : /-(?:ios|maccatalyst|macos|tvos|watchos)/u.test(normalized)
            ? "apple"
            : "";
        return {
          dependencies: group.all("dependency"),
          platform,
          targetFramework,
        };
      })
    : [
        {
          dependencies: dependenciesElement.all("dependency"),
          platform: "",
          targetFramework: "",
        },
      ];

  const found = new Map();
  for (const section of sections) {
    for (const declaration of section.dependencies) {
      const name = declaration.attribute("id");
      const version = declaration.attribute("version");
      if (!name || !version) {
        throw new Error(
          `Incomplete published NuGet dependency in ${context.url}`,
        );
      }
      const properties = section.targetFramework
        ? [
            {
              name: "openiap:target-framework",
              value: section.targetFramework,
            },
            ...(section.platform
              ? [{ name: "openiap:platform", value: section.platform }]
              : []),
          ]
        : [];
      const entry = dependencyEntry({
        name: decodeXml(name),
        version: decodeXml(version),
        purl: `pkg:nuget/${encodeURIComponent(decodeXml(name))}@${encodePurlVersion(decodeXml(version))}`,
        properties,
        scope: section.targetFramework ? "optional" : "required",
      });
      const key = entry.purl.toLowerCase();
      const existing = found.get(key);
      if (existing) {
        const mergedProperties = new Map(
          [...(existing.properties ?? []), ...(entry.properties ?? [])].map(
            (property) => [`${property.name}\0${property.value}`, property],
          ),
        );
        found.set(key, {
          ...existing,
          ...(mergedProperties.size
            ? { properties: [...mergedProperties.values()] }
            : {}),
          ...(existing.scope === "optional" && entry.scope === "optional"
            ? { scope: "optional" }
            : {}),
        });
      } else {
        found.set(key, entry);
      }
    }
  }

  return [...found.values()].sort((left, right) =>
    left.purl.localeCompare(right.purl),
  );
}

async function extractNugetNuspec(_root, source, context) {
  const packageId = source.packageId.toLowerCase();
  const version = context.version.toLowerCase();
  const url =
    `https://api.nuget.org/v3-flatcontainer/${packageId}/${version}/` +
    `${packageId}.nuspec`;
  const document = await context.fetchText(url);
  if (!document) {
    throw new PublishedMetadataUnavailableError(
      `Published nuspec not found: ${url}`,
    );
  }
  return parseNugetNuspec(document, { ...context, url });
}

function extractPub(root, { manifest }) {
  const lines = readText(root, manifest).split("\n");
  const found = new Map();
  let inDependencies = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z_]+:/u.test(line)) {
      inDependencies = line.startsWith("dependencies:");
      continue;
    }
    if (!inDependencies) continue;

    const match = line.match(/^ {2}([a-z0-9_]+):\s*(.*)$/u);
    if (!match) continue;
    const [, name, rawConstraint] = match;
    const constraint = rawConstraint.trim();
    if (!constraint) {
      const nested = lines[index + 1]?.trim();
      if (name === "flutter" && nested === "sdk: flutter") continue;
      throw new Error(
        `Unsupported nested pub dependency '${name}' in ${manifest}`,
      );
    }
    const entry = dependencyEntry({
      name,
      version: constraint,
      purl: `pkg:pub/${name}@${encodePurlVersion(constraint)}`,
    });
    found.set(entry.purl, entry);
  }

  return [...found.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function extractNpm(root, { manifest }) {
  const packageJson = readJson(root, manifest);
  const dependencies = Object.entries(packageJson.dependencies ?? {});
  return dependencies
    .map(([name, rawVersion]) => {
      const version = String(rawVersion).trim();
      if (!version || /^(?:file|git|github|https?|workspace):/u.test(version)) {
        throw new Error(
          `Unsupported npm dependency '${name}@${version}' in ${manifest}`,
        );
      }
      const encodedName = name.startsWith("@")
        ? `${encodeURIComponent(name.split("/")[0])}/${name.split("/").slice(1).join("/")}`
        : name;
      return dependencyEntry({
        name,
        version,
        purl: `pkg:npm/${encodedName}@${encodePurlVersion(version)}`,
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function extractSwift(root, { manifest }) {
  const source = readText(root, manifest);
  const found = new Map();
  const declarations = [...source.matchAll(/\.package\s*\(/gu)].length;
  let matched = 0;
  for (const match of source.matchAll(
    /\.package\s*\(\s*url:\s*"([^"]+)"[^)]*?(?:from|exact):\s*"([^"]+)"/gu,
  )) {
    matched += 1;
    const url = match[1];
    const version = match[2];
    const parts = url.replace(/\.git$/u, "").split("/");
    const name = parts.at(-1) ?? url;
    const owner = parts.at(-2) ?? "";
    const entry = dependencyEntry({
      name,
      version,
      purl: `pkg:swift/github.com/${owner}/${name}@${encodePurlVersion(version)}`,
    });
    found.set(entry.purl, entry);
  }
  if (matched !== declarations) {
    throw new Error(`Unsupported Swift package declaration in ${manifest}`);
  }
  return [...found.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function extractNone() {
  return [];
}

function extractOpenIapNative(root, { apple = false, google = [] }) {
  const versions = readJson(root, "openiap-versions.json");
  const entries = [];
  if (apple) {
    entries.push(
      dependencyEntry({
        name: "openiap",
        version: versions.apple,
        purl: `pkg:cocoapods/openiap@${encodePurlVersion(versions.apple)}`,
        properties: [{ name: "openiap:platform", value: "apple" }],
        spdxLicense: "MIT",
        supplier: "OpenIAP",
        scope: "optional",
      }),
    );
  }
  for (const artifact of google) {
    entries.push(
      dependencyEntry({
        name: `io.github.hyochan.openiap:${artifact}`,
        version: versions.google,
        purl: `pkg:maven/io.github.hyochan.openiap/${artifact}@${encodePurlVersion(versions.google)}`,
        properties: [{ name: "openiap:platform", value: "android" }],
        spdxLicense: "MIT",
        supplier: "OpenIAP",
        scope: "optional",
      }),
    );
  }
  return entries;
}

function resolveDeclaredVersion(root, version) {
  if (typeof version === "string") return version;
  const resolved = readExternalLocals(root, { dependencyVersion: version }).get(
    "dependencyVersion",
  );
  if (!resolved) throw new Error("Missing declared dependency version");
  return resolved;
}

function verifyDeclaredInventory(root, inventories = []) {
  for (const inventory of inventories) {
    if (!(inventory.pattern instanceof RegExp) || !inventory.pattern.global) {
      throw new Error(`Declared inventory pattern must be a global RegExp`);
    }
    const source = readText(root, inventory.file);
    const actual = [...source.matchAll(inventory.pattern)]
      .map((match) => match.slice(1).find((value) => value !== undefined))
      .sort();
    const expected = [...inventory.expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `Unmodelled dependency declaration in ${inventory.file}: expected ${expected.join(", ")}; found ${actual.join(", ")}`,
      );
    }
  }
}

function extractDeclared(root, { manifest, dependencies, inventories }) {
  verifyDeclaredInventory(root, inventories);
  return dependencies
    .map((dependency) => {
      const assertions = dependency.assertions ?? [
        { file: manifest, marker: dependency.marker },
      ];
      for (const assertion of assertions) {
        if (
          !assertion.file ||
          !assertion.marker ||
          !readText(root, assertion.file).includes(assertion.marker)
        ) {
          throw new Error(
            `Missing dependency declaration '${assertion.marker}' in ${assertion.file}`,
          );
        }
      }
      const version = resolveDeclaredVersion(root, dependency.version);
      const properties = [
        ...(dependency.platform
          ? [{ name: "openiap:platform", value: dependency.platform }]
          : []),
        ...(dependency.optional
          ? [{ name: "openiap:dependency:optional", value: "true" }]
          : []),
        ...(dependency.hostProvided
          ? [{ name: "openiap:dependency:host-provided", value: "true" }]
          : []),
      ];
      if (dependency.ecosystem === "maven") {
        const name = `${dependency.group}:${dependency.artifact}`;
        return dependencyEntry({
          name,
          version,
          purl: `pkg:maven/${dependency.group}/${dependency.artifact}@${encodePurlVersion(version)}`,
          properties,
          licenseName: dependency.licenseName,
          spdxLicense: dependency.spdxLicense,
          supplier: dependency.supplier,
          scope:
            dependency.optional || dependency.platform
              ? "optional"
              : "required",
        });
      }
      if (dependency.ecosystem === "cocoapods") {
        return dependencyEntry({
          name: dependency.name,
          version,
          purl: `pkg:cocoapods/${encodeURIComponent(dependency.name)}@${encodePurlVersion(version)}`,
          properties,
          spdxLicense: dependency.spdxLicense,
          supplier: dependency.supplier,
          scope:
            dependency.optional || dependency.platform
              ? "optional"
              : "required",
        });
      }
      if (dependency.ecosystem === "npm") {
        return dependencyEntry({
          name: dependency.name,
          version,
          purl: `pkg:npm/${dependency.name}@${encodePurlVersion(version)}`,
          properties,
          spdxLicense: dependency.spdxLicense,
          supplier: dependency.supplier,
          scope:
            dependency.optional || dependency.platform
              ? "optional"
              : "required",
        });
      }
      throw new Error(
        `Unsupported declared dependency ecosystem: ${dependency.ecosystem}`,
      );
    })
    .sort((left, right) => left.purl.localeCompare(right.purl));
}

function extractEmbeddedBinary(root, { file, name, spdxLicense, supplier }) {
  if (!spdxLicense || !supplier) {
    throw new Error(`Embedded binary ${name} lacks license or supplier data`);
  }
  const digest = createHash("sha256")
    .update(readFileSync(resolve(root, file)))
    .digest("hex");
  return [
    dependencyEntry({
      name,
      version: digest,
      purl: `pkg:generic/${encodeURIComponent(name)}@${digest}`,
      hashes: [{ alg: "SHA-256", content: digest }],
      properties: [{ name: "openiap:embedded", value: "true" }],
      spdxLicense,
      supplier,
      scope: "optional",
    }),
  ];
}

const EXTRACTORS = {
  declared: extractDeclared,
  gradle: extractGradle,
  "embedded-binary": extractEmbeddedBinary,
  "maven-artifact": extractMavenArtifact,
  "maven-pom": extractMavenPom,
  npm: extractNpm,
  none: extractNone,
  "openiap-native": extractOpenIapNative,
  "nuget-nuspec": extractNugetNuspec,
  pub: extractPub,
  swift: extractSwift,
};

export async function extractDirectDependencies(root, source, context = {}) {
  if (
    source.introducedVersion &&
    compareSemVer(context.version, source.introducedVersion) < 0
  ) {
    return [];
  }
  if (source.kind === "aggregate") {
    const mergeObjects = (left = [], right = []) => [
      ...new Map(
        [...left, ...right].map((value) => [JSON.stringify(value), value]),
      ).values(),
    ];
    const merged = new Map();
    for (const nested of source.sources) {
      for (const entry of await extractDirectDependencies(
        root,
        nested,
        context,
      )) {
        const existing = merged.get(entry.purl);
        if (existing) {
          if (
            existing.name !== entry.name ||
            existing.version !== entry.version
          ) {
            throw new Error(`Conflicting aggregate dependency ${entry.purl}`);
          }
          if (
            existing.supplier &&
            entry.supplier &&
            existing.supplier !== entry.supplier
          ) {
            throw new Error(`Conflicting aggregate supplier for ${entry.purl}`);
          }
          const scope =
            existing.scope === "optional" && entry.scope === "optional"
              ? "optional"
              : "required";
          const properties = new Map(
            [...(existing.properties ?? []), ...(entry.properties ?? [])]
              .filter(
                (property) =>
                  scope === "optional" ||
                  property.name !== "openiap:dependency:optional",
              )
              .map((property) => [
                `${property.name}\0${property.value}`,
                property,
              ]),
          );
          const mergedEntry = {
            ...existing,
            scope,
            properties: [...properties.values()],
            ...(existing.supplier || entry.supplier
              ? { supplier: existing.supplier ?? entry.supplier }
              : {}),
            ...(existing.licenses?.length || entry.licenses?.length
              ? {
                  licenses: mergeObjects(existing.licenses, entry.licenses),
                }
              : {}),
            ...(existing.hashes?.length || entry.hashes?.length
              ? { hashes: mergeObjects(existing.hashes, entry.hashes) }
              : {}),
          };
          if (!properties.size) delete mergedEntry.properties;
          merged.set(entry.purl, mergedEntry);
          continue;
        }
        merged.set(entry.purl, entry);
      }
    }
    return [...merged.values()].sort((left, right) =>
      left.purl.localeCompare(right.purl),
    );
  }
  const extractor = EXTRACTORS[source.kind];
  if (!extractor) {
    throw new Error(`Unsupported dependency source kind: ${source.kind}`);
  }
  return extractor(root, source, context);
}

export function mergeResolved(direct, resolvedEntries) {
  const merged = new Map(direct.map((entry) => [entry.purl, { ...entry }]));
  for (const entry of resolvedEntries) {
    if (!entry?.name || !entry?.version || !entry?.purl) {
      throw new Error(
        `Incomplete resolved dependency: ${JSON.stringify(entry)}`,
      );
    }
    if (merged.has(entry.purl)) continue;
    merged.set(entry.purl, { ...entry, transitive: true });
  }
  return [...merged.values()].sort((left, right) =>
    left.purl.localeCompare(right.purl),
  );
}

export const __testing = {
  extractGradle,
  extractNpm,
  extractPub,
  isRuntimeGradleConfiguration,
  parseMavenCoordinate,
  parseMavenPom,
  parseNugetNuspec,
};
