import { describe, expect, it } from 'vitest';
import { injectPropertyDeprecationJSDoc, injectTypeDeprecationJSDoc, operationArgsOwnerNames } from '../scripts/generated-doc-comments.mjs';

describe('generated TypeScript documentation comments', () => {
  it('injects canonical type reasons into existing and missing JSDoc blocks', () => {
    const source = `/**
 * Legacy offer.
 */
export interface LegacyOffer {}

export type OtherLegacy = {
  id: string;
};

export enum LegacyMode {
  Old = 'old',
}`;

    const result = injectTypeDeprecationJSDoc(
      source,
      new Map([
        ['LegacyOffer', 'Use SubscriptionOffer instead.'],
        ['OtherLegacy', 'Use DiscountOffer instead.'],
        ['LegacyMode', 'Use BillingProgram instead.'],
      ]),
    );

    expect(result).toContain('* Legacy offer.\n * @deprecated Use SubscriptionOffer instead.');
    expect(result).toContain('/**\n * @deprecated Use DiscountOffer instead.\n */\nexport type OtherLegacy');
    expect(result).toContain('/**\n * @deprecated Use BillingProgram instead.\n */\nexport enum LegacyMode');
  });

  it('fails closed for duplicate tags and missing declarations', () => {
    expect(() =>
      injectTypeDeprecationJSDoc(
        `/** @deprecated Manual reason. */
export interface Legacy {}`,
        new Map([['Legacy', 'Canonical reason.']]),
      ),
    ).toThrow('manual @deprecated');

    expect(() => injectTypeDeprecationJSDoc('export interface Present {}', new Map([['Missing', 'Canonical reason.']]))).toThrow('found 0');
  });

  it('injects canonical operation argument reasons into generated properties', () => {
    const source = `export interface QueryValueArgs {
  /** Legacy selector. */
  legacy?: string | null;
  modern?: string | null;
}

export interface MutationRunArgs {
  oldMode?: string | null;
}`;
    const result = injectPropertyDeprecationJSDoc(source, [
      {
        ownerName: 'QueryValueArgs',
        propertyName: 'legacy',
        reason: 'Use modern instead.',
      },
      {
        ownerName: 'MutationRunArgs',
        propertyName: 'oldMode',
        reason: 'Use mode instead.',
      },
    ]);

    expect(result).toContain('* Legacy selector.\n   * @deprecated Use modern instead.');
    expect(result).toContain('/**\n   * @deprecated Use mode instead.\n   */\n  oldMode?');
    expect(result).not.toContain('@deprecated Use modern instead.\n   */\n  modern');
  });

  it('resolves graphql-codegen casing for IOS-suffixed operation args', () => {
    const ownerNames = operationArgsOwnerNames('Query', 'currentEntitlementIOS');
    expect(ownerNames).toEqual(['QueryCurrentEntitlementIosArgs', 'QueryCurrentEntitlementIOSArgs']);

    const result = injectPropertyDeprecationJSDoc(
      `export interface QueryCurrentEntitlementIosArgs {
  sku: string;
}`,
      [
        {
          ownerNames,
          propertyName: 'sku',
          reason: 'Use productId instead.',
        },
      ],
    );
    expect(result).toContain('@deprecated Use productId instead.');
  });

  it('fails closed for ambiguous operation argument ownership', () => {
    expect(() =>
      injectPropertyDeprecationJSDoc('export interface PresentArgs { value?: string }', [
        {
          ownerName: 'MissingArgs',
          propertyName: 'value',
          reason: 'Use modern instead.',
        },
      ]),
    ).toThrow('must have exactly one generated TypeScript interface; found 0');

    expect(() =>
      injectPropertyDeprecationJSDoc('export interface PresentArgs { value?: string }', [
        {
          ownerName: 'PresentArgs',
          propertyName: 'missing',
          reason: 'Use modern instead.',
        },
      ]),
    ).toThrow('must have exactly one generated TypeScript property; found 0');
  });
});
