import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { buildSchema, findBreakingChanges } from "graphql";
import { signatureClockOperator } from "./build-signature-clock.mjs";

const artifacts = {
  bundle: "generated/schemas/commerce-protocol.bundle.schema.json",
  http: "generated/bindings/http-binding.json",
  graphql: "generated/bindings/operations.graphql",
  signatures: "vectors/signatures.json",
};

const schemaAnnotations = new Set([
  "$schema",
  "$id",
  "$comment",
  "title",
  "description",
  "examples",
  "deprecated",
]);

// Compare the generated vocabulary conservatively. A changed assertion needs
// review even when it might accept all previously valid documents.
function compareSchemas(before, after, path, changes) {
  if (after === undefined) {
    changes.push(`${path} was removed`);
    return;
  }
  if (typeof before !== "object" || typeof after !== "object") {
    if (before !== after) changes.push(`${path} changed`);
    return;
  }

  for (const keyword of new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ])) {
    if (schemaAnnotations.has(keyword)) continue;
    const oldValue = before[keyword];
    const newValue = after[keyword];
    if (keyword === "properties") {
      const oldProperties = oldValue ?? {};
      for (const [name, schema] of Object.entries(oldProperties)) {
        compareSchemas(schema, newValue?.[name], `${path}.${name}`, changes);
      }
      for (const name of Object.keys(newValue ?? {})) {
        if (
          !Object.hasOwn(oldProperties, name) &&
          before.additionalProperties !== true &&
          before.additionalProperties !== undefined &&
          !isDeepStrictEqual(before.additionalProperties, {})
        ) {
          changes.push(`${path}.${name} was added to a restricted object`);
        }
      }
    } else if (keyword === "items" || keyword === "additionalProperties") {
      if (typeof oldValue === "object" && typeof newValue === "object") {
        compareSchemas(oldValue, newValue, `${path}.${keyword}`, changes);
      } else if (!isDeepStrictEqual(oldValue, newValue)) {
        changes.push(`${path} changed ${keyword}`);
      }
    } else {
      const setKeyword = ["required", "enum", "type"].includes(keyword);
      const normalize = (value) =>
        setKeyword && Array.isArray(value) ? [...value].sort() : value;
      if (!isDeepStrictEqual(normalize(oldValue), normalize(newValue))) {
        changes.push(`${path} changed ${keyword}`);
      }
    }
  }
}

export function protocolMajor(version) {
  const match =
    typeof version === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error(`Invalid protocol version: ${version}`);
  return BigInt(match[1]);
}

export function findCompatibilityChanges(before, after) {
  const changes = [];
  for (const [name, schema] of Object.entries(before.bundle.$defs)) {
    compareSchemas(schema, after.bundle.$defs[name], name, changes);
  }

  const operations = new Map(
    after.http.operations.map((operation) => [operation.name, operation]),
  );
  for (const { name, errors, ...previous } of before.http.operations) {
    const current = operations.get(name);
    if (!current) {
      changes.push(`Operation ${name} was removed`);
      continue;
    }
    for (const [key, value] of Object.entries(previous)) {
      if (!isDeepStrictEqual(value, current[key])) {
        changes.push(`Operation ${name} changed ${key}`);
      }
    }
    for (const code of errors) {
      if (!current.errors.includes(code))
        changes.push(`Operation ${name} removed error ${code}`);
    }
  }
  for (const [code, status] of Object.entries(before.http.errorStatus)) {
    if (status !== after.http.errorStatus[code])
      changes.push(`Error ${code} changed HTTP status or was removed`);
  }
  if (before.http.errorResponse !== after.http.errorResponse) {
    changes.push("HTTP error response schema changed");
  }
  for (const group of ["profiles", "bindings"]) {
    for (const [name, version] of Object.entries(before.http[group])) {
      const current = after.http[group][name];
      if (!current || protocolMajor(current) !== protocolMajor(version)) {
        changes.push(`${group}.${name} was removed or changed major version`);
      }
    }
  }

  for (const field of [
    "signaturePrefix",
    "contentType",
    "toleranceSeconds",
    "headers",
  ]) {
    if (!isDeepStrictEqual(before.signatures[field], after.signatures[field])) {
      changes.push(`Webhook signature changed ${field}`);
    }
  }

  if (
    signatureClockOperator(before.spec, before.signatures.toleranceSeconds) !==
    signatureClockOperator(after.spec, after.signatures.toleranceSeconds)
  ) {
    changes.push("Webhook signature changed the timestamp boundary");
  }

  const oldSchema = buildSchema(before.graphql);
  const newSchema = buildSchema(after.graphql);
  for (const root of [
    "getQueryType",
    "getMutationType",
    "getSubscriptionType",
  ]) {
    const previous = oldSchema[root]()?.name;
    if (previous && previous !== newSchema[root]()?.name) {
      changes.push(`GraphQL: root type ${previous} was replaced or removed`);
    }
  }
  for (const change of findBreakingChanges(oldSchema, newSchema)) {
    changes.push(`GraphQL: ${change.description}`);
  }
  return changes;
}

function loadArtifacts(read) {
  return {
    bundle: JSON.parse(read(artifacts.bundle)),
    http: JSON.parse(read(artifacts.http)),
    graphql: read(artifacts.graphql),
    signatures: JSON.parse(read(artifacts.signatures)),
    spec: read("SPEC.md"),
  };
}

function main() {
  const [flag, base, ...rest] = process.argv.slice(2);
  if (flag !== "--base" || !base || rest.length) {
    throw new Error(
      "Usage: node scripts/audit-compatibility.mjs --base <git-ref>",
    );
  }
  const root = new URL("../../../", import.meta.url);
  const git = (args) =>
    execFileSync("git", args, { cwd: fileURLToPath(root), encoding: "utf8" });
  const ref = git([
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${base}^{commit}`,
  ]).trim();
  const before = loadArtifacts((file) =>
    git(["show", `${ref}:specs/commerce-protocol/${file}`]),
  );
  const after = loadArtifacts((file) =>
    readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
  );
  const changes = findCompatibilityChanges(before, after);

  const previous = before.http.protocolVersion;
  const current = after.http.protocolVersion;
  const oldMajor = protocolMajor(previous);
  const newMajor = protocolMajor(current);
  console.log(
    `Commerce compatibility vs ${base} (${ref.slice(0, 12)}), protocol ${previous} → ${current}`,
  );
  for (const change of changes) console.log(`- ${change}`);
  if (newMajor < oldMajor || (newMajor === oldMajor && changes.length)) {
    console.error(
      "Review the listed changes and version requirements against SPEC.md §12.",
    );
    process.exitCode = 1;
  } else if (changes.length) {
    console.log(
      "Breaking changes detected under a new protocol major. Review the migration note.",
    );
  } else {
    console.log("No breaking changes detected in the wire contract.");
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
