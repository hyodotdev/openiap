// Internal adapters for SDK confirmation helpers; apps use SDK root imports.
// Each adapter uses the same lifecycle contract as other verification services.
import type {
  PurchaseConfirmation,
  PurchaseFlowOptions,
  PurchaseFlowPurchase,
} from "./purchase-flow-core";

type IapkitStore = "apple" | "google" | "amazon" | "horizon";

/** How an app without its own backend confirms purchases with IAPKit. */
export interface IapkitConfirmationOptions<
  P extends PurchaseFlowPurchase = PurchaseFlowPurchase,
> {
  /**
   * A publishable key (`openiap-kit_pk_...`), which is safe to ship in an
   * app. Leave it out where the SDK has one configured, such as Expo's
   * `iapkitApiKey`.
   */
  apiKey?: string;
  /** A self-hosted or local IAPKit origin. Defaults to https://kit.openiap.dev. */
  baseUrl?: string;
  amazon?: {
    /** Verify App Tester receipts with the Amazon RVS Cloud Sandbox. */
    sandbox?: boolean;
    /** RVS reports a subscription term under its parent SKU; maps one to the other. */
    verifiedProductId?: (productId: string) => string;
  };
  /** The IAPKit store that verifies a community store's evidence, such as an Amazon RVS adapter. */
  verifyAs?: (purchase: P) => IapkitStore | undefined;
  /** Credits consumables before finishing; must be idempotent per purchase.id. */
  grant?: (purchase: P, context: { isConsumable: boolean }) => Promise<void>;
}

/** @internal Use the SDK's VerifyPurchaseWithProviderProps. */
export interface IapkitVerificationProps {
  provider: "iapkit";
  iapkit: {
    apiKey?: string;
    baseUrl?: string;
    apple?: { jws: string };
    google?: { purchaseToken: string };
    amazon?: {
      receiptId: string;
      expectedProductId: string;
      sandbox: boolean;
      userId?: string;
    };
    horizon?: { sku: string };
  };
}

/** @internal Use the SDK's VerifyPurchaseWithProviderResult. */
export interface IapkitVerificationResult {
  iapkit?: {
    store: string;
    storeId: string;
    environment?: string | null;
    isValid: boolean;
    state: string;
    productId?: string | null;
  } | null;
  errors?: { code?: string | null; message: string }[] | null;
}

const IAPKIT_UNKNOWN_RETRY_MS = 30_000;

/**
 * @internal Use the SDK's confirmWithIapkit.
 * The SDK's `confirmWithIapkit`, given its `verifyPurchaseWithProvider`:
 * verifies the purchase with IAPKit, then runs `grant` before the flow
 * finishes it.
 */
export function createIapkitConfirmation<P extends PurchaseFlowPurchase>(
  verifyPurchaseWithProvider: (
    props: IapkitVerificationProps,
  ) => Promise<IapkitVerificationResult>,
  options: IapkitConfirmationOptions<P>,
): PurchaseFlowOptions<P>["confirmWithBackend"] {
  return async (purchase, context) => {
    requireGrant("confirmWithIapkit", purchase, context, options);
    const confirmation = readIapkitVerification(
      await verifyPurchaseWithProvider(
        toIapkitVerificationProps(purchase, options),
      ),
      purchase,
      context,
      options,
    );
    if (confirmation.status === "entitled" && !confirmation.alreadyGranted) {
      await options.grant?.(purchase, context);
    }
    return confirmation;
  };
}

/**
 * @internal Use the SDK's confirmOnDeviceIOS.
 * The SDK's `confirmOnDeviceIOS`, given its `getPendingTransactionsIOS`, for an
 * app with neither a backend nor IAPKit. StoreKit verified the transaction if
 * it is still unfinished, unrevoked, not upgraded, unexpired, and from the
 * purchase's environment; `grant` then runs before the flow finishes it.
 */
