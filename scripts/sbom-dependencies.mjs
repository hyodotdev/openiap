#!/usr/bin/env node

/**
 * Direct runtime dependency readers for the artifacts OpenIAP publishes.
 *
 * Maven and NuGet inventories come from their published POM/nuspec, which is
 * the consumer-visible contract. The remaining readers use simple manifests
 * and fail when a declaration shape cannot be classified.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export class PublishedMetadataUnavailableError extends Error {}

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
    }
  }

  if (state === "block-comment" || state === "raw-string") {
    throw new Error(`Unterminated Gradle ${state.replace("-", " ")}`);
  }
  return {
    commentFree: commentFree.join(""),
    structural: structural.join(""),
  };
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
    if (braceDepths[match.index] !== 0) continue;
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
  const previousCodeIndex = (from) => {
    let cursor = from;
    while (cursor >= 0 && /\s/u.test(structural[cursor])) cursor -= 1;
    return cursor;
  };
  const identifierBefore = (from) => {
    const end = previousCodeIndex(from) + 1;
    let start = end;
    while (start > 0 && /[A-Za-z0-9_]/u.test(structural[start - 1])) {
      start -= 1;
    }
    return structural.slice(start, end);
  };
  const callBefore = (close) => {
    let depth = 1;
    let cursor = close - 1;
    for (; cursor >= 0 && depth > 0; cursor -= 1) {
      if (structural[cursor] === ")") depth += 1;
      if (structural[cursor] === "(") depth -= 1;
    }
    if (depth !== 0) throw new Error("Unbalanced Gradle call parentheses");
    return identifierBefore(cursor);
  };

  for (let index = 0; index < structural.length; index += 1) {
    if (structural[index] === "{") {
      const parentVisible = visible.at(-1);
      let childVisible = false;
      if (parentVisible) {
        const previous = previousCodeIndex(index - 1);
        const owner =
          structural[previous] === ")"
            ? callBefore(previous)
            : identifierBefore(previous);
        if (["if", "for", "when", "while", "else"].includes(owner)) {
          childVisible = true;
        } else if (owner !== "constraints" && structural[previous] !== ")") {
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
    /[\s*^~<>=|,[\](){}]/u.test(version) ||
    /\bx\b/iu.test(version)
  );
}

function dependencyEntry({ name, version, purl, properties = [] }) {
  if (!name || !version || !purl) {
    throw new Error(
      `Incomplete dependency entry: ${JSON.stringify({ name, version, purl })}`,
    );
  }
  const versionProperties = isVersionConstraint(version)
    ? [{ name: "openiap:sbom:version-constraint", value: version }]
    : [];
  return {
    name,
    version,
    purl,
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
    }
  }
  return resolved;
}

function interpolateGradle(coordinate, locals) {
  return coordinate.replace(
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

function parseMavenPom(source, context) {
  const properties = new Map();
  const propertiesBlock = source.match(
    /<properties>([\s\S]*?)<\/properties>/u,
  )?.[1];
  if (propertiesBlock) {
    for (const match of propertiesBlock.matchAll(
      /<([A-Za-z_][\w.-]*)>([^<]+)<\/\1>/gu,
    )) {
      properties.set(match[1], decodeXml(match[2].trim()));
    }
  }

  const profiles = source.match(/<profiles>([\s\S]*?)<\/profiles>/u)?.[1];
  if (profiles && /<dependency\b/u.test(profiles)) {
    throw new Error(`Unsupported profiled Maven dependency in ${context.url}`);
  }

  const withoutManaged = source
    .replace(/<dependencyManagement>[\s\S]*?<\/dependencyManagement>/gu, "")
    .replace(/<profiles>[\s\S]*?<\/profiles>/gu, "")
    .replace(/<build>[\s\S]*?<\/build>/gu, "");
  const found = new Map();

  for (const match of withoutManaged.matchAll(
    /<dependency>([\s\S]*?)<\/dependency>/gu,
  )) {
    const block = match[1];
    const scope = xmlValue(block, "scope") ?? "compile";
    const optional = xmlValue(block, "optional")?.toLowerCase() === "true";
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

    const group = xmlValue(block, "groupId");
    const artifact = xmlValue(block, "artifactId");
    const rawVersion = xmlValue(block, "version");
    if (!group || !artifact || !rawVersion) {
      throw new Error(`Incomplete runtime dependency in ${context.url}`);
    }
    const version = resolveMavenValue(rawVersion, properties, context);
    const qualifiers = [];
    const type = xmlValue(block, "type");
    const classifier = xmlValue(block, "classifier");
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

function parseNugetNuspec(source, context) {
  const dependenciesBlock = source.match(
    /<dependencies>([\s\S]*?)<\/dependencies>/u,
  )?.[1];
  if (!dependenciesBlock) return [];

  const found = new Map();
  for (const match of dependenciesBlock.matchAll(
    /<dependency\b([^>]*)\/?>(?:<\/dependency>)?/gu,
  )) {
    const attributes = match[1];
    const name = attributes.match(/\bid\s*=\s*"([^"]+)"/iu)?.[1];
    const version = attributes.match(/\bversion\s*=\s*"([^"]+)"/iu)?.[1];
    if (!name || !version) {
      throw new Error(
        `Incomplete published NuGet dependency in ${context.url}`,
      );
    }
    const entry = dependencyEntry({
      name: decodeXml(name),
      version: decodeXml(version),
      purl: `pkg:nuget/${encodeURIComponent(decodeXml(name))}@${encodePurlVersion(decodeXml(version))}`,
    });
    found.set(entry.purl.toLowerCase(), entry);
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
  const dependencies = readJson(root, manifest).dependencies ?? {};
  return Object.entries(dependencies)
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

const EXTRACTORS = {
  gradle: extractGradle,
  "maven-pom": extractMavenPom,
  npm: extractNpm,
  none: extractNone,
  "nuget-nuspec": extractNugetNuspec,
  pub: extractPub,
  swift: extractSwift,
};

export async function extractDirectDependencies(root, source, context = {}) {
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
