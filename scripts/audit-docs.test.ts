import { describe, expect, test } from 'bun:test';
import { auditActiveCodeExampleSource } from './audit-docs';

describe('active docs code-example audit', () => {
  test('flags recurring cross-language phantom patterns', () => {
    const source = [
      '<CodeBlock language="csharp">{`@Deprecated("old") Task<Boolean> Run()`}</CodeBlock>',
      '<CodeBlock language="dart">{`iap.purchaseUpdatedStream.listen(onPurchase); iap.finishTransaction(purchase);`}</CodeBlock>',
      '<CodeBlock language="swift">{`let store = OpenIapStore.shared; subscription.remove()`}</CodeBlock>',
      '<CodeBlock language="typescript">{`await verifyPurchase({ purchase, serverUrl: url }); await requestPurchase({ sku: "x" });`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`println("Offer token: ${offer.offerToken}")`}</CodeBlock>',
    ].join('\n');

    const drifts = auditActiveCodeExampleSource('/tmp/active.tsx', source);
    expect(drifts.map((drift) => drift.rule)).toEqual([
      'R11',
      'R11',
      'R11',
      'R11',
      'R11',
      'R11',
      'R11',
      'R11',
    ]);
  });

  test('accepts the current listener and purchase shapes', () => {
    const source = [
      '<CodeBlock language="dart">{`iap.purchaseUpdatedListener.listen(onPurchase); await iap.finishTransaction(purchase: purchase);`}</CodeBlock>',
      '<CodeBlock language="typescript">{`await requestPurchase({ request: { apple: { sku: "x" } }, type: "in-app" });`}</CodeBlock>',
    ].join('\n');

    expect(auditActiveCodeExampleSource('/tmp/active.tsx', source)).toEqual([]);
  });

  test('audits formatted multiline CodeBlock children', () => {
    const source = `<CodeBlock language="dart">
      {\`iap.purchaseUpdatedStream.listen(onPurchase);\`}
    </CodeBlock>`;

    expect(auditActiveCodeExampleSource('/tmp/active.tsx', source)).toEqual([
      expect.objectContaining({ rule: 'R11', line: 2 }),
    ]);
  });

  test('flags offer-token logging across formatted lines', () => {
    const source = `<CodeBlock language="kotlin">{\`println(
  offer.offerToken
)\`}</CodeBlock>`;

    expect(auditActiveCodeExampleSource('/tmp/active.tsx', source)).toEqual([
      expect.objectContaining({ rule: 'R11', line: 1 }),
    ]);
  });

  test('flags a top-level Godot purchase sku', () => {
    const source = `<CodeBlock language="gdscript">{\`var props = Types.RequestPurchaseProps.new()
props.sku = "premium"\`}</CodeBlock>`;

    expect(auditActiveCodeExampleSource('/tmp/active.tsx', source)).toEqual([
      expect.objectContaining({ rule: 'R11', line: 1 }),
    ]);
  });
});
