import assert from "node:assert/strict";
import test from "node:test";
import {
  extractBalancedAfterMarker,
  inspectDartMapEntries,
  inspectFlutterCanonicalExpression,
  inspectMappedGeneratedFields,
  inspectNamedArguments,
  maskKotlinCommentsAndStrings,
  maskTypeScriptCommentsAndStrings,
} from "./audit-purchase-payload-parity.mjs";

test("Flutter canonical inspection reads the requested source key", () => {
  const result = inspectFlutterCanonicalExpression(
    "sourcePayload['dataAndroid']?.toString()",
  );

  assert.deepEqual(result, { issues: [], sourceKey: "dataAndroid" });
});

test("Flutter canonical inspection rejects fallback expressions", () => {
  const result = inspectFlutterCanonicalExpression(
    "sourcePayload['purchaseStateAndroid'] ?? sourcePayload['purchaseState']",
  );

  assert.equal(result.sourceKey, null);
  assert.deepEqual(result.issues, []);
});

test("Flutter canonical inspection follows own-key presence selectors", () => {
  const functionBody = `
    final hasSourceId = sourcePayload.containsKey('id');
    final sourceId = sourcePayload['id']?.toString();
    final purchaseId = hasSourceId ? sourceId : null;
  `;
  const result = inspectFlutterCanonicalExpression("purchaseId", functionBody);

  assert.deepEqual(result, { issues: [], sourceKey: "id" });
});

