import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectFlutterCanonicalExpression,
  inspectMappedGeneratedFields,
  inspectNamedArguments,
} from "./audit-purchase-payload-parity.mjs";

const canonicalHelper = `
dynamic _canonicalOrLegacy(
  Map<String, dynamic> payload, {
  required String canonicalKey,
  required String legacyKey,
}) {
  if (payload.containsKey(canonicalKey)) {
    return payload[canonicalKey];
  }
  final legacy = payload[legacyKey];
  return legacy;
}
`;

test("Flutter canonical helper preserves canonical-first payload lookup", () => {
  const result = inspectFlutterCanonicalExpression(
    canonicalHelper,
    `_canonicalOrLegacy(
      sourcePayload,
      canonicalKey: 'dataAndroid',
      legacyKey: 'originalJsonAndroid',
    )?.toString()`,
  );

  assert.deepEqual(result, { issues: [], sourceKey: "dataAndroid" });
});

test("Flutter canonical helper rejects a legacy-first implementation", () => {
  const legacyFirst = canonicalHelper.replace(
    `if (payload.containsKey(canonicalKey)) {
    return payload[canonicalKey];
  }
  final legacy = payload[legacyKey];`,
    `final legacy = payload[legacyKey];
  if (legacy != null) {
    return legacy;
  }
  return payload[canonicalKey];`,
  );
  const result = inspectFlutterCanonicalExpression(
    legacyFirst,
    `_canonicalOrLegacy(
      sourcePayload,
      canonicalKey: 'purchaseState',
      legacyKey: 'purchaseStateAndroid',
    )`,
  );

  assert.equal(result.sourceKey, null);
  assert.match(result.issues.join("\n"), /canonicalKey.*legacyKey/);
});

test("Flutter canonical helper call sites retain their declared source key", () => {
  const result = inspectFlutterCanonicalExpression(
    canonicalHelper,
    `_coerceAndroidPurchaseState(
      _canonicalOrLegacy(
        sourcePayload,
        canonicalKey: 'purchaseState',
        legacyKey: 'purchaseStateAndroid',
      ),
    )`,
  );

  assert.deepEqual(result, { issues: [], sourceKey: "purchaseState" });
});

test("Flutter canonical helper call sites cannot claim a different field", () => {
  const result = inspectFlutterCanonicalExpression(
    canonicalHelper,
    `_canonicalOrLegacy(
      sourcePayload,
      canonicalKey: 'originalJsonAndroid',
      legacyKey: 'dataAndroid',
    )`,
  );

  assert.deepEqual(result, {
    issues: [],
    sourceKey: "originalJsonAndroid",
  });
});

test("Flutter canonical helper ignores canonical-looking comments", () => {
  const decoy = `
dynamic _canonicalOrLegacy(
  Map<String, dynamic> payload, {
  required String canonicalKey,
  required String legacyKey,
}) {
  // if (payload.containsKey(canonicalKey)) {
  //   return payload[canonicalKey];
  // }
  final legacy = payload[legacyKey];
  return legacy;
}
`;
  const result = inspectFlutterCanonicalExpression(
    decoy,
    `_canonicalOrLegacy(
      sourcePayload,
      canonicalKey: 'purchaseState',
      legacyKey: 'transactionStateIOS',
    )`,
  );

  assert.equal(result.sourceKey, null);
  assert.match(result.issues.join("\n"), /canonicalKey.*legacyKey/);
});

test("Flutter canonical helper rejects an early return before canonical data", () => {
  const earlyReturn = canonicalHelper.replace(
    "if (payload.containsKey(canonicalKey)) {",
    "if (payload.isEmpty) return legacy;\n  if (payload.containsKey(canonicalKey)) {",
  );
  const result = inspectFlutterCanonicalExpression(
    earlyReturn,
    `_canonicalOrLegacy(
      sourcePayload,
      canonicalKey: 'purchaseState',
      legacyKey: 'purchaseStateAndroid',
    )`,
  );

  assert.equal(result.sourceKey, null);
  assert.match(result.issues.join("\n"), /canonicalKey.*legacyKey/);
});

test("a fallback before the helper remains the first payload source", () => {
  const result = inspectFlutterCanonicalExpression(
    canonicalHelper,
    `sourcePayload['originalJsonAndroid'] ??
      _canonicalOrLegacy(
        sourcePayload,
        canonicalKey: 'dataAndroid',
        legacyKey: 'originalJsonAndroid',
      )`,
  );

  assert.deepEqual(result, {
    issues: [],
    sourceKey: "originalJsonAndroid",
  });
});

test("Flutter canonical inspection follows own-key presence selectors", () => {
  const functionBody = `
    final hasSourceId = sourcePayload.containsKey('id');
    final sourceId = sourcePayload['id']?.toString();
    final purchaseId = hasSourceId ? sourceId : null;
  `;
  const result = inspectFlutterCanonicalExpression(
    canonicalHelper,
    "purchaseId",
    functionBody,
  );

  assert.deepEqual(result, { issues: [], sourceKey: "id" });
});

test("Flutter canonical inspection follows transaction selection helper", () => {
  const functionBody = `
    final transactionIdSelection = _transactionIdFrom(sourcePayload);
    final sourceTransactionId = transactionIdSelection.value;
  `;
  const result = inspectFlutterCanonicalExpression(
    canonicalHelper,
    "sourceTransactionId",
    functionBody,
  );

  assert.deepEqual(result, { issues: [], sourceKey: "transactionId" });
});

test("Kotlin payload parsing ignores decoys and nested commas", () => {
  const source = `
    // return PurchaseAndroid(fake = "comment, decoy")
    return PurchaseAndroid(
      id = purchase.id,
      dataAndroid = serialize("value,with,commas"),
      pendingPurchaseUpdateAndroid = PendingPurchaseUpdateAndroid(
        products = listOf("one", "two"),
        purchaseToken = purchase.purchaseToken,
      ),
    )
  `;
  const result = inspectNamedArguments(source, "return PurchaseAndroid", "=");

  assert.deepEqual(result.issues, []);
  assert.deepEqual([...result.entries.keys()].sort(), [
    "dataAndroid",
    "id",
    "pendingPurchaseUpdateAndroid",
  ]);
  assert.equal(
    result.entries.get("dataAndroid")?.replace(/\s+/g, " ").trim(),
    'serialize("value,with,commas")',
  );
});

test("generated mapping defaults remain tied to generated fields", () => {
  assert.deepEqual(
    inspectMappedGeneratedFields(
      ["dataAndroid", "id", "optionalField"],
      ["dataAndroid", "id"],
      ["optionalField"],
    ),
    [],
  );
  assert.match(
    inspectMappedGeneratedFields(
      ["dataAndroid", "id"],
      ["dataAndroid", "id"],
      ["inventedField"],
    ).join("\n"),
    /unknown defaulted fields: inventedField/,
  );
});
