#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const AUTHORIZATION_FIELDS = [
  "repository",
  "workflowPath",
  "sourceRunId",
  "sourceRunAttempt",
  "sourceBranch",
  "sourceHeadSha",
  "tag",
  "tagSha",
];

function requireSha(value, label) {
  if (!/^[0-9a-f]{40}$/u.test(value ?? "")) {
    throw new Error(`${label} must be a 40-character lowercase Git SHA`);
  }
}

function requirePositiveInteger(value, label) {
  if (!/^[1-9][0-9]*$/u.test(value ?? "")) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function createNpmPublishAuthorization(values) {
  const authorization = Object.fromEntries(
    AUTHORIZATION_FIELDS.map((field) => [field, values[field]]),
  );
  for (const field of AUTHORIZATION_FIELDS) {
    if (typeof authorization[field] !== "string" || !authorization[field]) {
      throw new Error(`${field} is required`);
    }
  }
  requirePositiveInteger(authorization.sourceRunId, "sourceRunId");
  requirePositiveInteger(authorization.sourceRunAttempt, "sourceRunAttempt");
  requireSha(authorization.sourceHeadSha, "sourceHeadSha");
  requireSha(authorization.tagSha, "tagSha");
  return authorization;
}

export function verifyNpmPublishAuthorization({ authorization, expected }) {
  const normalized = createNpmPublishAuthorization(authorization);
  for (const field of AUTHORIZATION_FIELDS) {
    if (normalized[field] !== expected[field]) {
      throw new Error(
        `npm publish authorization ${field} mismatch: expected ${expected[field]}, received ${normalized[field]}`,
      );
    }
  }
}

async function main() {
  const [command, path, ...values] = process.argv.slice(2);
  if (!command || !path || values.length !== AUTHORIZATION_FIELDS.length) {
    throw new Error(
      `Usage: npm-publish-authorization.mjs <write|verify> <path> ${AUTHORIZATION_FIELDS.join(" ")}`,
    );
  }
  const expected = createNpmPublishAuthorization(
    Object.fromEntries(
      AUTHORIZATION_FIELDS.map((field, index) => [field, values[index]]),
    ),
  );

  if (command === "write") {
    await writeFile(path, `${JSON.stringify(expected, null, 2)}\n`, {
      flag: "wx",
    });
    return;
  }
  if (command === "verify") {
    const authorization = JSON.parse(await readFile(path, "utf8"));
    verifyNpmPublishAuthorization({ authorization, expected });
    console.log(
      `Verified npm publish authorization for ${expected.tag}@${expected.tagSha}`,
    );
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`npm publish authorization failed: ${error.message}`);
    process.exitCode = 1;
  });
}
