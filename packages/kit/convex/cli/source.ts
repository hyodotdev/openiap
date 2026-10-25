import { ConvexError, v, type Infer } from "convex/values";
import { hmacSha256Hex, verifyHmacSha256Hex } from "../utils/sha256";
import type { CliScope } from "./scope";

export const cliStartSourceValidator = v.object({
  sourceKey: v.string(),
  issuedAt: v.number(),
  mac: v.string(),
});

interface StartInput {
  name: string;
  scope: CliScope;
}
type StartSource = Infer<typeof cliStartSourceValidator>;

function sourceSecret(): string {
  const secret = process.env.IAPKIT_VERIFICATION_SOURCE_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret))
    throw new ConvexError({
      code: "REQUEST_FAILED",
      message: "CLI login is temporarily unavailable. Retry later.",
    });
  return secret;
}

function signedInput(
  input: StartInput,
  source: Pick<StartSource, "sourceKey" | "issuedAt">,
): string {
  return JSON.stringify([
    "iapkit-cli-start-v1",
    input.name,
    input.scope,
    source.sourceKey,
    source.issuedAt,
  ]);
}

export async function withCliStartSource(
  input: StartInput,
  requestSource: string,
): Promise<StartInput & { sourceAuth: StartSource }> {
  const secret = sourceSecret();
  const source = {
    sourceKey: await hmacSha256Hex(
      secret,
      JSON.stringify(["iapkit-cli-source-v1", requestSource]),
    ),
    issuedAt: Date.now(),
  };
  return {
    ...input,
    sourceAuth: {
      ...source,
      mac: await hmacSha256Hex(secret, signedInput(input, source)),
    },
  };
}

export async function assertCliStartSource(
  input: StartInput & { sourceAuth?: StartSource },
): Promise<string> {
  const source = input.sourceAuth;
  const now = Date.now();
  if (
    !source ||
    !/^[a-f0-9]{64}$/.test(source.sourceKey) ||
    !Number.isSafeInteger(source.issuedAt) ||
    source.issuedAt > now + 30_000 ||
    now - source.issuedAt > 120_000 ||
    !(await verifyHmacSha256Hex(
      sourceSecret(),
      signedInput(input, source),
      source.mac,
    ))
  )
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Start CLI logins through the IAPKit server.",
    });
  return source.sourceKey;
}
