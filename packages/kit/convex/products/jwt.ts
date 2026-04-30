"use node";
// Minimal ES256 JWT minter for App Store Connect API authentication.
// ASC requires every request to carry a JWT in `Authorization: Bearer`
// signed with the project's downloaded `.p8` key (kid + issuerId).
//
// We do NOT reach for `jose` / `jsonwebtoken` here — both pull
// substantial node-only dependency trees into the Convex action
// bundle, and ASC's JWT shape is tiny (3 fields + ES256 over the
// canonical SHA-256 of the header.payload bytes). node:crypto on Bun
// already supports raw ECDSA over P-256.
//
// Pure helpers only; no Convex imports so this is unit-testable in
// vitest without an action runtime.

import { createPrivateKey, createSign } from "node:crypto";

export type AscJwtClaims = {
  iss: string; // issuerId — ASC > Users and Access > Keys
  scope?: string[]; // optional ASC scope claim
  // aud is fixed to "appstoreconnect-v1" by ASC.
  // iat / exp are computed from `nowSeconds`.
};

export type AscJwtOptions = {
  keyId: string; // ASC > Keys > Key ID
  privateKey: string; // PKCS#8 PEM (the .p8 file content)
  issuerId: string;
  // Token TTL in seconds. ASC enforces ≤ 1200s (20 min); default to a
  // conservative 600s to leave headroom for clock skew.
  ttlSeconds?: number;
  nowSeconds?: () => number; // injected for tests
};

export function mintAscJwt(opts: AscJwtOptions): string {
  const ttl = opts.ttlSeconds ?? 600;
  const now = opts.nowSeconds
    ? opts.nowSeconds()
    : Math.floor(Date.now() / 1000);

  const header = {
    alg: "ES256",
    kid: opts.keyId,
    typ: "JWT",
  };
  const payload: Record<string, unknown> = {
    iss: opts.issuerId,
    iat: now,
    exp: now + ttl,
    aud: "appstoreconnect-v1",
  };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const keyObj = createPrivateKey({
    key: opts.privateKey,
    format: "pem",
  });
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const derSignature = signer.sign(keyObj);

  // node:crypto signs in DER. ASC requires the JWS-flavored r||s
  // concatenation — convert.
  const jwsSignature = derSignatureToJoseSignature(derSignature, 32);
  return `${signingInput}.${base64UrlEncode(jwsSignature)}`;
}

function base64UrlEncode(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// DER-encoded ECDSA signature is `SEQUENCE { INTEGER r, INTEGER s }`.
// JWS expects fixed-length r||s (each `coordSize` bytes). Strip the
// leading 0x00 padding nodes adds for unsigned-positive encoding, then
// left-pad each integer back out to coordSize.
export function derSignatureToJoseSignature(
  der: Buffer | Uint8Array,
  coordSize: number,
): Buffer {
  const buf = Buffer.from(der);
  if (buf[0] !== 0x30) {
    throw new Error("Invalid DER signature: missing SEQUENCE tag");
  }
  let offset = 2;
  if ((buf[1] ?? 0) & 0x80) {
    // long-form length — uncommon at this size but legal.
    const lenBytes = (buf[1] ?? 0) & 0x7f;
    offset = 2 + lenBytes;
  }
  if (buf[offset] !== 0x02) {
    throw new Error("Invalid DER signature: missing first INTEGER tag");
  }
  const rLen = buf[offset + 1] ?? 0;
  const r = buf.subarray(offset + 2, offset + 2 + rLen);
  offset = offset + 2 + rLen;
  if (buf[offset] !== 0x02) {
    throw new Error("Invalid DER signature: missing second INTEGER tag");
  }
  const sLen = buf[offset + 1] ?? 0;
  const s = buf.subarray(offset + 2, offset + 2 + sLen);

  return Buffer.concat([
    leftPad(stripLeadingZeros(r), coordSize),
    leftPad(stripLeadingZeros(s), coordSize),
  ]);
}

function stripLeadingZeros(buf: Buffer): Buffer {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) i += 1;
  return buf.subarray(i);
}

function leftPad(buf: Buffer, size: number): Buffer {
  if (buf.length === size) return buf;
  if (buf.length > size) {
    throw new Error(
      `signature component is ${buf.length} bytes — cannot fit into ${size}`,
    );
  }
  const out = Buffer.alloc(size);
  buf.copy(out, size - buf.length);
  return out;
}
