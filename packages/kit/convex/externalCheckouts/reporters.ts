"use node";

import * as v from "valibot";
import { createHash, sign } from "node:crypto";
import type { androidpublisher_v3 } from "googleapis";
import type { Doc } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { playPublisher } from "../purchases/android";
import { getAppStoreServerCredentials } from "../purchases/ios";
import type { Integration, Profile } from "./config";
import { minorDigits } from "./model";
import { ExternalJobError, request } from "./stripe";

type Checkout = Doc<"externalCheckouts">;
type Transaction = Doc<"externalCheckoutPayments">;
type Refund = Extract<Doc<"externalCheckoutJobs">["task"], { kind: "refund" }>;
type Token = Doc<"externalPurchaseTokens">;

export const appleCountries: Readonly<Record<string, string>> = {
  AT: "AUT",
  BE: "BEL",
  BG: "BGR",
  BR: "BRA",
  CY: "CYP",
  CZ: "CZE",
  DE: "DEU",
  DK: "DNK",
  EE: "EST",
  ES: "ESP",
  FI: "FIN",
  FR: "FRA",
  GR: "GRC",
  HR: "HRV",
  HU: "HUN",
  IE: "IRL",
  IT: "ITA",
  JP: "JPN",
  KR: "KOR",
  LT: "LTU",
  LU: "LUX",
  LV: "LVA",
  MT: "MLT",
  NL: "NLD",
  PL: "POL",
  PT: "PRT",
  RO: "ROU",
  SE: "SWE",
  SI: "SVN",
  SK: "SVK",
};

