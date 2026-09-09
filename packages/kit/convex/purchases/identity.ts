export function buildHorizonRemoteId(userId: string, sku: string): string {
  return `${encodeURIComponent(userId)}:${encodeURIComponent(sku)}`;
}

export function buildAmazonRemoteId(args: {
  userId: string;
  receiptId: string;
  sandbox: boolean;
}): string {
  return [
    args.sandbox ? "sandbox" : "production",
    encodeURIComponent(args.userId),
    encodeURIComponent(args.receiptId),
  ].join(":");
}
