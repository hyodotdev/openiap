"use node";

import { X509Certificate, verify } from "node:crypto";
import { ConvexError } from "convex/values";
import { parseAmazonSnsTopic, type AmazonRtnMessage } from "./amazonShared";
import { readBoundedResponseText } from "../utils/httpResponse";
import { WEBHOOK_RETENTION_MS } from "./shared";

const MAX_ENVELOPE_BYTES = 256 * 1024;
const MAX_SNS_RESPONSE_BYTES = 64 * 1024;
const SNS_REQUEST_TIMEOUT_MS = 10_000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface AmazonSnsEnvelope {
  Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
  Message: string;
  MessageId: string;
  TopicArn: string;
  Timestamp: string;
  SignatureVersion: "1" | "2";
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  Token?: string;
  SubscribeURL?: string;
}

function fail(
  code: "INVALID_INPUT" | "INVALID_SIGNATURE",
  message: string,
): never {
  throw new ConvexError({ code, message });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  max: number,
): string {
  const field = value[key];
  if (typeof field !== "string" || !field.length || field.length > max)
    fail("INVALID_INPUT", `Invalid Amazon SNS ${key}`);
  return field;
}

export function parseAmazonSnsEnvelope(
  raw: string,
  now = Date.now(),
): AmazonSnsEnvelope {
  if (Buffer.byteLength(raw, "utf8") > MAX_ENVELOPE_BYTES)
    fail("INVALID_INPUT", "Amazon SNS payload is too large");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    fail("INVALID_INPUT", "Invalid Amazon SNS JSON");
  }
  if (!record(value)) fail("INVALID_INPUT", "Invalid Amazon SNS envelope");
  if (
    value.Type !== "Notification" &&
    value.Type !== "SubscriptionConfirmation" &&
    value.Type !== "UnsubscribeConfirmation"
  )
    fail("INVALID_INPUT", "Unsupported Amazon SNS envelope type");
  if (value.SignatureVersion !== "1" && value.SignatureVersion !== "2")
    fail("INVALID_SIGNATURE", "Unsupported Amazon SNS signature version");
  const envelope: AmazonSnsEnvelope = {
    Type: value.Type,
    Message: requiredString(value, "Message", MAX_ENVELOPE_BYTES),
    MessageId: requiredString(value, "MessageId", 128),
    TopicArn: requiredString(value, "TopicArn", 2048),
    Timestamp: requiredString(value, "Timestamp", 64),
    SignatureVersion: value.SignatureVersion,
    Signature: requiredString(value, "Signature", 4096),
    SigningCertURL: requiredString(value, "SigningCertURL", 2048),
  };
  const timestamp = Date.parse(envelope.Timestamp);
  if (
    !Number.isFinite(timestamp) ||
    timestamp > now + MAX_FUTURE_SKEW_MS ||
    timestamp < now - WEBHOOK_RETENTION_MS
  )
    fail(
      "INVALID_SIGNATURE",
      "Amazon SNS timestamp is outside the accepted replay window",
    );
  if (value.Subject !== undefined)
    envelope.Subject = requiredString(value, "Subject", 1024);
  if (envelope.Type !== "Notification") {
    envelope.Token = requiredString(value, "Token", 4096);
    envelope.SubscribeURL = requiredString(value, "SubscribeURL", 8192);
  }
  return envelope;
}

export function amazonSnsStringToSign(envelope: AmazonSnsEnvelope): string {
  const fields: Array<keyof AmazonSnsEnvelope> =
    envelope.Type === "Notification"
      ? ([
          "Message",
          "MessageId",
          ...(envelope.Subject !== undefined ? ["Subject" as const] : []),
          "Timestamp",
          "TopicArn",
          "Type",
        ] as const)
      : ([
          "Message",
          "MessageId",
          "SubscribeURL",
          "Timestamp",
          "Token",
          "TopicArn",
          "Type",
        ] as const);
  return fields.map((field) => `${field}\n${envelope[field]}\n`).join("");
}

function trustedSnsUrl(raw: string, expectedOrigin: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail("INVALID_SIGNATURE", "Invalid Amazon SNS URL");
  }
  if (url.origin !== expectedOrigin || url.username || url.password || url.hash)
    fail("INVALID_SIGNATURE", "Untrusted Amazon SNS URL");
  return url;
}