export function createDeviceConfirmationIOS<P extends PurchaseFlowPurchase>(
  getPendingTransactionsIOS: () => Promise<P[]>,
  options: {
    /** Required for consumables; credit each purchase.id only once. */
    grant?: (purchase: P, context: { isConsumable: boolean }) => Promise<void>;
  } = {},
): PurchaseFlowOptions<P>["confirmWithBackend"] {
  return async (purchase, context) => {
    requireGrant("confirmOnDeviceIOS", purchase, context, options);
    // A community provider may report store "apple" under its own storeId.
    if (
      purchase.store !== "apple" ||
      (purchase.storeId ?? "apple") !== "apple"
    ) {
      throw new Error(
        `Device confirmation covers App Store purchases, not ${purchase.storeId ?? purchase.store}`,
      );
    }
    const pending = await getPendingTransactionsIOS();
    // After the query: a transaction can expire while StoreKit answers.
    const now = Date.now();
    const verified = pending.some(
      (candidate) =>
        candidate.store === "apple" &&
        purchase.id !== "" &&
        candidate.id === purchase.id &&
        candidate.productId === purchase.productId &&
        candidate.revocationDateIOS == null &&
        candidate.isUpgradedIOS !== true &&
        (candidate.expirationDateIOS == null ||
          candidate.expirationDateIOS > now) &&
        (purchase.environmentIOS == null ||
          candidate.environmentIOS === purchase.environmentIOS),
    );
    if (!verified) {
      throw new Error(
        `StoreKit lists no valid unfinished transaction for ${purchase.productId}`,
      );
    }
    await options.grant?.(purchase, context);
    return { status: "entitled", alreadyGranted: false };
  };
}

// Checked before verifying: a consumable must never pass without a way to credit it.
function requireGrant<P extends PurchaseFlowPurchase>(
  name: string,
  purchase: P,
  context: { isConsumable: boolean },
  options: Pick<IapkitConfirmationOptions<P>, "grant">,
): void {
  if (context.isConsumable && !options.grant) {
    throw new Error(
      `${name} needs grant to credit consumable ${purchase.productId} before it is consumed`,
    );
  }
}

/** @internal Builds the IAPKit request; throws for a store IAPKit cannot verify. */
export function toIapkitVerificationProps<P extends PurchaseFlowPurchase>(
  purchase: P,
  options: IapkitConfirmationOptions<P>,
): IapkitVerificationProps {
  const apiKey = options.apiKey?.trim();
  // An unset environment variable, not a deliberate fallback to the SDK's key.
  if (apiKey === "") throw new Error("IAPKit apiKey is empty");
  const baseUrl = options.baseUrl?.trim();
  const base = {
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  };
  const token = (): string => {
    if (!purchase.purchaseToken) {
      throw new Error(
        `Purchase ${purchase.productId} has no purchase token to verify`,
      );
    }
    return purchase.purchaseToken;
  };
  const store = verifyingStore(purchase, options);
  switch (store) {
    case "apple":
      return {
        provider: "iapkit",
        iapkit: { ...base, apple: { jws: token() } },
      };
    case "google":
      return {
        provider: "iapkit",
        iapkit: { ...base, google: { purchaseToken: token() } },
      };
    case "amazon":
      return {
        provider: "iapkit",
        iapkit: {
          ...base,
          amazon: {
            receiptId: token(),
            expectedProductId: amazonProductId(purchase, options),
            sandbox: options.amazon?.sandbox ?? false,
            ...(purchase.userIdAmazon ? { userId: purchase.userIdAmazon } : {}),
          },
        },
      };
    case "horizon":
      return {
        provider: "iapkit",
        iapkit: { ...base, horizon: { sku: purchase.productId } },
      };
    default:
      throw new Error(`IAPKit cannot verify store ${purchase.store}`);
  }
}

/**
 * @internal Use the SDK's confirmWithIapkit.
 * Turns IAPKit's answer into the flow's confirmation. Anything that may be a
 * configuration error rather than a rejected payment throws, so the flow
 * reports `failed` and leaves the purchase unfinished: evidence for another
 * store, product, or environment, `inauthentic` (IAPKit's answer to a product
 * or package mismatch, and to every Horizon rejection), and a valid state this
 * product type cannot be granted from.
 */
