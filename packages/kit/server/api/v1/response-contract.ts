import * as v from "valibot";

import {
  clientPayloadSchema,
  environmentSchema,
  FALLBACK_PURCHASE_STATE,
  productIdSchema,
  unifiedPurchaseStateSchema,
  verifyPurchaseSuccessResponseSchema,
} from "./route-response-schemas";

export type VerifyPurchaseResponse = v.InferOutput<
  typeof verifyPurchaseSuccessResponseSchema
>;

export type VerifyResponseContractResult =
  | { ok: true; response: VerifyPurchaseResponse; violations: string[] }
  | { ok: false; violations: string[] };

const fits = (schema: v.GenericSchema, value: unknown): boolean =>
  v.safeParse(schema, value).success;

/**
 * Holds `/v1/purchase/verify` responses to the schema the OpenAPI document
 * publishes and every SDK decodes.
 *
 * `verifyPurchaseSuccessResponseSchema` previously only fed `describeRoute`,
 * so the documented shape and the emitted body could drift apart silently —
 * and shipped apps decode this body with fixed parsers they cannot update.
 *
 * Metadata that falls outside the contract is degraded, not passed through:
 * an out-of-contract `environment` or `clientPayload.format` makes several
 * SDKs reject an otherwise valid receipt. `isValid` is never rewritten — the
 * verdict is authoritative, and drifting metadata must not revoke a real
 * entitlement.
 */
export const enforceVerifyResponseContract = (
  candidate: Record<string, unknown>,
): VerifyResponseContractResult => {
  const parsed = v.safeParse(verifyPurchaseSuccessResponseSchema, candidate);
  if (parsed.success) {
    return { ok: true, response: parsed.output, violations: [] };
  }

  const violations: string[] = [];
  const degraded: Record<string, unknown> = { ...candidate };

  if (!fits(unifiedPurchaseStateSchema, degraded.state)) {
    violations.push("state");
    degraded.state = FALLBACK_PURCHASE_STATE;
  }
  for (const [field, schema] of [
    ["productId", productIdSchema],
    ["environment", environmentSchema],
    ["clientPayload", clientPayloadSchema],
  ] as const) {
    if (degraded[field] !== undefined && !fits(schema, degraded[field])) {
      violations.push(field);
      delete degraded[field];
    }
  }

  const reparsed = v.safeParse(verifyPurchaseSuccessResponseSchema, degraded);
  if (!reparsed.success) {
    // Only `store` and `isValid` remain, both handler-supplied — a malformed
    // verdict is a server defect, not contract drift.
    return {
      ok: false,
      violations: [
        ...violations,
        ...reparsed.issues.map((issue) => v.getDotPath(issue) ?? "<root>"),
      ],
    };
  }

  return { ok: true, response: reparsed.output, violations };
};
