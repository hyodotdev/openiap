import { describe, expect, it } from 'vitest';
import { buildASTSchema, parse } from 'graphql';
import { transformSchema } from '../codegen/core/transformer';
import { CSharpPlugin } from '../codegen/plugins/csharp';
import { DartPlugin } from '../codegen/plugins/dart';
import { GDScriptPlugin } from '../codegen/plugins/gdscript';
import { KotlinPlugin } from '../codegen/plugins/kotlin';
import { SwiftPlugin } from '../codegen/plugins/swift';
import {
  GRAPHQL_TO_CSHARP,
  GRAPHQL_TO_DART,
  GRAPHQL_TO_GDSCRIPT,
  GRAPHQL_TO_KOTLIN,
  GRAPHQL_TO_SWIFT,
  GRAPHQL_TO_TYPESCRIPT,
  SUPPORTED_GRAPHQL_SCALARS,
} from '../codegen/core/utils';
import { extractSchemaDeprecations } from '../schema-deprecations.mjs';

function transform(sdl: string, unionWrappers: string[] = []) {
  const source = `directive @openiapDeprecated(reason: String!) on OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT
${sdl}`;
  return transformSchema({
    schema: buildASTSchema(parse(source)),
    markers: {
      unionWrappers: new Set(unionWrappers),
      futureFields: new Set(),
      issues: [],
    },
    deprecations: extractSchemaDeprecations([source]),
    sdlContents: new Map([['schema.graphql', source]]),
  });
}

