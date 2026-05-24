import * as v from "valibot";

// Length ceilings for the receipt payload strings. These are
// deliberately generous — far larger than any real token we've seen in
// production — but bounded so a misbehaving / malicious client can't
// push the Bun server into an OOM by posting a multi-megabyte string.
// Apple JWS transactions are typically ~1–2 KB; nested subscription
// payloads stay well under 10 KB. Google purchase tokens are opaque
// base64 blobs, historically under ~200 chars. Product identifiers,
// Meta Horizon's (userId, sku), and Amazon RVS's (userId, receiptId)
// are short bounded strings.
export const APPLE_JWS_MAX_LENGTH = 16_000;
export const GOOGLE_PURCHASE_TOKEN_MAX_LENGTH = 2_000;
const HORIZON_USER_ID_MAX_LENGTH = 256;
const HORIZON_SKU_MAX_LENGTH = 256;
const EXPECTED_PRODUCT_ID_MAX_LENGTH = 256;
const AMAZON_USER_ID_MAX_LENGTH = 512;
const AMAZON_RECEIPT_ID_MAX_LENGTH = 4_096;

// Lower bounds — any real token from the respective store sits well
// above these. A sub-threshold input is guaranteed garbage (empty
// fragment, single char, "test", etc.) and can be rejected at the
// edge so the quota counter and the upstream Apple / Google / Horizon / Amazon API
// aren't touched. Numbers are conservative: the shortest real Apple
// JWS we've observed in production is ~600 chars; the shortest Google
// purchaseToken ~30; Meta userIds are 15-20 digit numeric strings.
const APPLE_JWS_MIN_LENGTH = 100;
const GOOGLE_PURCHASE_TOKEN_MIN_LENGTH = 20;
const HORIZON_USER_ID_MIN_LENGTH = 3;
const AMAZON_USER_ID_MIN_LENGTH = 3;
const AMAZON_RECEIPT_ID_MIN_LENGTH = 10;
// `sku` only enforces non-empty (via `v.nonEmpty` below); a 1-char
// minimum would be redundant. Raise the floor here only if a real
// shortest-known SKU justifies it.

// Character-set gates catch the "someone hit us with a random string"
// case before it becomes infrastructure cost. Apple JWS is a standard
// compact JWT (base64url.base64url.base64url); Google's purchase
// token is an opaque URL-safe string; Meta's userId in practice is a
// numeric string but the pattern below stays URL-safe-ish so a future
// non-numeric format from Meta (or our own dev fixtures) doesn't
// regress; Meta's sku is app-defined but restricted to a URL-safe
// subset by Meta's dashboard. Anything failing these is definitionally
// not a real verification request — 400 INVALID_INPUT and move on.
//
// IMPORTANT: these patterns are intentionally lax enough to match
// every legitimate shape we've seen. Tightening them further has a
// real false-positive cost; widen only after checking the logs.
export const APPLE_JWS_PATTERN =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const GOOGLE_PURCHASE_TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/;
const HORIZON_USER_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const HORIZON_SKU_PATTERN = /^[A-Za-z0-9._-]+$/;
const EXPECTED_PRODUCT_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const AMAZON_USER_ID_PATTERN = /^[A-Za-z0-9._~=-]+$/;
const AMAZON_RECEIPT_ID_PATTERN = /^[A-Za-z0-9._~:=/-]+$/;

const expectedProductIdSchema = v.optional(
  v.pipe(
    v.string(),
    v.nonEmpty("expectedProductId must not be empty."),
    v.maxLength(
      EXPECTED_PRODUCT_ID_MAX_LENGTH,
      `expectedProductId must be at most ${EXPECTED_PRODUCT_ID_MAX_LENGTH} characters.`,
    ),
    v.regex(
      EXPECTED_PRODUCT_ID_PATTERN,
      "expectedProductId must contain only letters, digits, '.', '_' or '-'.",
    ),
    v.description(
      "Optional product id that must match the product id verified by the store.",
    ),
  ),
);