async function boundedSnsGet(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SNS_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok || !response.body)
      throw new Error("Amazon SNS request failed");
    return await readBoundedResponseText(response, MAX_SNS_RESPONSE_BYTES);
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyAmazonSnsEnvelope(
  raw: string,
  expectedTopicArn: string,
  now = Date.now(),
): Promise<AmazonSnsEnvelope> {
  const topic = parseAmazonSnsTopic(expectedTopicArn);
  if (!topic) fail("INVALID_SIGNATURE", "Invalid configured Amazon SNS topic");
  const envelope = parseAmazonSnsEnvelope(raw, now);
  if (envelope.TopicArn !== topic.arn)
    fail("INVALID_SIGNATURE", "Amazon SNS topic does not match this project");
  const certUrl = trustedSnsUrl(envelope.SigningCertURL, topic.origin);
  if (
    !/^\/SimpleNotificationService-[A-Za-z0-9]+\.pem$/.test(certUrl.pathname) ||
    certUrl.search
  )
    fail("INVALID_SIGNATURE", "Invalid Amazon SNS signing certificate URL");
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      envelope.Signature,
    )
  )
    fail("INVALID_SIGNATURE", "Invalid Amazon SNS signature encoding");
  // Fetch failures are retryable; rejecting a forged signature is permanent.
  const certificate = new X509Certificate(await boundedSnsGet(certUrl));
  if (
    now < Date.parse(certificate.validFrom) ||
    now > Date.parse(certificate.validTo) ||
    certificate.publicKey.asymmetricKeyType !== "rsa"
  )
    fail("INVALID_SIGNATURE", "Invalid Amazon SNS signing certificate");
  if (
    !verify(
      envelope.SignatureVersion === "1" ? "RSA-SHA1" : "RSA-SHA256",
      Buffer.from(amazonSnsStringToSign(envelope)),
      certificate.publicKey,
      Buffer.from(envelope.Signature, "base64"),
    )
  )
    fail("INVALID_SIGNATURE", "Amazon SNS signature verification failed");
  return envelope;
}

export async function confirmAmazonSnsSubscription(
  envelope: AmazonSnsEnvelope,
): Promise<void> {
  if (envelope.Type !== "SubscriptionConfirmation") return;
  const topic = parseAmazonSnsTopic(envelope.TopicArn);
  if (!topic || !envelope.SubscribeURL || !envelope.Token)
    fail("INVALID_INPUT", "Invalid Amazon SNS confirmation");
  const url = trustedSnsUrl(envelope.SubscribeURL, topic.origin);
  if (
    url.pathname !== "/" ||
    url.searchParams.get("Action") !== "ConfirmSubscription" ||
    url.searchParams.get("TopicArn") !== topic.arn ||
    url.searchParams.get("Token") !== envelope.Token ||
    [...url.searchParams.keys()].some(
      (key) => !["Action", "TopicArn", "Token"].includes(key),
    ) ||
    ["Action", "TopicArn", "Token"].some(
      (key) => url.searchParams.getAll(key).length !== 1,
    )
  )
    fail(
      "INVALID_SIGNATURE",
      "Amazon SNS confirmation does not match the signed topic and token",
    );
  await boundedSnsGet(url);
}

export function parseAmazonRtnMessage(
  envelope: AmazonSnsEnvelope,
  applicationId: string,
  now = Date.now(),
): AmazonRtnMessage {
  let value: unknown;
  try {
    value = JSON.parse(envelope.Message);
  } catch {
    fail("INVALID_INPUT", "Invalid Amazon RTN message JSON");
  }
  if (!record(value)) fail("INVALID_INPUT", "Invalid Amazon RTN message");
  const message: AmazonRtnMessage = {
    receiptId: requiredString(value, "receiptId", 200),
    appUserId: requiredString(value, "appUserId", 128),
    appPackageName: requiredString(value, "appPackageName", 256),
    notificationType: requiredString(value, "notificationType", 128),
    timestamp: 0,
    betaProductTransaction: false,
  };
  if (message.appPackageName !== applicationId)
    fail(
      "INVALID_SIGNATURE",
      "Amazon RTN app package does not match this project",
    );
  if (
    typeof value.timestamp !== "number" ||
    !Number.isSafeInteger(value.timestamp) ||
    value.timestamp < 0 ||
    value.timestamp > now + MAX_FUTURE_SKEW_MS ||
    typeof value.betaProductTransaction !== "boolean"
  )
    fail("INVALID_INPUT", "Invalid Amazon RTN timestamp or test environment");
  message.timestamp = value.timestamp;
  message.betaProductTransaction = value.betaProductTransaction;
  if (value.relatedReceipts !== undefined) {
    if (!record(value.relatedReceipts))
      fail("INVALID_INPUT", "Invalid Amazon related receipts");
    if (value.relatedReceipts.cancelledReceiptId !== undefined)
      message.relatedReceipts = {
        cancelledReceiptId: requiredString(
          value.relatedReceipts,
          "cancelledReceiptId",
          200,
        ),
      };
  }
  return message;
}
