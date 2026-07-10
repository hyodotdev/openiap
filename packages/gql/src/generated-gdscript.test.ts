import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const generated = readFileSync(new URL('./generated/types.gd', import.meta.url), 'utf8');

function classSource(className: string, nextClassName: string): string {
  const start = generated.indexOf(`class ${className}:`);
  const end = generated.indexOf(`class ${nextClassName}:`, start + 1);
  return generated.slice(start, end);
}

describe('generated GDScript list decoding', () => {
  it('builds typed scalar arrays from JSON arrays', () => {
    const source = classSource('ProductRequest', 'PromotionalOfferJWSInputIOS');

    expect(source).toContain('var arr: Array[String] = []');
    expect(source).toContain('arr.append(str(item))');
  });

  it('builds typed nested model arrays before assignment', () => {
    const source = classSource('ProductIOS', 'ProductSubscriptionAndroid');

    expect(source).toContain('var arr: Array[SubscriptionOffer] = []');
    expect(source).toContain('arr.append(SubscriptionOffer.from_dict(item))');
    expect(source).toContain('var arr: Array[SubscriptionPricingTermsIOS] = []');
  });

  it('rebuilds list arguments in generated operation helpers', () => {
    const source = classSource('Query', 'Mutation');

    expect(source).toContain('var arr: Array[String] = []');
    expect(source).toContain('obj.subscription_ids = arr');
  });
});
