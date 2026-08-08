#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SLSA_PROVENANCE_V1 = "https://slsa.dev/provenance/v1";
const IN_TOTO_STATEMENT_V1 = "https://in-toto.io/Statement/v1";
const NPM_REGISTRY = "https://registry.npmjs.org";

function decodeStatement(attestation) {
  const payload = attestation?.bundle?.dsseEnvelope?.payload;
  if (typeof payload !== "string" || payload.length === 0) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function sha512HexFromIntegrity(integrity) {
  if (typeof integrity !== "string") {
    throw new Error("npm metadata is missing dist.integrity");
  }
  const sha512 = integrity
    .split(/\s+/u)
    .find((value) => value.startsWith("sha512-"));
  const encoded = sha512?.slice("sha512-".length);
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) {
    throw new Error("npm metadata has no valid sha512 integrity digest");
  }
  const digest = Buffer.from(encoded, "base64");
  if (digest.length !== 64) {
    throw new Error("npm metadata has an invalid sha512 integrity digest");
  }
  return digest.toString("hex");
}

export function verifyNpmSignatureAuditResult({
  auditResult,
  packageName,
  version,
}) {
  const verified = Array.isArray(auditResult?.verified)
    ? auditResult.verified
    : [];
  const verifiedEntry = verified.find((entry) => {
    let registryOrigin;
    try {
      registryOrigin = new URL(entry?.registry).origin;
    } catch {
      return false;
    }
    return (
      entry?.name === packageName &&
      entry?.version === version &&
      registryOrigin === NPM_REGISTRY &&
      entry?.attestations?.provenance?.predicateType === SLSA_PROVENANCE_V1 &&
      Array.isArray(entry?.attestationBundles) &&
      entry.attestationBundles.some(
        (attestation) =>
          attestation?.predicateType === SLSA_PROVENANCE_V1 &&
          typeof attestation?.bundle?.dsseEnvelope?.payload === "string",
      )
    );
  });
  if (!verifiedEntry) {
    throw new Error(
      `npm did not report a verified provenance attestation for ${packageName}@${version}`,
    );
  }
  return verifiedEntry;
}

export async function verifyNpmPackageSignature({ packageName, version }) {
  if (
    !/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u.test(packageName)
  ) {
    throw new Error(`Invalid npm package name: ${packageName}`);
  }
  if (!/^[0-9A-Za-z][0-9A-Za-z.+-]*$/u.test(version)) {
    throw new Error(`Invalid npm package version: ${version}`);
  }

  const auditDirectory = await mkdtemp(join(tmpdir(), "openiap-npm-audit-"));
  const npmEnv = {
    ...process.env,
    NPM_CONFIG_REGISTRY: NPM_REGISTRY,
    NPM_CONFIG_USERCONFIG: join(auditDirectory, ".npmrc"),
  };
  delete npmEnv.NODE_AUTH_TOKEN;
  delete npmEnv.NPM_TOKEN;

  try {
    await writeFile(
      join(auditDirectory, "package.json"),
      `${JSON.stringify({ name: "openiap-provenance-audit", private: true })}\n`,
    );
    await writeFile(
      npmEnv.NPM_CONFIG_USERCONFIG,
      `registry=${NPM_REGISTRY}\nignore-scripts=true\n`,
    );
    execFileSync(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--save-exact",
        "--omit=optional",
        "--legacy-peer-deps",
        "--no-audit",
        "--no-fund",
        "--prefer-online",
        `${packageName}@${version}`,
      ],
      { cwd: auditDirectory, env: npmEnv, stdio: "inherit" },
    );
    const auditOutput = execFileSync(
      "npm",
      ["audit", "signatures", "--json", "--include-attestations"],
      {
        cwd: auditDirectory,
        env: npmEnv,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      },
    );
    return verifyNpmSignatureAuditResult({
      auditResult: JSON.parse(auditOutput),
      packageName,
      version,
    });
  } catch (error) {
    throw new Error(
      `npm signature and attestation audit failed for ${packageName}@${version}`,
      { cause: error },
    );
  } finally {
    await rm(auditDirectory, { recursive: true, force: true });
  }
}

