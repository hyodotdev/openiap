import assert from "node:assert/strict";
import test from "node:test";

import {
  verifyNpmReleaseProvenance,
  verifyNpmSignatureAuditResult,
} from "./verify-npm-release-provenance.mjs";

const expectedCommit = "a".repeat(40);
const expectedTag = "expo-iap-5.1.0";
const workflowFilename = "release-expo.yml";
const artifactDigest = "d".repeat(128);
const artifactIntegrity = `sha512-${Buffer.from(artifactDigest, "hex").toString("base64")}`;

function fixture({
  gitHead = expectedCommit,
  workflowRef = `refs/tags/${expectedTag}`,
  dependencyCommit = expectedCommit,
  subjectName = "pkg:npm/expo-iap@5.1.0",
  subjectDigest = artifactDigest,
  integrity = artifactIntegrity,
} = {}) {
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: subjectName, digest: { sha512: subjectDigest } }],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            path: `.github/workflows/${workflowFilename}`,
            ref: workflowRef,
            repository: "https://github.com/hyodotdev/openiap",
          },
        },
        resolvedDependencies: [
          {
            uri: `git+https://github.com/hyodotdev/openiap@${workflowRef}`,
            digest: { gitCommit: dependencyCommit },
          },
        ],
      },
    },
  };
  return {
    metadata: {
      version: "5.1.0",
      gitHead,
      dist: { integrity },
    },
    verifiedEntry: {
      name: "expo-iap",
      version: "5.1.0",
      registry: "https://registry.npmjs.org",
      attestations: {
        provenance: { predicateType: "https://slsa.dev/provenance/v1" },
      },
      attestationBundles: [
        {
          predicateType: "https://slsa.dev/provenance/v1",
          bundle: {
            dsseEnvelope: {
              payload: Buffer.from(JSON.stringify(statement)).toString(
                "base64",
              ),
            },
          },
        },
      ],
    },
  };
}

function verify(overrides, signatureVerifier) {
  const { metadata, verifiedEntry } = fixture(overrides);
  return verifyNpmReleaseProvenance({
    metadata,
    packageName: "expo-iap",
    version: "5.1.0",
    expectedCommit,
    expectedTag,
    workflowFilename,
    signatureVerifier: signatureVerifier ?? (async () => verifiedEntry),
  });
}

test("accepts a signature-audited package for the exact release tag", async () => {
  let signatureAudited = false;
  const { verifiedEntry } = fixture();
  await assert.doesNotReject(() =>
    verify({}, async () => {
      signatureAudited = true;
      return verifiedEntry;
    }),
  );
  assert.equal(signatureAudited, true);
});

test("rejects a failed Sigstore signature and attestation audit", async () => {
  await assert.rejects(
    () =>
      verify({}, async () => {
        throw new Error("invalid Sigstore bundle");
      }),
    /invalid Sigstore bundle/,
  );
});

test("requires npm to report verified provenance for the exact package", () => {
  const { verifiedEntry } = fixture();
  const auditResult = {
    verified: [verifiedEntry],
  };
  assert.equal(
    verifyNpmSignatureAuditResult({
      auditResult,
      packageName: "expo-iap",
      version: "5.1.0",
    }),
    auditResult.verified[0],
  );
  assert.throws(
    () =>
      verifyNpmSignatureAuditResult({
        auditResult,
        packageName: "another-package",
        version: "5.1.0",
      }),
    /did not report a verified provenance attestation/,
  );
  assert.throws(
    () =>
      verifyNpmSignatureAuditResult({
        auditResult: {
          verified: [{ ...verifiedEntry, attestationBundles: [] }],
        },
        packageName: "expo-iap",
        version: "5.1.0",
      }),
    /did not report a verified provenance attestation/,
  );
});

test("rejects a package gitHead that differs from the tag target", async () => {
  await assert.rejects(
    () => verify({ gitHead: "b".repeat(40) }),
    /gitHead mismatch/,
  );
});

test("rejects branch-ref provenance for a tagged package", async () => {
  await assert.rejects(
    () => verify({ workflowRef: "refs/heads/main" }),
    /does not attest/,
  );
});

test("rejects provenance whose resolved commit differs from the tag target", async () => {
  await assert.rejects(
    () => verify({ dependencyCommit: "c".repeat(40) }),
    /does not attest/,
  );
});

test("rejects provenance for a different package subject", async () => {
  await assert.rejects(
    () => verify({ subjectName: "pkg:npm/another-package@5.1.0" }),
    /does not attest/,
  );
});

test("rejects provenance whose artifact digest differs from npm integrity", async () => {
  await assert.rejects(
    () => verify({ subjectDigest: "e".repeat(128) }),
    /does not attest/,
  );
});

test("rejects npm metadata without a sha512 artifact integrity", async () => {
  await assert.rejects(
    () => verify({ integrity: null }),
    /missing dist\.integrity/,
  );
});
