import { v, type Infer } from "convex/values";

export interface AmazonSnsTopic {
  arn: string;
  origin: string;
}

export function parseAmazonSnsTopic(arn: string): AmazonSnsTopic | null {
  const match =
    /^arn:aws:sns:([a-z]{2}-[a-z0-9-]+-\d+):\d{12}:[A-Za-z0-9_-]{1,256}$/.exec(
      arn,
    );
  return match
    ? { arn, origin: `https://sns.${match[1]}.amazonaws.com` }
    : null;
}

export interface AmazonRtnMessage {
  receiptId: string;
  appUserId: string;
  appPackageName: string;
  notificationType: string;
  timestamp: number;
  betaProductTransaction: boolean;
  relatedReceipts?: { cancelledReceiptId?: string };
}

export const amazonLifecycleNoticeValidator = v.object({
  messageId: v.string(),
  notificationType: v.string(),
  occurredAt: v.number(),
  rawSignedPayload: v.string(),
});
export type AmazonLifecycleNotice = Infer<
  typeof amazonLifecycleNoticeValidator
>;
