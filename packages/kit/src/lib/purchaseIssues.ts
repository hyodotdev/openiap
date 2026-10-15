import type { Doc } from "@/convex";
import { MAX_BOUND_PURCHASES_PER_USER } from "../../convex/subscriptions/limits";

export type PurchaseIssueCause = Doc<"purchaseIssues">["cause"];

/** What each cause means and what to do next; the dashboard and docs share it. */
export const PURCHASE_ISSUE_CAUSES: Record<
  PurchaseIssueCause,
  { label: string; meaning: string; nextStep: string }
> = {
  STORE_PENDING: {
    label: "Payment pending",
    meaning:
      "The store has not finished taking payment, for example Ask to Buy or a slow payment method.",
    nextStep:
      "Wait for store approval. The store delivers the purchase again when payment completes; grant nothing until then.",
  },
  STORE_UNAVAILABLE: {
    label: "Store unavailable",
    meaning:
      "The store API failed, timed out, or asked IAPKit to slow down. Nothing was decided about the purchase.",
    nextStep:
      "Retry after the retry-after time. If it persists, check the store's status page.",
  },
  RATE_LIMITED: {
    label: "Rate limited",
    meaning:
      "IAPKit's verification limit for this project turned the request away before asking the store.",
    nextStep:
      "Retry after Retry-After with backoff, and check the app is not retrying in a loop.",
  },
  INAUTHENTIC: {
    label: "Not recognized by the store",
    meaning:
      "The store does not know this purchase: the token or JWS is forged, belongs to another app, or was never issued.",
    nextStep:
      "Grant nothing. If real customers see this, check the app uses this project's key and store identifiers.",
  },
  PRODUCT_MISMATCH: {
    label: "Product mismatch",
    meaning:
      "The store verified a different product than the one the app claimed.",
    nextStep:
      "Grant only the store-verified product, and fix the product ID the app sends as expectedProductId.",
  },
  APP_MISMATCH: {
    label: "App mismatch",
    meaning: "The purchase was made in an app with a different bundle ID.",
    nextStep:
      "Check the bundle ID in project settings, and that each app uses its own project's key.",
  },
  MALFORMED_EVIDENCE: {
    label: "Malformed purchase data",
    meaning: "The app sent something that is not a valid JWS.",
    nextStep:
      "Send the purchase's JWS unchanged, from an up-to-date OpenIAP SDK.",
  },
  SANDBOX_NOT_ALLOWED: {
    label: "Sandbox not allowed",
    meaning:
      "An Amazon App Tester sandbox purchase reached a project that does not accept sandbox purchases.",
    nextStep:
      "Enable the App Tester sandbox option in project settings, or test with Live App Testing.",
  },
  STORE_NOT_CONFIGURED: {
    label: "Store not configured",
    meaning:
      "The project has not set up this store: the bundle ID, package name, or Horizon app ID is missing, or Horizon is off.",
    nextStep: "Set the store up in project settings.",
  },
  CREDENTIALS_MISSING: {
    label: "Credentials missing",
    meaning: "The project has no server credentials for this store.",
    nextStep:
      "Upload the App Store key, Play service account, Amazon shared secret, or Meta app secret in project settings.",
  },
  CREDENTIALS_REJECTED: {
    label: "Credentials rejected",
    meaning: "The store refused the project's credentials.",
    nextStep:
      "Replace the credentials, and check the key or service account still has access to this app.",
  },
  VERIFICATION_FAILED: {
    label: "Verification failed",
    meaning: "The store or IAPKit could not verify the purchase.",
    nextStep:
      "Retry later. If it repeats, contact support with the correlation ID.",
  },
  OWNERSHIP_CONFLICT: {
    label: "Linked to another account",
    meaning:
      "The purchase is already linked to a different app user, and a bind never moves it.",
    nextStep:
      "Ask the user to sign in to the account that bought it. Rebind only where your app's policy allows moving purchases.",
  },
  BIND_LIMIT_REACHED: {
    label: "Link limit reached",
    meaning: `This app user already holds ${MAX_BOUND_PURCHASES_PER_USER} valid linked Amazon and Horizon purchases.`,
    nextStep:
      "Check that each person gets their own app user ID rather than a shared one.",
  },
};

export function isPurchaseIssueCause(
  value: string,
): value is PurchaseIssueCause {
  return Object.keys(PURCHASE_ISSUE_CAUSES).includes(value);
}