export async function verifyNpmReleaseProvenance({
  metadata,
  packageName,
  version,
  expectedCommit,
  expectedTag,
  workflowFilename,
  repository = "hyodotdev/openiap",
  serverUrl = "https://github.com",
  signatureVerifier = verifyNpmPackageSignature,
}) {
  const verifiedEntry = await signatureVerifier({ packageName, version });

  if (metadata?.version !== version) {
    throw new Error(
      `registry version mismatch: expected ${version}, received ${metadata?.version ?? "missing"}`,
    );
  }
  if (metadata?.gitHead !== expectedCommit) {
    throw new Error(
      `npm gitHead mismatch for ${packageName}@${version}: expected ${expectedCommit}, received ${metadata?.gitHead ?? "missing"}`,
    );
  }

  const expectedRef = `refs/tags/${expectedTag}`;
  const expectedWorkflowPath = `.github/workflows/${workflowFilename}`;
  const expectedRepository = `${serverUrl}/${repository}`;
  const expectedUri = `git+${serverUrl}/${repository}@${expectedRef}`;
  const expectedSubject = `pkg:npm/${packageName}@${version}`;
  const expectedArtifactDigest = sha512HexFromIntegrity(
    metadata?.dist?.integrity,
  );
  const attestations = Array.isArray(verifiedEntry?.attestationBundles)
    ? verifiedEntry.attestationBundles
    : [];

  const matchingStatement = attestations
    .filter((attestation) => attestation?.predicateType === SLSA_PROVENANCE_V1)
    .map(decodeStatement)
    .filter(Boolean)
    .find((statement) => {
      const buildDefinition = statement?.predicate?.buildDefinition;
      const workflow = buildDefinition?.externalParameters?.workflow;
      const subjects = Array.isArray(statement?.subject)
        ? statement.subject
        : [];
      const dependencies = Array.isArray(buildDefinition?.resolvedDependencies)
        ? buildDefinition.resolvedDependencies
        : [];
      return (
        statement?._type === IN_TOTO_STATEMENT_V1 &&
        statement?.predicateType === SLSA_PROVENANCE_V1 &&
        subjects.some(
          (subject) =>
            subject?.name === expectedSubject &&
            subject?.digest?.sha512?.toLowerCase() === expectedArtifactDigest,
        ) &&
        workflow?.path === expectedWorkflowPath &&
        workflow?.ref === expectedRef &&
        workflow?.repository === expectedRepository &&
        dependencies.some(
          (dependency) =>
            dependency?.uri === expectedUri &&
            dependency?.digest?.gitCommit === expectedCommit,
        )
      );
    });

  if (!matchingStatement) {
    throw new Error(
      `npm provenance for ${packageName}@${version} does not attest ${expectedWorkflowPath}@${expectedRef} at ${expectedCommit}`,
    );
  }
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${label} request failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function verifyPublishedNpmRelease({
  packageName,
  version,
  expectedCommit,
  expectedTag,
  workflowFilename,
  repository = process.env.GITHUB_REPOSITORY || "hyodotdev/openiap",
  serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com",
}) {
  const encodedPackage = encodeURIComponent(packageName);
  const encodedVersion = encodeURIComponent(version);
  const metadata = await fetchJson(
    `https://registry.npmjs.org/${encodedPackage}/${encodedVersion}`,
    `${packageName}@${version} metadata`,
  );
  await verifyNpmReleaseProvenance({
    metadata,
    packageName,
    version,
    expectedCommit,
    expectedTag,
    workflowFilename,
    repository,
    serverUrl,
  });
}

async function main() {
  const [packageName, version, expectedCommit, expectedTag, workflowFilename] =
    process.argv.slice(2);
  if (
    !packageName ||
    !version ||
    !/^[0-9a-f]{40}$/u.test(expectedCommit ?? "") ||
    !expectedTag ||
    !workflowFilename
  ) {
    throw new Error(
      "Usage: verify-npm-release-provenance.mjs <package> <version> <40-char commit> <tag> <workflow filename>",
    );
  }

  await verifyPublishedNpmRelease({
    packageName,
    version,
    expectedCommit,
    expectedTag,
    workflowFilename,
  });
  console.log(
    `Verified npm gitHead and tag-ref provenance for ${packageName}@${version}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `npm release provenance verification failed: ${error.message}`,
    );
    process.exitCode = 1;
  });
}
