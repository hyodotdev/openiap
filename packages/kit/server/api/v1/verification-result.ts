import { api } from "@/convex";
import { client } from "../../convex";
import {
  enforceVerifyResponseContract,
  type VerifyResponseContractResult,
} from "./response-contract";
import { normalizeEnvironment } from "../../../convex/commerce/contract";
import { isSettledRejection } from "./replay-guard";
import type { TransactionDetails } from "../../../convex/purchases/shared";
import type { VerificationInput } from "../../../convex/purchases/verificationInput";

interface ProductClientPayload {
  format: "toml" | "json" | "text";
  body: string;
  version: number;
  updatedAt: number;
}

export interface VerificationReceipt {
  isValid: boolean;
  state: string;
  productId?: string;
  environment?: "Sandbox" | "Production";
  stableRejection?: boolean;
  transactionDetails?: TransactionDetails;
}

export async function verificationResult({
  apiKey,
  store,
  receipt,
  input,
  correlationId,
}: {
  apiKey: string;
  store: VerificationInput["store"];
  receipt: VerificationReceipt;
  input: {
    includeClientPayload?: boolean;
    includeTransactionDetails?: boolean;
  };
  correlationId: string;
}): Promise<VerifyResponseContractResult> {
  const {
    stableRejection: _stableRejection,
    transactionDetails,
    ...publicReceipt
  } = receipt;
  let clientPayload: ProductClientPayload | null = null;
  if (
    input.includeClientPayload === true &&
    receipt.isValid &&
    receipt.productId &&
    (store === "apple" || store === "google")
  ) {
    try {
      clientPayload = await client.query(
        api.products.query.getProductClientPayload,
        {
          apiKey,
          platform: store === "apple" ? "IOS" : "Android",
          // Use only the product id returned by store verification. The
          // caller-provided expectedProductId is a check, not an authority
          // for selecting project metadata.
          productId: receipt.productId,
        },
      );
    } catch (error) {
      // Optional enrichment: verification must still succeed if this read
      // fails. Log only the error type, never payload bodies.
      console.error(
        "[purchase/verify] CLIENT_PAYLOAD_LOOKUP_FAILED: %s",
        error instanceof Error ? error.name : typeof error,
      );
    }
  }

  return enforceVerifyResponseContract({
    store,
    ...publicReceipt,
    ...(clientPayload ? { clientPayload } : {}),
    ...(input.includeTransactionDetails === true
      ? {
          ...transactionDetails,
          ...(receipt.environment
            ? {
                commerceEnvironment: normalizeEnvironment(receipt.environment),
              }
            : {}),
          correlationId,
          ...(receipt.isValid
            ? {}
            : { finalVerdict: isSettledRejection(store, receipt) }),
        }
      : {}),
  });
}