function uuid(namespace: string, value: string) {
  const bytes = createHash("sha256")
    .update(`${namespace}:${value}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function appleLineItemId(transaction: Transaction) {
  return uuid("apple-purchase", transaction._id);
}

function appleJwt(
  credentials: Awaited<ReturnType<typeof getAppStoreServerCredentials>>,
  bundleId: string,
) {
  const json = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const content = [
    json({ alg: "ES256", kid: credentials.keyId, typ: "JWT" }),
    json({
      iss: credentials.issuerId,
      iat: now,
      exp: now + 300,
      aud: "appstoreconnect-v1",
      bid: bundleId,
    }),
  ].join(".");
  const signature = sign("sha256", Buffer.from(content), {
    key: credentials.privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${content}.${signature.toString("base64url")}`;
}

type AppleReport = {
  requestIdentifier: string;
  externalPurchaseId: string;
  status:
    | "LINE_ITEM"
    | "NO_LINE_ITEM"
    | "DUPLICATE_TOKEN"
    | "UNRECOGNIZED_TOKEN";
  lineItems?: Record<string, string | number>[];
};

export async function sendAppleReport(
  base: string,
  jwt: string,
  report: AppleReport,
  retry: boolean,
) {
  const headers = {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
  };
  const retrieve = () =>
    request(`${base}/${report.requestIdentifier}`, { headers });
  if (retry) {
    const response = await retrieve();
    if (response.ok) return;
    if (![400, 404].includes(response.status))
      throw new ExternalJobError(`APPLE_LOOKUP_HTTP_${response.status}`);
  }
  const response = await request(base, {
    headers,
    method: "PUT",
    body: JSON.stringify(report),
  });
  if (response.ok) return;
  // The first request can succeed without a response, or Apple can reject a repeated identifier.
  if ([400, 409].includes(response.status) && (await retrieve()).ok) return;
  if (response.status === 400) {
    const body = v.safeParse(
      v.object({ errors: v.array(v.object({ errorCode: v.number() })) }),
      await response.json().catch(() => null),
    );
    if (
      body.success &&
      body.output.errors.some((error) => error.errorCode === 26)
    )
      throw new ExternalJobError("APPLE_SIMULTANEOUS_SUBMISSION");
  }
  throw new ExternalJobError(
    `APPLE_REPORT_HTTP_${response.status}`,
    response.status === 408 ||
      response.status === 429 ||
      response.status >= 500,
  );
}

async function appleReport(
  ctx: ActionCtx,
  project: Doc<"projects">,
  integration: Integration,
  report: AppleReport,
  retry: boolean,
) {
  if (!project.iosBundleId)
    throw new ExternalJobError("APPLE_NOT_CONFIGURED", false);
  const sandbox = report.externalPurchaseId.startsWith("SANDBOX");
  if (sandbox !== (integration.environment === "sandbox"))
    throw new ExternalJobError("APPLE_ENVIRONMENT_MISMATCH", false);
  const credentials = await getAppStoreServerCredentials(ctx, project);
  const base = sandbox
    ? "https://api.storekit-sandbox.apple.com"
    : "https://api.storekit.apple.com";
  await sendAppleReport(
    `${base}/externalPurchase/v1/reports`,
    appleJwt(credentials, project.iosBundleId),
    report,
    retry,
  );
}

export function buildAppleReport(
  checkout: Checkout,
  transaction: Transaction,
  token: Token,
  initial: Transaction | null,
  root: Transaction | null,
  refund?: Refund,
): AppleReport {
  const { fact } = transaction;
  const first = transaction._id === initial?._id;
  // A plan change's checkout starts with the change, within the same
  // subscription series.
  const change = first && !!checkout.previousCheckoutId;
  const taxCountry = appleCountries[fact.price.regionCode];
  if (!taxCountry)
    throw new ExternalJobError("APPLE_TAX_COUNTRY_UNSUPPORTED", false);
  const currency = fact.price.currency;
  const milli = 10 ** (3 - minorDigits[currency]);
  const net = refund?.netMinor ?? fact.price.netMinor;
  const tax = refund?.taxMinor ?? fact.price.taxMinor;
  const lineItemId = refund
    ? uuid("apple-refund", refund.refund.reference)
    : appleLineItemId(transaction);
  const line = {
    lineItemId,
    creationDate: refund?.refund.at ?? Math.max(fact.paidAt, token.createdAt),
    amountTaxInclusive: (net + tax) * milli,
    amountTaxExclusive: net * milli,
    taxAmount: tax * milli,
    netAmountTaxExclusive:
      (fact.price.netMinor - (refund?.refundedNet ?? 0)) * milli,
    reportingCurrency: currency,
    pricingCurrency: currency,
    taxCountry,
  };
  const lineItem = refund
    ? {
        ...line,
        eventType: "REFUND",
        referenceLineItemId: appleLineItemId(transaction),
      }
    : {
        ...line,
        eventType: "BUY",
        productType: fact.subscription ? "SUBSCRIPTION" : "ONE_TIME_BUY",
        productIdentifier: checkout.productId,
        quantity: 1,
        ...(fact.subscription
          ? {
              subscriptionEvent: change
                ? "SUBSCRIPTION_CHANGE"
                : first
                  ? "SUBSCRIPTION_START"
                  : "RENEWAL",
              subscriptionStartDate: fact.subscription.start,
              subscriptionEndDate: fact.subscription.end,
              subscriptionDaysOfPaidService: transaction.daysOfPaidService ?? 0,
              // Every later line refers to the subscription's start.
              ...(root && root._id !== transaction._id
                ? { referenceLineItemId: appleLineItemId(root) }
                : {}),
            }
          : {}),
      };
  return {
    requestIdentifier: uuid("apple-report", `${transaction._id}:${lineItemId}`),
    externalPurchaseId: token.externalId,
    status: "LINE_ITEM",
    lineItems: [lineItem],
  };
}

export async function reportAppleToken(
  ctx: ActionCtx,
  project: Doc<"projects">,
  integration: Integration,
  token: Token,
  retry: boolean,
) {
  await appleReport(
    ctx,
    project,
    integration,
    {
      requestIdentifier: uuid("apple-token", token._id),
      externalPurchaseId: token.externalId,
      status:
        !token.userId && !token.accountErased
          ? "UNRECOGNIZED_TOKEN"
          : token.duplicate
            ? "DUPLICATE_TOKEN"
            : "NO_LINE_ITEM",
    },
    retry,
  );
}

function googleId(transaction: Transaction) {
  return uuid("google-purchase", transaction._id);
}

function googlePrice(
  currency: string,
  amount: number,
): androidpublisher_v3.Schema$Price {
  return {
    currency,
    priceMicros: String(
      BigInt(amount) * 10n ** BigInt(6 - minorDigits[currency]),
    ),
  };
}

export function buildGooglePurchase(
  checkout: Checkout,
  transaction: Transaction,
  initial: Transaction | null,
  token: string | undefined,
  profile: Profile,
) {
  const { fact } = transaction;
  const { currency, netMinor, taxMinor, regionCode } = fact.price;
  const first = transaction._id === initial?._id;
  const requestBody: androidpublisher_v3.Schema$ExternalTransaction = {
    originalPreTaxAmount: googlePrice(currency, netMinor),
    originalTaxAmount: googlePrice(currency, taxMinor),
    transactionTime: new Date(fact.paidAt).toISOString(),
    userTaxAddress: {
      regionCode,
      administrativeArea:
        regionCode === "IN" ? profile.administrativeArea : undefined,
    },
    ...(fact.subscription
      ? {
          recurringTransaction: {
            externalSubscription: { subscriptionType: "RECURRING" },
            ...(first
              ? { externalTransactionToken: token }
              : { initialExternalTransactionId: initial && googleId(initial) }),
          },
        }
      : { oneTimeTransaction: { externalTransactionToken: token } }),
  };
  if (first && !token)
    throw new ExternalJobError("GOOGLE_TOKEN_MISSING", false);
  if (checkout.store !== "google")
    throw new ExternalJobError("GOOGLE_CHECKOUT_MISMATCH", false);
  return requestBody;
}

function statusCode(error: unknown) {
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status;
  return typeof status === "number" ? status : undefined;
}

type Result = Promise<{
  data: androidpublisher_v3.Schema$ExternalTransaction;
}>;
type Options = { timeout: number; retry: boolean };
// The three externaltransactions calls the reporter makes.
type ExternalTransactions = {
  createexternaltransaction(
    params: androidpublisher_v3.Params$Resource$Externaltransactions$Createexternaltransaction,
    options: Options,
  ): Result;
  getexternaltransaction(
    params: androidpublisher_v3.Params$Resource$Externaltransactions$Getexternaltransaction,
    options: Options,
  ): Result;
  refundexternaltransaction(
    params: androidpublisher_v3.Params$Resource$Externaltransactions$Refundexternaltransaction,
    options: Options,
  ): Result;
};

// JSON responses can leave out a zero amount, as a free trial reports.
const micros = (price?: androidpublisher_v3.Schema$Price) =>
  price?.priceMicros ?? "0";

export async function sendGoogleReport(
  api: ExternalTransactions,
  packageName: string,
  integration: Integration,
  checkout: Checkout,
  transaction: Transaction,
  initial: Transaction | null,
  token: string | undefined,
  profile: Profile,
  refund?: Refund,
) {
  const externalTransactionId = googleId(transaction);
  const name = `applications/${packageName}/externalTransactions/${externalTransactionId}`;
  const opts = { timeout: 15_000, retry: false };
  const check = (data: androidpublisher_v3.Schema$ExternalTransaction) => {
    if (
      data.externalTransactionId !== externalTransactionId ||
      data.packageName !== packageName ||
      !!data.testPurchase !== (integration.environment === "sandbox")
    )
      throw new ExternalJobError("GOOGLE_REPORT_MISMATCH", false);
    return data;
  };
  try {
    if (!refund) {
      const requestBody = buildGooglePurchase(
        checkout,
        transaction,
        initial,
        token,
        profile,
      );
      try {
        check(
          (
            await api.createexternaltransaction(
              {
                parent: `applications/${packageName}`,
                externalTransactionId,
                requestBody,
              },
              opts,
            )
          ).data,
        );
      } catch (error) {
        if (statusCode(error) !== 409) throw error;
        const existing = check(
          (await api.getexternaltransaction({ name }, opts)).data,
        );
        if (
          micros(existing.originalPreTaxAmount) !==
            micros(requestBody.originalPreTaxAmount) ||
          existing.originalPreTaxAmount?.currency !==
            requestBody.originalPreTaxAmount?.currency ||
          micros(existing.originalTaxAmount) !==
            micros(requestBody.originalTaxAmount)
        )
          throw new ExternalJobError("GOOGLE_REPORT_MISMATCH", false);
      }
      return;
    }
    const { currency, netMinor } = transaction.fact.price;
    const existing = check(
      (await api.getexternaltransaction({ name }, opts)).data,
    );
    const current = existing.currentPreTaxAmount?.priceMicros;
    const expected = googlePrice(
      currency,
      netMinor - refund.refundedNet,
    ).priceMicros;
    if (
      refund.full
        ? existing.transactionState === "TRANSACTION_CANCELED"
        : refund.netMinor > 0 && current === expected
    )
      return;
    const before = googlePrice(
      currency,
      netMinor - refund.refundedNet + refund.netMinor,
    ).priceMicros;
    if (current !== before || (!refund.full && refund.netMinor === 0))
      throw new ExternalJobError(
        "GOOGLE_REFUND_RECONCILIATION_REQUIRED",
        false,
      );
    const requestBody: androidpublisher_v3.Schema$RefundExternalTransactionRequest =
      {
        refundTime: new Date(refund.refund.at).toISOString(),
        // Google's fullRefund refunds what remains, so it also covers the
        // refund that completes earlier partial refunds.
        ...(refund.full
          ? { fullRefund: {} }
          : {
              partialRefund: {
                refundId: uuid("google-refund", refund.refund.reference),
                refundPreTaxAmount: googlePrice(currency, refund.netMinor),
              },
            }),
      };
    check(
      (await api.refundexternaltransaction({ name, requestBody }, opts)).data,
    );
  } catch (error) {
    if (error instanceof ExternalJobError) throw error;
    const status = statusCode(error);
    throw new ExternalJobError(
      `GOOGLE_REPORT_${status ?? "UNREACHABLE"}`,
      status === undefined || [404, 408, 429].includes(status) || status >= 500,
    );
  }
}

export async function reportTransaction(
  ctx: ActionCtx,
  project: Doc<"projects">,
  integration: Integration,
  profile: Profile,
  data: {
    checkout: Checkout;
    transaction: Transaction;
    initial: Transaction | null;
    root: Transaction | null;
    appleToken: Token | null;
  },
  token: string | undefined,
  retry: boolean,
  refund?: Refund,
) {
  const { checkout, transaction, initial, root, appleToken } = data;
  if (checkout.store === "apple") {
    if (!appleToken) throw new ExternalJobError("APPLE_TOKEN_MISSING", false);
    return appleReport(
      ctx,
      project,
      integration,
      buildAppleReport(
        checkout,
        transaction,
        appleToken,
        initial,
        root,
        refund,
      ),
      retry,
    );
  }
  const publisher = await playPublisher(ctx, project._id);
  if (!project.androidPackageName || typeof publisher === "string")
    throw new ExternalJobError("GOOGLE_NOT_CONFIGURED", false);
  return sendGoogleReport(
    publisher.externaltransactions,
    project.androidPackageName,
    integration,
    checkout,
    transaction,
    initial,
    token,
    profile,
    refund,
  );
}
