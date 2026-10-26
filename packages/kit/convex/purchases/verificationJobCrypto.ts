"use node";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { Infer } from "convex/values";
import { verificationSourceSecret } from "./verificationSource";
import type { verificationJobCiphertext } from "./verificationJobModel";

type Ciphertext = Infer<typeof verificationJobCiphertext>;

function encryptionKey(): Buffer {
  return createHash("sha256")
    .update(
      `iapkit-verification-job-encryption-v1:${verificationSourceSecret("enqueue")}`,
    )
    .digest();
}

export function encryptVerificationJob(
  plaintext: string,
  binding: string,
): Ciphertext {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(binding));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
  };
}

export function decryptVerificationJob(
  payload: Ciphertext,
  binding: string,
): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(payload.iv, "hex"),
  );
  decipher.setAAD(Buffer.from(binding));
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
