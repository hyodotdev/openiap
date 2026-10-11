"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action, type ActionCtx } from "../_generated/server";
import { buildAmazonRemoteId, requestAmazonReceipt } from "../purchases/amazon";
import {
  AmazonReceiptInvalidError,
  AmazonReceiptVerificationError,
} from "../purchases/errors";
import {
  amazonReceiptEnvironment,
  mapAmazonReceiptState,
} from "../purchases/amazonReceipt";
import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import { parseAmazonSnsTopic } from "./amazonShared";
import {
  confirmAmazonSnsSubscription,
  parseAmazonRtnMessage,
  verifyAmazonSnsEnvelope,
} from "./amazonSns";

export async function ingestAmazonRtnHandler(
  ctx: ActionCtx,
  args: { apiKey: string; rawEnvelope: string },
): Promise<{ type: string; deduped: boolean }> {
  const project = await ctx.runQuery(
    internal.webhooks.internal.getAmazonWebhookProject,
    { apiKey: args.apiKey },
  );
  const topicArn = project.amazonRtnTopicArn;
  const sharedSecret = project.amazonSharedSecret?.trim();
  const applicationId = project.androidPackageName;
  if (
    !topicArn ||
    !parseAmazonSnsTopic(topicArn) ||
    !applicationId ||
    !sharedSecret
  )
    throw new ConvexError({
      code: "AMAZON_RTN_NOT_CONFIGURED",
      message:
        "Configure the Android app, Amazon RVS shared secret and SNS topic ARN before enabling Amazon notifications",
    });
  const envelope = await verifyAmazonSnsEnvelope(args.rawEnvelope, topicArn);
  if (envelope.Type === "SubscriptionConfirmation") {
    await confirmAmazonSnsSubscription(envelope);
    return { type: envelope.Type, deduped: false };
  }
  if (envelope.Type === "UnsubscribeConfirmation")
    return { type: envelope.Type, deduped: false };
  const notice = parseAmazonRtnMessage(envelope, applicationId);
  const duplicate = await ctx.runQuery(
    internal.webhooks.internal.lookupExistingEvent,
    {
      projectId: project._id,
      source: "amazon",
      sourceNotificationId: envelope.MessageId,
    },
  );
  if (duplicate) return { type: duplicate.type, deduped: true };
  const relatedReceiptId =
    notice.notificationType === "SUBSCRIPTION_MODIFIED_IMMEDIATE"
      ? notice.relatedReceipts?.cancelledReceiptId
      : undefined;
  await ctx.runMutation(internal.purchases.verificationAdmission.consume, {
    projectId: project._id,
    cost: relatedReceiptId ? 2 : 1,
  });
  const sequence = await ctx.runMutation(
    internal.purchases.internal.reserveAmazonRvsSequence,
    { projectId: project._id },
  );
  const verifyReceipt = async (receiptId: string) => {
    const requestData = {
      store: "amazon" as const,
      userId: notice.appUserId,
      receiptId,
      sandbox: false,
    };
    const common = {
      projectId: project._id,
      applicationId,
      remoteId: buildAmazonRemoteId({
        userId: notice.appUserId,
        receiptId,
        sandbox: false,
      }),
      requestData,
      amazonRvsSequence: sequence,
    };
    const startedAt = Date.now();
    try {
      // LAT uses production RVS credentials; verified beta/test fields identify Sandbox.
      const receipt = await requestAmazonReceipt({
        sharedSecret,
        userId: notice.appUserId,
        receiptId,
        sandbox: false,
        maxAttempts: 1,
      });
      return {
        ...common,
        remoteResponse: JSON.stringify(receipt),
        state: mapAmazonReceiptState(receipt),
        environment: amazonReceiptEnvironment(false, receipt),
        verificationDurationMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (
        error instanceof AmazonReceiptVerificationError &&
        error.errorDetails?.status === 496
      )
        throw new ConvexError({
          code: "AMAZON_RTN_NOT_CONFIGURED",
          message:
            "Correct the Amazon RVS shared secret before retrying this notification",
        });
      if (!(error instanceof AmazonReceiptInvalidError))
        throw new ConvexError({
          code: "AMAZON_RVS_UNAVAILABLE",
          message:
            "Amazon RVS could not provide a trustworthy verdict; retry this notification",
        });
      return {
        ...common,
        remoteResponse: JSON.stringify({
          error: error.errorCode,
          status: error.errorDetails?.status,
        }),
        state:
          error.errorDetails?.status === 410
            ? HarmonizedPurchaseState.CANCELED
            : HarmonizedPurchaseState.INAUTHENTIC,
        environment: "Production" as const,
        verificationDurationMs: Date.now() - startedAt,
      };
    }
  };
  const verdict = await verifyReceipt(notice.receiptId);
  const relatedReceipt =
    relatedReceiptId && relatedReceiptId !== notice.receiptId
      ? await verifyReceipt(relatedReceiptId)
      : undefined;
  return await ctx.runMutation(
    internal.purchases.internal.applyAmazonRtnVerdict,
    {
      ...verdict,
      ...(relatedReceipt ? { relatedReceipt } : {}),
      amazonNotice: {
        messageId: envelope.MessageId,
        notificationType: notice.notificationType,
        occurredAt: notice.timestamp,
        rawSignedPayload: args.rawEnvelope,
      },
    },
  );
}

export const ingestAmazonRtn = action({
  args: { apiKey: v.string(), rawEnvelope: v.string() },
  returns: v.object({ type: v.string(), deduped: v.boolean() }),
  handler: ingestAmazonRtnHandler,
});
