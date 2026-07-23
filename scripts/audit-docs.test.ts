import { describe, expect, test } from 'bun:test';
import {
  auditActiveCodeExampleSource,
  auditCanonicalOfferDocs,
  extractBraceBlock,
  type CanonicalOfferDocsSources,
} from './audit-docs';

const VALID_DISCOUNT_OFFER_TYPE_BLOCKS = `<CodeBlock language="typescript">{\`
type DiscountOfferType = 'introductory' | 'promotional' | 'one-time';
\`}</CodeBlock>
<CodeBlock language="swift">{\`
enum DiscountOfferType: String {
  case introductory = "introductory"
  case promotional = "promotional"
  case oneTime = "one-time"
}
\`}</CodeBlock>
<CodeBlock language="kotlin">{\`
enum class DiscountOfferType(val rawValue: String) {
  Introductory("introductory"),
  Promotional("promotional"),
  OneTime("one-time")
}
\`}</CodeBlock>
<CodeBlock language="dart">{\`
enum DiscountOfferType {
  Introductory('introductory'),
  Promotional('promotional'),
  OneTime('one-time');
}
\`}</CodeBlock>`;

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

  test('flags obsolete Kotlin and KMP requestPurchase named arguments', () => {
    const source = [
      '<CodeBlock language="kotlin">{`iapStore.requestPurchase(activity = activity, props = request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`kmpIAP.requestPurchase(props = request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`openIapStore.requestPurchase(activity = activity, props = request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`OpenIapStore().requestPurchase(props = request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`stores[0].requestPurchase(props = request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`store./* current instance */requestPurchase(props = request)`}</CodeBlock>',
    ].join('\n');

    expect(auditActiveCodeExampleSource('/tmp/active.tsx', source)).toEqual([
      expect.objectContaining({ rule: 'R11' }),
      expect.objectContaining({ rule: 'R11' }),
      expect.objectContaining({ rule: 'R11' }),
      expect.objectContaining({ rule: 'R11' }),
      expect.objectContaining({ rule: 'R11' }),
      expect.objectContaining({ rule: 'R11' }),
    ]);
  });

  test('accepts current Kotlin and KMP requestPurchase calls', () => {
    const source = [
      '<CodeBlock language="kotlin">{`iapStore.requestPurchase(request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`kmpIAP.requestPurchase(RequestPurchaseProps(...))`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`requestPurchase(props = validLocalProps)`}</CodeBlock>',
    ].join('\n');

    expect(auditActiveCodeExampleSource('/tmp/active.tsx', source)).toEqual([]);
  });
});

describe('brace-block parsing', () => {
  test('handles nested template literals without closing the object early', () => {
    const source = '{ description: `outer ${`}`}`, path: true }';

    expect(extractBraceBlock(source, 0)).toBe(
      ' description: `outer ${`}`}`, path: true '
    );
  });
});

const validOfferDocsSources = (
  overrides: Partial<Record<keyof CanonicalOfferDocsSources, string>> = {}
): CanonicalOfferDocsSources => ({
  discountOffer: {
    file: '/tmp/discount-offer.tsx',
    source:
      overrides.discountOffer ??
      `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${VALID_DISCOUNT_OFFER_TYPE_BLOCKS}`,
  },
  subscriptionOffer: {
    file: '/tmp/subscription-offer.tsx',
    source:
      overrides.subscriptionOffer ??
      '<p>SubscriptionOffer maps to Product.SubscriptionOffer and ProductDetails.SubscriptionOfferDetails.</p>',
  },
  searchData: {
    file: '/tmp/searchData.ts',
    source:
      overrides.searchData ??
      `export const apiData = [
  {
    id: 'discount-offer',
    title: 'DiscountOffer',
    category: 'Types',
    path: '/docs/types/discount-offer',
  },
  {
    id: 'subscription-offer',
    title: 'SubscriptionOffer',
    category: 'Types',
    path: '/docs/types/subscription-offer',
  },
];`,
  },
});