describe('deprecation documentation transformation', () => {
  it('rejects ambiguous enum wire values and unmapped scalars', () => {
    expect(() => transform('enum Ambiguous { FooBar Foo_Bar }')).toThrow(
      'Ambiguous enum values FooBar and Foo_Bar both serialize as "foo-bar".',
    );
    expect(() => transform('scalar Money type Query { price: Money }')).toThrow('Unsupported GraphQL scalar Money');
    expect(() => transform('scalar Money type Query { ok: Boolean }')).toThrow('Unsupported GraphQL scalar Money');

    for (const mapping of [
      GRAPHQL_TO_TYPESCRIPT,
      GRAPHQL_TO_SWIFT,
      GRAPHQL_TO_KOTLIN,
      GRAPHQL_TO_DART,
      GRAPHQL_TO_GDSCRIPT,
      GRAPHQL_TO_CSHARP,
    ]) {
      expect(new Set(Object.keys(mapping))).toEqual(SUPPORTED_GRAPHQL_SCALARS);
    }
    for (const plugin of [
      new SwiftPlugin({ outputPath: 'Types.swift' }),
      new KotlinPlugin({ outputPath: 'Types.kt' }),
      new DartPlugin({ outputPath: 'types.dart' }),
      new GDScriptPlugin({ outputPath: 'types.gd' }),
      new CSharpPlugin({ outputPath: 'Types.cs' }),
    ]) {
      expect(() => plugin.mapScalar('Money')).toThrow('GraphQL scalar mapping');
    }
  });

  it('fails closed when ProductCommon platform defaults lose exact schema ownership', () => {
    const productContract = `
      enum IapPlatform { IOS Android }
      enum ProductType { InApp Subs }
      interface ProductCommon {
        platform: IapPlatform!
        type: ProductType!
      }
      type ProductAndroid implements ProductCommon {
        platform: IapPlatform!
        type: ProductType!
      }
      type ProductIOS implements ProductCommon {
        platform: IapPlatform!
        type: ProductType!
      }
      type ProductSubscriptionAndroid implements ProductCommon {
        platform: IapPlatform!
        type: ProductType!
      }
      type ProductSubscriptionIOS implements ProductCommon {
        platform: IapPlatform!
        type: ProductType!
      }
      type Query { product: ProductAndroid }
    `;

    const schema = transform(productContract);
    expect(
      schema.objects.find((objectType) => objectType.name === 'ProductSubscriptionIOS')?.fields.find((field) => field.name === 'type')
        ?.defaultValue,
    ).toBe('subs');

    expect(() =>
      transform(
        productContract.replace(
          'type Query { product: ProductAndroid }',
          `type ProductVision implements ProductCommon {
            platform: IapPlatform!
            type: ProductType!
          }
          type Query { product: ProductAndroid }`,
        ),
      ),
    ).toThrow('ProductCommon platform-default coverage drifted');

    expect(() =>
      transform(
        productContract.replace(
          `type ProductIOS implements ProductCommon {
        platform: IapPlatform!`,
          `type ProductIOS implements ProductCommon {
        platform: String!`,
        ),
      ),
    ).toThrow('ProductIOS.platform platform-default contract must remain non-null IapPlatform');

    expect(() => transform(productContract.replace('IOS Android', 'IOS'))).toThrow(
      'ProductAndroid.platform platform default "android" is not a IapPlatform wire value',
    );
  });

  it('uses directive reasons once for object types and fields', () => {
    const schema = transform(`
      """Legacy offer metadata."""
      type LegacyOffer @openiapDeprecated(reason: "Use DiscountOffer instead.") {
        """Legacy identifier."""
        legacyId: String @deprecated(reason: "Use id instead.")
      }

      """Legacy billing selector."""
      enum LegacyBillingMode @openiapDeprecated(reason: "Use BillingProgram instead.") {
        """Legacy choice."""
        LEGACY @deprecated(reason: "Use MODERN instead.")
        MODERN
      }
    `);
    const legacyOffer = schema.objects.find((object) => object.name === 'LegacyOffer');
    const legacyBillingMode = schema.enums.find((enumeration) => enumeration.name === 'LegacyBillingMode');

    expect(legacyOffer?.description).toBe('Legacy offer metadata.\n@deprecated Use DiscountOffer instead.');
    expect(legacyOffer?.fields[0]?.description).toBe('Legacy identifier.\n@deprecated Use id instead.');
    expect(legacyBillingMode?.description).toBe('Legacy billing selector.\n@deprecated Use BillingProgram instead.');
    expect(legacyBillingMode?.values[0]?.description).toBe('Legacy choice.\n@deprecated Use MODERN instead.');
  });

  it('preserves type-level reasons on operation roots', () => {
    const schema = transform(`
      """Legacy query root."""
      type Query @openiapDeprecated(reason: "Use the replacement root.") {
        value: String
      }
    `);

    expect(schema.operations[0]?.description).toBe('Legacy query root.\n@deprecated Use the replacement root.');
    expect(new GDScriptPlugin({ outputPath: 'types.gd' }).generate(schema)).toContain(
      '## Legacy query root. @deprecated Use the replacement root.\nclass Query:',
    );
  });

  it('preserves operation argument reasons in every custom generator', () => {
    const schema = transform(`
      type Query {
        value(
          """Legacy selector."""
          legacy: String @deprecated(reason: "Use modern instead.")
        ): String
      }
    `);
    const plugins = [
      new SwiftPlugin({ outputPath: 'Types.swift' }),
      new KotlinPlugin({ outputPath: 'Types.kt' }),
      new DartPlugin({ outputPath: 'types.dart' }),
      new GDScriptPlugin({ outputPath: 'types.gd' }),
      new CSharpPlugin({ outputPath: 'Types.cs' }),
    ];

    for (const plugin of plugins) {
      expect(plugin.generate(schema)).toContain('@deprecated Use modern instead.');
    }
  });

  it('preserves reasons on custom VoidResult declarations', () => {
    const schema = transform(`
      """Generic completion result."""
      type VoidResult @openiapDeprecated(reason: "Use the operation return value instead.") {
        success: Boolean!
      }
    `);
    const plugins = [
      new SwiftPlugin({ outputPath: 'Types.swift' }),
      new KotlinPlugin({ outputPath: 'Types.kt' }),
      new DartPlugin({ outputPath: 'types.dart' }),
      new CSharpPlugin({ outputPath: 'Types.cs' }),
    ];

    for (const plugin of plugins) {
      expect(plugin.generate(schema)).toContain('@deprecated Use the operation return value instead.');
    }
  });

  it('preserves reasons on result-union variants', () => {
    const schema = transform(
      `
        type LegacyResult {
          """Legacy result branch."""
          legacy: String @deprecated(reason: "Use modern instead.")
          modern: String
        }
      `,
      ['LegacyResult'],
    );
    const plugins = [
      new SwiftPlugin({ outputPath: 'Types.swift' }),
      new KotlinPlugin({ outputPath: 'Types.kt' }),
      new DartPlugin({ outputPath: 'types.dart' }),
      new CSharpPlugin({ outputPath: 'Types.cs' }),
    ];

    for (const plugin of plugins) {
      expect(plugin.generate(schema)).toContain('@deprecated Use modern instead.');
    }
  });

  it('fails closed when a custom input gains an unhandled field', () => {
    expect(() =>
      transform(`
        input RequestPurchaseProps {
          requestPurchase: RequestPurchasePropsByPlatforms
          requestSubscription: RequestSubscriptionPropsByPlatforms
          type: ProductQueryType = InApp
          useAlternativeBilling: Boolean
          unexpected: String
        }
        input RequestPurchasePropsByPlatforms {
          apple: String
          google: String
          ios: String
          android: String
        }
        input RequestSubscriptionPropsByPlatforms {
          apple: String
          google: String
          ios: String
          android: String
        }
        enum ProductQueryType { InApp Subs All }
      `),
    ).toThrow('RequestPurchaseProps custom input contract fields drifted');
    expect(() =>
      transform(`
        input DiscountOfferInputIOS {
          identifier: String!
          keyIdentifier: String!
          nonce: String!
          signature: String!
          timestamp: Float!
          unexpected: String
        }
      `),
    ).toThrow('DiscountOfferInputIOS custom input contract fields drifted');
  });

  it('fails closed when custom input type, nullability, or defaults drift', () => {
    expect(() =>
      transform(`
        input PurchaseInput {
          id: String!
          productId: String!
          ids: [String!]
          transactionDate: Float!
          purchaseToken: String
          store: IapStore
          platform: IapPlatform
          quantity: Int!
          purchaseState: PurchaseState!
          isAutoRenewing: Boolean!
        }
        enum IapStore { Apple Google }
        enum IapPlatform { Ios Android }
        enum PurchaseState { Purchased }
      `),
    ).toThrow('PurchaseInput.id custom input contract drifted');

    expect(() =>
      transform(`
        input DiscountOfferInputIOS {
          identifier: String!
          keyIdentifier: String!
          nonce: String!
          signature: String!
          timestamp: Int!
        }
      `),
    ).toThrow('DiscountOfferInputIOS.timestamp custom input contract drifted');

    expect(() =>
      transform(`
        input RequestPurchaseProps {
          requestPurchase: RequestPurchasePropsByPlatforms
          requestSubscription: RequestSubscriptionPropsByPlatforms
          type: ProductQueryType = Subs
          useAlternativeBilling: Boolean
        }
        input RequestPurchasePropsByPlatforms {
          apple: RequestPurchaseIosProps
          google: RequestPurchaseAndroidProps
          ios: RequestPurchaseIosProps
          android: RequestPurchaseAndroidProps
        }
        input RequestSubscriptionPropsByPlatforms {
          apple: RequestSubscriptionIosProps
          google: RequestSubscriptionAndroidProps
          ios: RequestSubscriptionIosProps
          android: RequestSubscriptionAndroidProps
        }
        input RequestPurchaseIosProps { value: String }
        input RequestPurchaseAndroidProps { value: String }
        input RequestSubscriptionIosProps { value: String }
        input RequestSubscriptionAndroidProps { value: String }
        enum ProductQueryType { InApp Subs All }
      `),
    ).toThrow('RequestPurchaseProps.type custom input contract drifted');
  });

  it('fails closed when nested platform input projections drift', () => {
    expect(() =>
      transform(`
        input RequestPurchasePropsByPlatforms {
          apple: RequestPurchaseIosProps
          google: String
          ios: RequestPurchaseIosProps
          android: RequestPurchaseAndroidProps
        }
        input RequestPurchaseIosProps { value: String }
        input RequestPurchaseAndroidProps { value: String }
      `),
    ).toThrow('RequestPurchasePropsByPlatforms.google custom input contract drifted');
  });

  it('requires exact concrete projections of interface field deprecations', () => {
    const schema = transform(`
      interface LegacyCommon {
        platform: String @deprecated(reason: "Use store instead.")
      }
      type LegacyAndroid implements LegacyCommon {
        platform: String @deprecated(reason: "Use store instead.")
      }
    `);
    const legacy = schema.objects.find((object) => object.name === 'LegacyAndroid');

    expect(legacy?.fields[0]?.description).toBe('@deprecated Use store instead.');
    expect(new GDScriptPlugin({ outputPath: 'types.gd' }).generate(schema)).toContain(
      '## @deprecated Use store instead.\n\tvar platform: Variant = null',
    );
  });

  it('fails closed when an implementation omits or conflicts with interface deprecation guidance', () => {
    expect(() =>
      transform(`
        interface LegacyCommon {
          platform: String @deprecated(reason: "Use store instead.")
        }
        type LegacyAndroid implements LegacyCommon {
          platform: String
        }
      `),
    ).toThrow('must repeat the exact interface-owned deprecation guidance');

    expect(() =>
      transform(`
        interface LegacyCommon {
          platform: String @deprecated(reason: "Use store instead.")
        }
        type LegacyAndroid implements LegacyCommon {
          platform: String @deprecated(reason: "Use purchaseStore instead.")
        }
      `),
    ).toThrow('conflicts with the exact interface-owned deprecation guidance');
  });

  it('fails closed when descriptions duplicate directive-owned tags', () => {
    expect(() =>
      transform(`
        """
        Legacy offer metadata.
        @deprecated Manual duplicate.
        """
        type LegacyOffer @openiapDeprecated(reason: "Canonical reason.") {
          id: String
        }
      `),
    ).toThrow('duplicates directive-owned @deprecated guidance');
  });

  it('fails closed for an explicitly empty canonical reason', () => {
    expect(() =>
      transform(`
        type LegacyOffer @openiapDeprecated(reason: "") {
          id: String
        }
      `),
    ).toThrow('must declare exactly one non-empty string');
  });

  it('fails closed for missing or unknown type-level directive arguments', () => {
    expect(() =>
      transform(`
        type LegacyOffer @openiapDeprecated {
          id: String
        }
      `),
    ).toThrow();

    expect(() =>
      transform(`
        type LegacyOffer @openiapDeprecated(foo: "Use DiscountOffer instead.") {
          id: String
        }
      `),
    ).toThrow();
  });
});

describe('generation marker transformation', () => {
  it('fails closed when a union wrapper has a required field', () => {
    expect(() =>
      transform(
        `
          type Result {
            value: String!
          }
        `,
        ['Result'],
      ),
    ).toThrow('Result # => Union wrapper fields must all be nullable; required: value.');
  });

  it('fails closed when a union wrapper is empty', () => {
    expect(() =>
      transform(
        `
          type Result
        `,
        ['Result'],
      ),
    ).toThrow('Result # => Union wrapper must declare at least one nullable result field.');
  });

  it('fails closed when a union wrapper targets an operation root', () => {
    expect(() =>
      transform(
        `
          type Query {
            value: String
          }
        `,
        ['Query'],
      ),
    ).toThrow('Query cannot use # => Union because operation root types cannot be union wrappers.');
  });
});