export const verifyPurchaseInputSchema = v.variant("store", [
  v.pipe(
    v.object({
      store: v.literal("apple"),
      jws: v.pipe(
        v.string(),
        v.nonEmpty("jws must not be empty."),
        v.minLength(
          APPLE_JWS_MIN_LENGTH,
          `jws must be at least ${APPLE_JWS_MIN_LENGTH} characters — an Apple JWS this short is not a real signed transaction.`,
        ),
        v.maxLength(
          APPLE_JWS_MAX_LENGTH,
          `jws must be at most ${APPLE_JWS_MAX_LENGTH} characters.`,
        ),
        v.regex(
          APPLE_JWS_PATTERN,
          "jws must be a compact JWS (three base64url segments separated by '.').",
        ),
        v.description("The JWS token returned with the purchase response."),
      ),
      expectedProductId: expectedProductIdSchema,
    }),
    v.title("Apple App Store"),
  ),
  v.pipe(
    v.object({
      store: v.literal("google"),
      purchaseToken: v.pipe(
        v.string(),
        v.nonEmpty("purchaseToken must not be empty."),
        v.minLength(
          GOOGLE_PURCHASE_TOKEN_MIN_LENGTH,
          `purchaseToken must be at least ${GOOGLE_PURCHASE_TOKEN_MIN_LENGTH} characters.`,
        ),
        v.maxLength(
          GOOGLE_PURCHASE_TOKEN_MAX_LENGTH,
          `purchaseToken must be at most ${GOOGLE_PURCHASE_TOKEN_MAX_LENGTH} characters.`,
        ),
        v.regex(
          GOOGLE_PURCHASE_TOKEN_PATTERN,
          "purchaseToken must contain only URL-safe characters (letters, digits, '.', '_', '~', '-').",
        ),
        v.description(
          "The token provided to the user's device when the subscription was purchased.",
        ),
      ),
      expectedProductId: expectedProductIdSchema,
    }),
    v.title("Google Play Store"),
  ),
  v.pipe(
    v.object({
      store: v.literal("horizon"),
      userId: v.pipe(
        v.string(),
        v.nonEmpty("userId must not be empty."),
        v.minLength(
          HORIZON_USER_ID_MIN_LENGTH,
          `userId must be at least ${HORIZON_USER_ID_MIN_LENGTH} characters.`,
        ),
        v.maxLength(
          HORIZON_USER_ID_MAX_LENGTH,
          `userId must be at most ${HORIZON_USER_ID_MAX_LENGTH} characters.`,
        ),
        v.regex(
          HORIZON_USER_ID_PATTERN,
          "userId must contain only letters, digits, '_' or '-'.",
        ),
        v.description("Oculus user id whose entitlement is being verified."),
      ),
      sku: v.pipe(
        v.string(),
        v.nonEmpty("sku must not be empty."),
        v.maxLength(
          HORIZON_SKU_MAX_LENGTH,
          `sku must be at most ${HORIZON_SKU_MAX_LENGTH} characters.`,
        ),
        v.regex(
          HORIZON_SKU_PATTERN,
          "sku must contain only letters, digits, '.', '_' or '-'.",
        ),
        v.description(
          "Add-on SKU as configured in the Meta Developer Dashboard.",
        ),
      ),
    }),
    v.title("Meta Horizon (Quest)"),
  ),
  v.pipe(
    v.object({
      store: v.literal("amazon"),
      userId: v.pipe(
        v.string(),
        v.nonEmpty("userId must not be empty."),
        v.minLength(
          AMAZON_USER_ID_MIN_LENGTH,
          `userId must be at least ${AMAZON_USER_ID_MIN_LENGTH} characters.`,
        ),
        v.maxLength(
          AMAZON_USER_ID_MAX_LENGTH,
          `userId must be at most ${AMAZON_USER_ID_MAX_LENGTH} characters.`,
        ),
        v.regex(
          AMAZON_USER_ID_PATTERN,
          "userId must contain only URL-safe Amazon RVS characters.",
        ),
        v.description(
          "Amazon user id returned by PurchaseResponse.getUserData().getUserId().",
        ),
      ),
      receiptId: v.pipe(
        v.string(),
        v.nonEmpty("receiptId must not be empty."),
        v.minLength(
          AMAZON_RECEIPT_ID_MIN_LENGTH,
          `receiptId must be at least ${AMAZON_RECEIPT_ID_MIN_LENGTH} characters.`,
        ),
        v.maxLength(
          AMAZON_RECEIPT_ID_MAX_LENGTH,
          `receiptId must be at most ${AMAZON_RECEIPT_ID_MAX_LENGTH} characters.`,
        ),
        v.regex(
          AMAZON_RECEIPT_ID_PATTERN,
          "receiptId must contain only URL-safe Amazon RVS characters.",
        ),
        v.description(
          "Amazon receipt id returned by PurchaseResponse.getReceipt().getReceiptId() or PurchaseUpdatesResponse.getReceipts().",
        ),
      ),
      sandbox: v.optional(
        v.pipe(
          v.boolean(),
          v.description(
            "Use Amazon RVS Cloud Sandbox for App Tester receipts.",
          ),
        ),
      ),
    }),
    v.title("Amazon Appstore"),
  ),
]);