test("Flutter canonical inspection follows transaction selection helper", () => {
  const functionBody = `
    final transactionIdSelection = _transactionIdFrom(sourcePayload);
    final sourceTransactionId = transactionIdSelection.value;
  `;
  const result = inspectFlutterCanonicalExpression(
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

test("Dart payload parsing ignores multiline string delimiters", () => {
  for (const literal of [
    '"emoji 😀, } text"',
    '"""raw " ) , } text"""',
    "'''raw ' ) , } text'''",
    'r"""raw \\\\ " ) , } text"""',
    "r'''raw \\\\ ' ) , } text'''",
  ]) {
    const source = `
      return PurchaseAndroid(
        id: payload.id,
        dataAndroid: ${literal},
        productId: payload.productId,
      )
    `;
    const result = inspectNamedArguments(
      source,
      "return PurchaseAndroid",
      ":",
      "dart",
    );

    assert.deepEqual(result.issues, []);
    assert.deepEqual([...result.entries.keys()].sort(), [
      "dataAndroid",
      "id",
      "productId",
    ]);
  }
});

test("Dart payload parsing ignores nested block comments", () => {
  const source = `
    return PurchaseAndroid(
      id: payload.id,
      /* outer /* inner */ ) bogus: value, } still outer */
      productId: payload.productId,
    )
  `;
  const result = inspectNamedArguments(
    source,
    "return PurchaseAndroid",
    ":",
    "dart",
  );

  assert.deepEqual(result.issues, []);
  assert.deepEqual([...result.entries.keys()].sort(), ["id", "productId"]);
});

test("Dart payload parsing ignores nested strings in interpolation", () => {
  for (const expression of ['"${"}"} ) text"', '"""${\'"""\'} ) text"""']) {
    const source = [
      "return PurchaseAndroid(",
      "  id: payload.id,",
      `  dataAndroid: ${expression},`,
      "  productId: payload.productId,",
      ")",
    ].join("\n");
    const result = inspectNamedArguments(
      source,
      "return PurchaseAndroid",
      ":",
      "dart",
    );

    assert.deepEqual(result.issues, []);
    assert.deepEqual([...result.entries.keys()].sort(), [
      "dataAndroid",
      "id",
      "productId",
    ]);
  }
});

test("Dart map parsing preserves quoted key boundaries", () => {
  const result = inspectDartMapEntries(`
    'id': purchaseId,
    'productId': productId,
    'dataAndroid': """raw " ) , } text""",
  `);

  assert.deepEqual(result.issues, []);
  assert.deepEqual([...result.entries.keys()].sort(), [
    "dataAndroid",
    "id",
    "productId",
  ]);
  assert.equal(result.entries.get("id")?.trim(), "purchaseId");
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

test("TypeScript balanced extraction ignores braces in regex literals", () => {
  const source = `
    function mapPayload() {
      const closingBrace = /}/;
      return {id: payload.id};
    }
  `;
  const region = extractBalancedAfterMarker(
    source,
    "function mapPayload",
    "{",
    "}",
    "TypeScript regex fixture",
    maskTypeScriptCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /return\s+\{id:\s*payload\.id\};/);
});

test("TypeScript balanced extraction ignores regex literals after return", () => {
  const source = `
    function mapPayload() {
      return /}/.test(payload.id) ? {id: payload.id} : {id: null};
    }
  `;
  const region = extractBalancedAfterMarker(
    source,
    "function mapPayload",
    "{",
    "}",
    "TypeScript return-regex fixture",
    maskTypeScriptCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /\?\s+\{id:\s*payload\.id\}/);
  assert.match(region?.body ?? "", /:\s+\{id:\s*null\}/);
});

test("TypeScript regex masking preserves postfix division expressions", () => {
  for (const expression of [
    "count++ / scale",
    "count-- / scale",
    "count! / scale",
  ]) {
    const source = `
      function mapPayload() {
        const ratio = ${expression};
        return {id: ratio};
      }
    `;
    const region = extractBalancedAfterMarker(
      source,
      "function mapPayload",
      "{",
      "}",
      `TypeScript division fixture: ${expression}`,
      maskTypeScriptCommentsAndStrings,
    );

    assert.match(region?.body ?? "", /return\s+\{id:\s*ratio\}/);
  }
});

test("TypeScript balanced extraction ignores regex literals after spread", () => {
  const source = `
    function mapPayload() {
      const match = [.../}/.exec(payload.id)];
      return {id: match[0]};
    }
  `;
  const region = extractBalancedAfterMarker(
    source,
    "function mapPayload",
    "{",
    "}",
    "TypeScript spread-regex fixture",
    maskTypeScriptCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /return\s+\{id:\s*match\[0\]\}/);
});

test("TypeScript balanced extraction ignores regex literals after statements", () => {
  const source = `
    function mapPayload() {
      if (enabled) /}/.test(payload.id);
      return {id: payload.id};
    }
  `;
  const region = extractBalancedAfterMarker(
    source,
    "function mapPayload",
    "{",
    "}",
    "TypeScript statement-regex fixture",
    maskTypeScriptCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /return\s+\{id:\s*payload\.id\}/);
});

test("TypeScript balanced extraction ignores nested template literals", () => {
  const source = [
    "function mapPayload() {",
    '  const value = `${enabled ? `}` : "x"}`;',
    "  return {id: value};",
    "}",
  ].join("\n");
  const region = extractBalancedAfterMarker(
    source,
    "function mapPayload",
    "{",
    "}",
    "TypeScript nested-template fixture",
    maskTypeScriptCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /return\s+\{id:\s*value\}/);
});

test("TypeScript balanced extraction ignores template literal types", () => {
  const source = [
    "function mapPayload<T>() {",
    "  type Value = `${T}}`;",
    "  return {id: 1};",
    "}",
  ].join("\n");
  const region = extractBalancedAfterMarker(
    source,
    "function mapPayload",
    "{",
    "}",
    "TypeScript template-type fixture",
    maskTypeScriptCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /return\s+\{id:\s*1\}/);
});

test("Kotlin balanced extraction ignores braces in character literals", () => {
  const source = `
    fun mapPayload(): PurchaseAndroid {
      val closingBrace = '}'
      return PurchaseAndroid(id = payload.id)
    }
  `;
  const region = extractBalancedAfterMarker(
    source,
    "fun mapPayload",
    "{",
    "}",
    "Kotlin character fixture",
    maskKotlinCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /return\s+PurchaseAndroid/);
});

test("Kotlin balanced extraction ignores braces in raw strings", () => {
  const source = `
    fun mapPayload(): PurchaseAndroid {
      val raw = """raw " } content"""
      return PurchaseAndroid(id = "payload")
    }
  `;
  const region = extractBalancedAfterMarker(
    source,
    "fun mapPayload",
    "{",
    "}",
    "Kotlin raw-string fixture",
    maskKotlinCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /return\s+PurchaseAndroid/);
});

test("Kotlin balanced extraction ignores nested strings in interpolation", () => {
  const source = [
    "fun mapPayload(): PurchaseAndroid {",
    '  val value = "${if (enabled) "}" else "x"}"',
    "  return PurchaseAndroid(id = value)",
    "}",
  ].join("\n");
  const region = extractBalancedAfterMarker(
    source,
    "fun mapPayload",
    "{",
    "}",
    "Kotlin interpolation fixture",
    maskKotlinCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /return\s+PurchaseAndroid/);
});

test("Kotlin balanced extraction ignores braces in escaped identifiers", () => {
  const source = [
    "fun mapPayload(): PurchaseAndroid {",
    "  val `}` = 1",
    "  return PurchaseAndroid(id = payload.id)",
    "}",
  ].join("\n");
  const region = extractBalancedAfterMarker(
    source,
    "fun mapPayload",
    "{",
    "}",
    "Kotlin escaped-identifier fixture",
    maskKotlinCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /return\s+PurchaseAndroid/);
});

test("Kotlin balanced extraction ignores nested block comments", () => {
  const source = `
    fun mapPayload(): PurchaseAndroid {
      /* outer /* inner */ } still outer */
      return PurchaseAndroid(id = "payload")
    }
  `;
  const region = extractBalancedAfterMarker(
    source,
    "fun mapPayload",
    "{",
    "}",
    "Kotlin nested-comment fixture",
    maskKotlinCommentsAndStrings,
  );

  assert.match(region?.body ?? "", /return\s+PurchaseAndroid/);
});

test("line comments terminate on non-LF line separators", () => {
  for (const separator of ["\r", "\u2028", "\u2029"]) {
    const kotlin = [
      "fun mapPayload(): PurchaseAndroid {",
      "// comment }",
      'return PurchaseAndroid(id = "payload")',
      "}",
    ].join(separator);
    const kotlinRegion = extractBalancedAfterMarker(
      kotlin,
      "fun mapPayload",
      "{",
      "}",
      "Kotlin line-separator fixture",
      maskKotlinCommentsAndStrings,
    );
    assert.match(kotlinRegion?.body ?? "", /return\s+PurchaseAndroid/);

    const typescript = [
      "function mapPayload() {",
      "// comment }",
      "return {id: 1};",
      "}",
    ].join(separator);
    const typescriptRegion = extractBalancedAfterMarker(
      typescript,
      "function mapPayload",
      "{",
      "}",
      "TypeScript line-separator fixture",
      maskTypeScriptCommentsAndStrings,
    );
    assert.match(typescriptRegion?.body ?? "", /return\s+\{id:\s*1\}/);

    const dart = [
      "return PurchaseAndroid(",
      "id: payload.id,",
      "// comment )",
      "productId: payload.productId,",
      ")",
    ].join(separator);
    const dartResult = inspectNamedArguments(
      dart,
      "return PurchaseAndroid",
      ":",
      "dart",
    );
    assert.deepEqual(dartResult.issues, []);
    assert.deepEqual([...dartResult.entries.keys()].sort(), [
      "id",
      "productId",
    ]);
  }
});
