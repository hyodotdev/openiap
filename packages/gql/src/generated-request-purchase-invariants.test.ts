import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function generated(name: string): string {
  return readFileSync(new URL(`./generated/${name}`, import.meta.url), 'utf8');
}

describe('RequestPurchaseProps generated invariants', () => {
  it('rejects zero or two branches in Kotlin and Swift decoders', () => {
    expect(generated('Types.kt')).toContain(
      'require((purchaseJson == null) != (subscriptionJson == null))',
    );
    expect(generated('Types.swift')).toContain(
      'guard (purchase == nil) != (subscription == nil) else',
    );
  });

  it('validates branch count and product type in C#', () => {
    const csharp = generated('Types.cs');
    expect(csharp).toContain('RequestPurchaseProps : IJsonOnDeserialized');
    expect(csharp).toContain('if (hasPurchase == hasSubscription)');
    expect(csharp).toContain('if (hasPurchase && Type != ProductQueryType.InApp)');
    expect(csharp).toContain('if (hasSubscription && Type != ProductQueryType.Subs)');
  });

  it('provides safe GDScript factories and rejects ambiguous dictionaries', () => {
    const gdscript = generated('types.gd');
    expect(gdscript).toContain(
      'static func in_app(platforms: RequestPurchasePropsByPlatforms',
    );
    expect(gdscript).toContain(
      'static func subs(platforms: RequestSubscriptionPropsByPlatforms',
    );
    expect(gdscript).toContain('if has_purchase == has_subscription:');
    expect(gdscript).toContain(
      'RequestPurchaseProps requires exactly one of requestPurchase or requestSubscription',
    );
  });
});
