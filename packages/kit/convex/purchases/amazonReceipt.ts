import { AmazonReceiptVerificationError } from "./errors";
import { HarmonizedPurchaseState } from "./purchaseState";

export interface AmazonReceiptData {
  autoRenewing?: boolean;
  cancelDate: number | null;
  cancelReason?: number | null;
  gracePeriodEndDate?: number | null;
  productId: string;
  productType: "CONSUMABLE" | "ENTITLED" | "SUBSCRIPTION";
  purchaseDate?: number;
  quantity?: number | null;
  receiptId: string;
  renewalDate?: number | null;
  term?: string | null;
  termSku?: string | null;
  testTransaction?: boolean;
  betaProduct?: boolean;
  freeTrialEndDate?: number | null;
  [key: string]: unknown;
}

export function mapAmazonReceiptState(
  receipt: AmazonReceiptData,
): HarmonizedPurchaseState {
  // Amazon defines cancelDate as the moment access was lost: it is set when
  // a purchase is canceled or a subscription expires and stays null while a
  // subscription is valid. renewalDate is only the next renewal date, so a
  // past renewalDate must never be treated as an expiry signal.
  if (receipt.cancelDate !== null) {
    return HarmonizedPurchaseState.CANCELED;
  }

  switch (receipt.productType.toUpperCase()) {
    case "CONSUMABLE":
      return HarmonizedPurchaseState.READY_TO_CONSUME;
    case "ENTITLED":
    case "SUBSCRIPTION":
      return HarmonizedPurchaseState.ENTITLED;
    default:
      return HarmonizedPurchaseState.UNKNOWN;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertOptionalBoolean(
  value: Record<string, unknown>,
  field: string,
): void {
  if (field in value && typeof value[field] !== "boolean") {
    throw new AmazonReceiptVerificationError(
      `Amazon RVS field ${field} must be a boolean.`,
    );
  }
}

function assertOptionalNumber(
  value: Record<string, unknown>,
  field: string,
  nullable: boolean,
): void {
  if (!(field in value)) return;
  const fieldValue = value[field];
  if (nullable && fieldValue === null) return;
  if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
    throw new AmazonReceiptVerificationError(
      `Amazon RVS field ${field} must be a finite number${nullable ? " or null" : ""}.`,
    );
  }
}

function assertOptionalString(
  value: Record<string, unknown>,
  field: string,
  nullable: boolean,
): void {
  if (!(field in value)) return;
  const fieldValue = value[field];
  if (nullable && fieldValue === null) return;
  if (typeof fieldValue !== "string") {
    throw new AmazonReceiptVerificationError(
      `Amazon RVS field ${field} must be a string${nullable ? " or null" : ""}.`,
    );
  }
}

export function parseAmazonReceiptResponse(raw: unknown): AmazonReceiptData {
  if (!isRecord(raw)) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned an unparseable body.",
    );
  }

  if (typeof raw.productId !== "string" || raw.productId.trim().length === 0) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned no usable productId.",
    );
  }
  if (
    raw.productType !== "CONSUMABLE" &&
    raw.productType !== "ENTITLED" &&
    raw.productType !== "SUBSCRIPTION"
  ) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned an unsupported productType.",
    );
  }
  if (
    !("cancelDate" in raw) ||
    (raw.cancelDate !== null &&
      (typeof raw.cancelDate !== "number" || !Number.isFinite(raw.cancelDate)))
  ) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS field cancelDate must be a finite number or null.",
    );
  }
  if (typeof raw.receiptId !== "string" || raw.receiptId.trim().length === 0) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned no usable receiptId.",
    );
  }

  assertOptionalBoolean(raw, "autoRenewing");
  assertOptionalBoolean(raw, "testTransaction");
  assertOptionalBoolean(raw, "betaProduct");
  assertOptionalNumber(raw, "freeTrialEndDate", true);
  assertOptionalNumber(raw, "cancelReason", true);
  assertOptionalNumber(raw, "gracePeriodEndDate", true);
  assertOptionalNumber(raw, "purchaseDate", false);
  assertOptionalNumber(raw, "quantity", true);
  assertOptionalNumber(raw, "renewalDate", true);
  assertOptionalString(raw, "term", true);
  assertOptionalString(raw, "termSku", true);

  return raw as AmazonReceiptData;
}

export function amazonReceiptEnvironment(
  sandbox: boolean,
  receipt?: AmazonReceiptData,
): "Sandbox" | "Production" {
  return sandbox ||
    receipt?.betaProduct === true ||
    receipt?.testTransaction === true
    ? "Sandbox"
    : "Production";
}
