const storeCommands =
  /^(purchases|subscriptions|users|orders|webhooks|issues) /;
const evidenceFields = new Set([
  "requestData",
  "remoteResponse",
  "remoteId",
  "purchaseToken",
  "transactionId",
  "originalTransactionId",
  "signedTransactionInfo",
  "signedRenewalInfo",
  "signedPayload",
  "rawSignedPayload",
  "raw",
  "transactions",
]);
const webhookFields = new Set([
  "url",
  "destinationUrl",
  "lastError",
  "error",
  "description",
  "destinationDescription",
]);

export function redactStoreEvidence(command, data, confirmed) {
  if (confirmed || !storeCommands.test(command)) return data;
  const webhook = command.startsWith("webhooks ");
  function visit(value) {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    const result = Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !evidenceFields.has(key) && !(webhook && webhookFields.has(key)),
        )
        .map(([key, field]) => [
          key,
          key === "rawEvidenceVisible"
            ? false
            : command === "orders lookup" && key === "error"
              ? "The store did not answer."
              : visit(field),
        ]),
    );
    const url = value.url ?? value.destinationUrl;
    if (webhook && typeof url === "string") {
      try {
        result.destinationHost = new URL(url).host;
      } catch {
        result.destinationHost = "invalid URL";
      }
    }
    return result;
  }
  return visit(data);
}
