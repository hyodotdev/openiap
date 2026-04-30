import { describe, expect, it } from "vitest";
import {
  generateKeyPairSync,
  createVerify,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";
import { derSignatureToJoseSignature, mintAscJwt } from "./jwt";

function generateP8() {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  return privateKey.export({ format: "pem", type: "pkcs8" }).toString();
}

describe("mintAscJwt", () => {
  it("mints a 3-segment JWT with ES256 header and ASC audience", () => {
    const pem = generateP8();
    const token = mintAscJwt({
      keyId: "ABCD1234",
      privateKey: pem,
      issuerId: "00000000-0000-0000-0000-aaaaaaaaaaaa",
      nowSeconds: () => 1_711_000_000,
    });

    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf-8"),
    );
    expect(header).toEqual({ alg: "ES256", kid: "ABCD1234", typ: "JWT" });

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    );
    expect(payload.iss).toBe("00000000-0000-0000-0000-aaaaaaaaaaaa");
    expect(payload.aud).toBe("appstoreconnect-v1");
    expect(payload.iat).toBe(1_711_000_000);
    expect(payload.exp).toBe(1_711_000_000 + 600);
  });

  it("respects custom ttlSeconds", () => {
    const pem = generateP8();
    const token = mintAscJwt({
      keyId: "X",
      privateKey: pem,
      issuerId: "iss",
      ttlSeconds: 1_200,
      nowSeconds: () => 1,
    });
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf-8"),
    );
    expect(payload.exp - payload.iat).toBe(1_200);
  });

  it("produces a signature that verifies against the public key with the JOSE r||s format", () => {
    const pem = generateP8();
    const token = mintAscJwt({
      keyId: "k",
      privateKey: pem,
      issuerId: "iss",
    });

    const [headerB64, payloadB64, sigB64] = token.split(".");
    const signingInput = `${headerB64}.${payloadB64}`;
    const joseSig = Buffer.from(sigB64, "base64url");
    expect(joseSig.length).toBe(64);

    // Convert back to DER for node verifier.
    const r = bigIntFrom(joseSig.subarray(0, 32));
    const s = bigIntFrom(joseSig.subarray(32));
    const der = encodeDerSignature(r, s);

    const privateKey = createPrivateKey({ key: pem, format: "pem" });
    const publicKey = createPublicKey(privateKey)
      .export({ format: "pem", type: "spki" })
      .toString();
    const verifier = createVerify("SHA256");
    verifier.update(signingInput);
    verifier.end();
    expect(verifier.verify(publicKey, der)).toBe(true);
  });
});

describe("derSignatureToJoseSignature", () => {
  it("strips DER framing and left-pads r,s to fixed coord size", () => {
    // DER for r=0x01, s=0x02 ECDSA over P-256.
    // SEQUENCE 06 02 01 01 02 01 02
    const der = Buffer.from([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02]);
    const jose = derSignatureToJoseSignature(der, 32);
    expect(jose.length).toBe(64);
    // r should be 31 zero bytes followed by 0x01
    expect(jose[31]).toBe(0x01);
    expect(jose[63]).toBe(0x02);
  });
});

function bigIntFrom(buf: Buffer): Buffer {
  // For DER encoding, leading bit set means we need a 0x00 prefix.
  if ((buf[0] ?? 0) & 0x80) {
    return Buffer.concat([Buffer.from([0x00]), buf]);
  }
  // Strip excess leading zeros so the integer is canonical.
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) i += 1;
  return buf.subarray(i);
}

function encodeDerSignature(r: Buffer, s: Buffer): Buffer {
  const rPart = Buffer.concat([Buffer.from([0x02, r.length]), r]);
  const sPart = Buffer.concat([Buffer.from([0x02, s.length]), s]);
  const inner = Buffer.concat([rPart, sPart]);
  return Buffer.concat([Buffer.from([0x30, inner.length]), inner]);
}