export function readIapkitVerification<P extends PurchaseFlowPurchase>(
  result: IapkitVerificationResult,
  purchase: P,
  context: { isConsumable: boolean },
  options: Omit<IapkitConfirmationOptions<P>, "apiKey"> = {},
): PurchaseConfirmation {
  const verified = result.iapkit;
  if (!verified) {
    const errors = (result.errors ?? []).map((error) =>
      error.code ? `[${error.code}] ${error.message}` : error.message,
    );
    throw new Error(
      errors.join("\n") || "IAPKit returned no verification result",
    );
  }
  switch (verified.state) {
    case "pending":
      return { status: "store_pending" };
    // The store gave no usable answer: retry instead of rejecting a payment.
    case "unknown":
      return {
        status: "verification_delayed",
        retryAfterMs: IAPKIT_UNKNOWN_RETRY_MS,
      };
  }
  const store = verifyingStore(purchase, options);
  const expectedProductId =
    store === "amazon"
      ? amazonProductId(purchase, options)
      : purchase.productId;
  const mismatch =
    verified.store !== purchase.store
      ? `store ${verified.store}, expected ${purchase.store}`
      : purchase.storeId && verified.storeId !== purchase.storeId
        ? `store id ${verified.storeId}, expected ${purchase.storeId}`
        : verified.productId !== expectedProductId
          ? `product ${verified.productId ?? "(none)"}, expected ${expectedProductId}`
          : environmentMismatch(verified.environment, store, purchase, options);
  if (mismatch) throw new Error(`IAPKit verified ${mismatch}`);
  if (!verified.isValid) {
    switch (verified.state) {
      case "canceled":
      case "expired":
        return { status: "invalid", reason: verified.state };
      // Only a granted purchase is consumed; the flow grants before finishing.
      case "consumed":
        return { status: "entitled", alreadyGranted: true };
      default:
        throw new Error(`IAPKit rejected the purchase: ${verified.state}`);
    }
  }
  if (!grantsAccess(store, verified.state, context.isConsumable)) {
    throw new Error(
      `IAPKit state ${verified.state} cannot grant this ${
        context.isConsumable ? "consumable" : "non-consumable"
      } ${purchase.store} purchase`,
    );
  }
  return { status: "entitled", alreadyGranted: false };
}

function verifyingStore<P extends PurchaseFlowPurchase>(
  purchase: P,
  options: Pick<IapkitConfirmationOptions<P>, "verifyAs">,
): string {
  return options.verifyAs?.(purchase) ?? purchase.store;
}

function amazonProductId(
  purchase: PurchaseFlowPurchase,
  options: Pick<IapkitConfirmationOptions, "amazon">,
): string {
  return (
    options.amazon?.verifiedProductId?.(purchase.productId) ??
    purchase.productId
  );
}

function environmentMismatch(
  environment: string | null | undefined,
  store: string,
  purchase: PurchaseFlowPurchase,
  options: Pick<IapkitConfirmationOptions, "amazon">,
): string | null {
  const expected =
    store === "amazon"
      ? options.amazon?.sandbox
        ? "Sandbox"
        : "Production"
      : store === "apple"
        ? purchase.environmentIOS
        : null;
  return expected && environment !== expected
    ? `environment ${environment ?? "(none)"}, expected ${expected}`
    : null;
}

// Apple and Amazon keep a consumable at ready-to-consume until it is finished;
// Google reports a granted purchase as pending-acknowledgment until then.
function grantsAccess(
  store: string,
  state: string,
  isConsumable: boolean,
): boolean {
  switch (store) {
    case "apple":
    case "amazon":
      return state === (isConsumable ? "ready-to-consume" : "entitled");
    case "google":
      return (
        state === "entitled" ||
        state === "pending-acknowledgment" ||
        (isConsumable && state === "ready-to-consume")
      );
    case "horizon":
      return state === "entitled";
    default:
      return false;
  }
}