describe('canonical offer docs audit', () => {
  test('accepts canonical one-time, subscription, and search semantics', () => {
    expect(auditCanonicalOfferDocs(validOfferDocsSources())).toEqual([]);
  });

  test('flags missing one-time Android native semantics', () => {
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        discountOffer: `<p>A generic cross-platform discount.</p>
${VALID_DISCOUNT_OFFER_TYPE_BLOCKS}`,
      })
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        rule: 'R12',
        message: expect.stringContaining('OneTimePurchaseOfferDetails'),
      }),
      expect.objectContaining({
        rule: 'R12',
        message: expect.stringContaining('one-time product offers'),
      }),
    ]);
  });

  test('flags subscription mappings and invented WinBack claims on DiscountOffer', () => {
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        discountOffer: `<p>Android one-time products use OneTimePurchaseOfferDetails.</p>
<p>Maps to Product.SubscriptionOffer and SubscriptionOfferDetails.</p>
<p>WinBack is supported.</p>
${VALID_DISCOUNT_OFFER_TYPE_BLOCKS}`,
      })
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        line: 2,
        message: expect.stringContaining('Product.SubscriptionOffer'),
      }),
      expect.objectContaining({
        line: 2,
        message: expect.stringContaining('SubscriptionOfferDetails'),
      }),
      expect.objectContaining({
        line: 3,
        message: expect.stringContaining('WinBack'),
      }),
    ]);
  });

  test('flags an invented WinBack claim on SubscriptionOffer', () => {
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        subscriptionOffer:
          '<p>SubscriptionOffer maps to Product.SubscriptionOffer and ProductDetails.SubscriptionOfferDetails, and includes WinBack.</p>',
      })
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        rule: 'R12',
        line: 1,
        message: expect.stringContaining('WinBack'),
      }),
    ]);
  });

  test('requires both native subscription offer mappings', () => {
    for (const [subscriptionOffer, missingType] of [
      [
        '<p>SubscriptionOffer maps to ProductDetails.SubscriptionOfferDetails.</p>',
        'Product.SubscriptionOffer',
      ],
      [
        '<p>SubscriptionOffer maps to Product.SubscriptionOffer.</p>',
        'ProductDetails.SubscriptionOfferDetails',
      ],
      ['<p>A generic subscription offer.</p>', 'Product.SubscriptionOffer'],
    ] as const) {
      const drifts = auditCanonicalOfferDocs(
        validOfferDocsSources({ subscriptionOffer })
      );

      expect(drifts).toContainEqual(
        expect.objectContaining({
          rule: 'R12',
          message: expect.stringContaining(missingType),
        })
      );
    }
  });

  test('flags incorrect DiscountOfferType wire casing and extra members', () => {
    for (const declaration of [
      "type DiscountOfferType = 'Introductory' | 'Promotional' | 'OneTime';",
      "type DiscountOfferType = 'introductory' | 'promotional' | 'one-time' | 'legacy';",
    ]) {
      const discountOffer = VALID_DISCOUNT_OFFER_TYPE_BLOCKS.replace(
        /<CodeBlock language="typescript">\{`[\s\S]*?`}<\/CodeBlock>/,
        `<CodeBlock language="typescript">{\`
${declaration}
\`}</CodeBlock>`
      );
      const drifts = auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        })
      );

      expect(drifts).toEqual([
        expect.objectContaining({
          rule: 'R12',
          line: 3,
          message: expect.stringContaining(
            "exactly the generated wire values 'introductory', 'promotional', and 'one-time'"
          ),
        }),
      ]);
    }
  });

  test('accepts a multiline TypeScript union with leading delimiters', () => {
    const discountOffer = VALID_DISCOUNT_OFFER_TYPE_BLOCKS.replace(
      /<CodeBlock language="typescript">\{`[\s\S]*?`}<\/CodeBlock>/,
      `<CodeBlock language="typescript">{\`
type DiscountOfferType =
  | 'introductory'
  | 'promotional'
  | 'one-time';
\`}</CodeBlock>`
    );

    expect(
      auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        })
      )
    ).toEqual([]);
  });

  test('accepts a parenthesized TypeScript union', () => {
    const discountOffer = VALID_DISCOUNT_OFFER_TYPE_BLOCKS.replace(
      /<CodeBlock language="typescript">\{`[\s\S]*?`}<\/CodeBlock>/,
      `<CodeBlock language="typescript">{\`
type DiscountOfferType = (
  | 'introductory'
  | 'promotional'
  | 'one-time'
);
\`}</CodeBlock>`
    );

    expect(
      auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        })
      )
    ).toEqual([]);
  });

  test('ignores commented TypeScript declarations', () => {
    const discountOffer = VALID_DISCOUNT_OFFER_TYPE_BLOCKS.replace(
      /<CodeBlock language="typescript">\{`[\s\S]*?`}<\/CodeBlock>/,
      `<CodeBlock language="typescript">{\`
// type DiscountOfferType = 'introductory' | 'promotional' | 'one-time';
\`}</CodeBlock>`
    );
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
      })
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        rule: 'R12',
        message: expect.stringContaining('TypeScript snippet'),
      }),
    ]);
  });

  test('flags incorrect generated-language DiscountOfferType wire values', () => {
    for (const [language, brokenBlock] of [
      [
        'swift',
        `<CodeBlock language="swift">{\`
enum DiscountOfferType: String {
  case introductory = "introductory"
  case promotional = "promotional"
  case oneTime = "OneTime"
}
\`}</CodeBlock>`,
      ],
      [
        'kotlin',
        `<CodeBlock language="kotlin">{\`
enum class DiscountOfferType(val rawValue: String) {
  Introductory("introductory"),
  Promotional("promotional"),
  OneTime("OneTime")
}
\`}</CodeBlock>`,
      ],
      [
        'dart',
        `<CodeBlock language="dart">{\`
enum DiscountOfferType {
  Introductory('introductory'),
  Promotional('promotional'),
  OneTime('OneTime');
}
\`}</CodeBlock>`,
      ],
    ] as const) {
      const discountOffer = VALID_DISCOUNT_OFFER_TYPE_BLOCKS.replace(
        new RegExp(
          `<CodeBlock language="${language}">\\{\\\`[\\s\\S]*?\\\`\\}</CodeBlock>`
        ),
        brokenBlock
      );
      const drifts = auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        })
      );

      expect(drifts).toEqual([
        expect.objectContaining({
          rule: 'R12',
          message: expect.stringContaining(`${language} snippet`),
        }),
      ]);
    }
  });

  test('flags unmatched extra generated-language enum members', () => {
    for (const [language, brokenBlock] of [
      [
        'swift',
        `<CodeBlock language="swift">{\`
enum DiscountOfferType: String {
  case introductory = "introductory"
  case promotional = "promotional"
  case oneTime = "one-time",
       legacy = "legacy"
}
\`}</CodeBlock>`,
      ],
      [
        'kotlin',
        `<CodeBlock language="kotlin">{\`
enum class DiscountOfferType(val rawValue: String) {
  Introductory("introductory"),
  Promotional("promotional"),
  OneTime("one-time"),
  Legacy
}
\`}</CodeBlock>`,
      ],
      [
        'dart',
        `<CodeBlock language="dart">{\`
enum DiscountOfferType {
  Introductory('introductory'),
  Promotional('promotional'),
  OneTime('one-time'),
  Legacy("legacy");
}
\`}</CodeBlock>`,
      ],
    ] as const) {
      const discountOffer = VALID_DISCOUNT_OFFER_TYPE_BLOCKS.replace(
        new RegExp(
          `<CodeBlock language="${language}">\\{\\\`[\\s\\S]*?\\\`\\}</CodeBlock>`
        ),
        brokenBlock
      );
      const drifts = auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        })
      );

      expect(drifts).toEqual([
        expect.objectContaining({
          rule: 'R12',
          message: expect.stringContaining(`${language} snippet`),
        }),
      ]);
    }
  });

  test('accepts valid Swift combined cases and Dart double quotes', () => {
    const swiftCombined = `<CodeBlock language="swift">{\`
enum DiscountOfferType: String {
  case introductory = "introductory",
       promotional = "promotional",
       oneTime = "one-time"
}
\`}</CodeBlock>`;
    const dartDoubleQuoted = `<CodeBlock language="dart">{\`
enum DiscountOfferType {
  Introductory("introductory"),
  Promotional("promotional"),
  OneTime("one-time");
}
\`}</CodeBlock>`;
    const discountOffer = VALID_DISCOUNT_OFFER_TYPE_BLOCKS.replace(
      /<CodeBlock language="swift">\{`[\s\S]*?`}<\/CodeBlock>/,
      swiftCombined
    ).replace(
      /<CodeBlock language="dart">\{`[\s\S]*?`}<\/CodeBlock>/,
      dartDoubleQuoted
    );

    expect(
      auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        })
      )
    ).toEqual([]);
  });

  test('flags legacy native search routes and missing canonical entries', () => {
    const legacySearchData = `export const apiData = [
  {
    title: 'DiscountOffer',
    path: '/docs/types/ios/discount-offer-ios',
  },
  {
    title: 'SubscriptionOffer',
    path: '/docs/types/android/subscription-offer-android',
  },
];`;
    const wrongRouteDrifts = auditCanonicalOfferDocs(
      validOfferDocsSources({ searchData: legacySearchData })
    );

    expect(wrongRouteDrifts).toEqual([
      expect.objectContaining({
        line: 4,
        message: expect.stringContaining('/docs/types/discount-offer'),
      }),
      expect.objectContaining({
        line: 8,
        message: expect.stringContaining('/docs/types/subscription-offer'),
      }),
    ]);

    const missingEntryDrifts = auditCanonicalOfferDocs(
      validOfferDocsSources({ searchData: 'export const apiData = [];' })
    );
    expect(missingEntryDrifts).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('canonical DiscountOffer entry'),
      }),
      expect.objectContaining({
        message: expect.stringContaining('canonical SubscriptionOffer entry'),
      }),
    ]);
  });

  test('ignores commented search entries and path-like description strings', () => {
    const commentedEntries = `export const apiData = [];
// { title: 'DiscountOffer', path: '/docs/types/discount-offer' }
/* { title: 'SubscriptionOffer', path: '/docs/types/subscription-offer' } */`;
    const commentedDrifts = auditCanonicalOfferDocs(
      validOfferDocsSources({ searchData: commentedEntries })
    );
    expect(commentedDrifts).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('canonical DiscountOffer entry'),
      }),
      expect.objectContaining({
        message: expect.stringContaining('canonical SubscriptionOffer entry'),
      }),
    ]);

    const misleadingDescriptions = `export const apiData = [
  {
    title: 'DiscountOffer',
    description: "path: '/docs/types/discount-offer'",
    path: '/wrong-discount-path',
  },
  {
    title: 'SubscriptionOffer',
    description: "path: '/docs/types/subscription-offer'",
    path: '/wrong-subscription-path',
  },
];`;
    const pathDrifts = auditCanonicalOfferDocs(
      validOfferDocsSources({ searchData: misleadingDescriptions })
    );
    expect(pathDrifts).toEqual([
      expect.objectContaining({
        line: 5,
        message: expect.stringContaining('/wrong-discount-path'),
      }),
      expect.objectContaining({
        line: 10,
        message: expect.stringContaining('/wrong-subscription-path'),
      }),
    ]);
  });

  test('finds canonical search paths across indentation and nested formatting', () => {
    const reformattedSearchData = `export const apiData = [
\t{
\t\tmetadata: {
\t\t\tpath: '/internal/discount-offer-metadata',
\t\t},
\t\ttitle: 'DiscountOffer',
\t\tpath: '/docs/types/discount-offer',
\t},
    { metadata: { path: '/internal/subscription-offer-metadata' }, title: 'SubscriptionOffer', path: '/docs/types/subscription-offer' },
];`;

    expect(
      auditCanonicalOfferDocs(
        validOfferDocsSources({ searchData: reformattedSearchData })
      )
    ).toEqual([]);
  });

  test('accepts parenthesized and typed apiData array initializers', () => {
    const entries = `[
  { title: 'DiscountOffer', path: '/docs/types/discount-offer' },
  { title: 'SubscriptionOffer', path: '/docs/types/subscription-offer' },
]`;
    for (const searchData of [
      `export const apiData = (${entries});`,
      `export const apiData = ${entries} as const;`,
      `export const apiData = ${entries} satisfies readonly SearchItem[];`,
    ]) {
      expect(
        auditCanonicalOfferDocs(validOfferDocsSources({ searchData }))
      ).toEqual([]);
    }
  });

  test('accepts wrapped apiData elements and string properties', () => {
    const searchData = `export const apiData = [
  ({
    title: ('DiscountOffer' as const),
    path: '/docs/types/discount-offer' as const,
  }),
  ({
    title: 'SubscriptionOffer' as const,
    path: ('/docs/types/subscription-offer'),
  } as const),
];`;

    expect(
      auditCanonicalOfferDocs(validOfferDocsSources({ searchData }))
    ).toEqual([]);
  });

  test('ignores nested apiData shadow declarations', () => {
    const searchData = `export const apiData = [
  { title: 'DiscountOffer', path: '/docs/types/discount-offer' },
  { title: 'SubscriptionOffer', path: '/docs/types/subscription-offer' },
];
function shadow() {
  const apiData = [];
  return apiData;
}`;

    expect(
      auditCanonicalOfferDocs(validOfferDocsSources({ searchData }))
    ).toEqual([]);
  });

  test('parses search entries after nested template literals', () => {
    const searchData = [
      'export const apiData = [',
      '  {',
      "    title: 'DiscountOffer',",
      '    description: `outer ${`}`}`,',
      "    path: '/docs/types/discount-offer',",
      '  },',
      '  {',
      "    title: 'SubscriptionOffer',",
      '    description: `outer ${`}`}`,',
      "    path: '/docs/types/subscription-offer',",
      '  },',
      '];',
    ].join('\n');

    expect(
      auditCanonicalOfferDocs(validOfferDocsSources({ searchData }))
    ).toEqual([]);
  });

  test('ignores braces inside search strings and comments', () => {
    const edgeCases = [
      `export const apiData = [
  {
    title: 'DiscountOffer',
    description: 'Placeholder {value',
    path: '/docs/types/discount-offer',
  },
  {
    title: 'SubscriptionOffer',
    description: "Quoted } delimiter",
    path: '/docs/types/subscription-offer',
  },
];`,
      `export const apiData = [
  {
    title: 'DiscountOffer',
    // Ignore an unmatched {
    path: '/docs/types/discount-offer',
  },
  {
    title: 'SubscriptionOffer',
    // Ignore an unmatched }
    path: '/docs/types/subscription-offer',
  },
];`,
      `export const apiData = [
  {
    title: 'DiscountOffer',
    /* Ignore an unmatched { */
    path: '/docs/types/discount-offer',
  },
  {
    title: 'SubscriptionOffer',
    /* Ignore an unmatched } */
    path: '/docs/types/subscription-offer',
  },
];`,
    ];

    for (const searchData of edgeCases) {
      expect(
        auditCanonicalOfferDocs(validOfferDocsSources({ searchData }))
      ).toEqual([]);
    }
  });
});
