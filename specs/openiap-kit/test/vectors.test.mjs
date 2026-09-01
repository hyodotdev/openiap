// Verifies the published signature vectors against an implementation written
// only from SPEC.md — no IAPKit code is imported. If this file needs to reach
// into the reference implementation to pass, the specification is underspecified.

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Ajv from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { WEBHOOK, bundleSchema } from "../src/index.mjs";

const vectors = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../vectors/signatures.json", import.meta.url)),
    "utf8",
  ),
);

/** The whole of the signing rule, as SPEC.md states it. */
function signFromSpec(secret, timestampSeconds, body) {
  return `v1=${createHmac("sha256", secret).update(`${timestampSeconds}.${body}`).digest("hex")}`;
}

/** The whole of the verification rule, as SPEC.md states it. */
function verifyFromSpec({ header, secret, timestampSeconds, body, now }) {
  if (Math.abs(now - timestampSeconds) > WEBHOOK.toleranceSeconds) return false;
  const expected = Buffer.from(signFromSpec(secret, timestampSeconds, body));
  return header
    .split(",")
    .map((part) => Buffer.from(part.trim()))
    .some(
      (presented) =>
        presented.length === expected.length &&
        timingSafeEqual(presented, expected),
    );
}

describe("signature vectors", () => {
  it("names every header the transport uses", () => {
    // WEBHOOK is derived from this file, so comparing the two would be circular.
    // What is worth pinning is that the file declares a complete, well-formed
    // set — a missing header would silently make an export undefined.
    for (const key of ["signature", "timestamp", "eventId", "deliveryId"]) {
      expect(vectors.headers[key], `${key} header missing`).toMatch(
        /^openiap-[a-z-]+$/,
      );
    }
    expect(Object.values(vectors.headers)).toHaveLength(
      new Set(Object.values(vectors.headers)).size,
    );
    expect(WEBHOOK.toleranceSeconds).toBeGreaterThan(0);
  });

  it.each(vectors.cases.map((c) => [c.name, c]))(
    "%s reproduces its expected signature",
    (_name, testCase) => {
      const produced = testCase.previousSecret
        ? `${signFromSpec(testCase.secret, testCase.timestamp, testCase.body)},${signFromSpec(testCase.previousSecret, testCase.timestamp, testCase.body)}`
        : signFromSpec(testCase.secret, testCase.timestamp, testCase.body);
      expect(produced).toBe(testCase.expected);
    },
  );

  it("a rotating emitter is accepted by a receiver that still holds only the previous key", () => {
    const rotation = vectors.cases.find((c) => c.name === "during-rotation");
    expect(rotation.presentedHeader).toContain(", ");
    expect(
      verifyFromSpec({
        header: rotation.presentedHeader,
        secret: rotation.previousSecret,
        timestampSeconds: rotation.timestamp,
        body: rotation.body,
        now: rotation.timestamp,
      }),
    ).toBe(true);
  });

  it("contains a valid body that fails after parse-and-reserialize", () => {
    const raw = vectors.cases.find((c) => c.name === "raw-utf8-body");
    expect(JSON.stringify(JSON.parse(raw.body))).not.toBe(raw.body);
    expect(
      verifyFromSpec({
        header: raw.expected,
        secret: raw.secret,
        timestampSeconds: raw.timestamp,
        body: JSON.stringify(JSON.parse(raw.body)),
        now: raw.timestamp,
      }),
    ).toBe(false);
  });

  it("comparing the header as a whole fails during rotation, which is why the rule says to split", () => {
    const rotation = vectors.cases.find((c) => c.name === "during-rotation");
    const single = signFromSpec(
      rotation.secret,
      rotation.timestamp,
      rotation.body,
    );
    expect(rotation.expected).not.toBe(single);
    expect(rotation.expected.split(",")).toContain(single);
  });

  it("pins retry identity while requiring a fresh timestamp and signature", () => {
    const first = vectors.cases.find((c) => c.name === "single-key");
    const retry = vectors.cases.find((c) => c.name === "retry-after-backoff");
    expect(JSON.parse(retry.body).eventId).toBe(JSON.parse(first.body).eventId);
    expect(retry.body).toBe(first.body);
    expect(retry.deliveryId).toBe(first.deliveryId);
    expect(retry.timestamp).toBeGreaterThan(first.timestamp);
    expect(retry.expected).not.toBe(first.expected);
    expect(
      verifyFromSpec({
        header: first.expected,
        secret: retry.secret,
        timestampSeconds: retry.timestamp,
        body: retry.body,
        now: retry.timestamp,
      }),
    ).toBe(false);
  });

  it.each(vectors.rejections.map((c) => [c.name, c]))(
    "%s is rejected",
    (_name, testCase) => {
      expect(
        verifyFromSpec({
          header: testCase.presentedSignature,
          secret: testCase.secret,
          timestampSeconds: testCase.timestamp,
          body: testCase.body,
          now: testCase.receiverNow ?? testCase.timestamp,
        }),
      ).toBe(false);
    },
  );

  it.each(vectors.responseSemantics.cases.map((c) => [c.status, c]))(
    "response %s maps to its SPEC.md 9.4.3 action",
    (_status, testCase) => {
      // The whole of the response rule, written only from SPEC.md 9.4.3.
      const classifyFromSpec = (status) => {
        if (status >= 200 && status < 300) return "delivered";
        if (status === 408 || status === 429 || status >= 500) return "retry";
        return "permanent-failure";
      };
      expect(classifyFromSpec(testCase.status)).toBe(testCase.action);
    },
  );

  it("every signature is lowercase hex behind the v1= prefix", () => {
    for (const testCase of vectors.cases) {
      for (const part of testCase.expected.split(",")) {
        expect(part.startsWith(WEBHOOK.signaturePrefix)).toBe(true);
        expect(part.slice(WEBHOOK.signaturePrefix.length)).toMatch(
          /^[0-9a-f]{64}$/,
        );
      }
    }
  });

  it("the body of every event case is itself a valid event document", () => {
    const ajv = new Ajv({ strict: true, allErrors: true });
    ajv.addSchema(bundleSchema, "bundle");
    const validate = ajv.getSchema("bundle#/$defs/CommerceEvent");
    for (const testCase of vectors.cases) {
      const parsed = JSON.parse(testCase.body);
      expect(
        validate(parsed),
        `${testCase.name}: ${JSON.stringify(validate.errors)}`,
      ).toBe(true);
    }
  });
});
