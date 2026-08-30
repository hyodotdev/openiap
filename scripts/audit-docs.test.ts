import { describe, expect, test } from "bun:test";
import {
  auditActiveCodeExampleSource,
  auditCanonicalOfferDocs,
  auditSubscriptionFailureDocs,
  auditVerifyPurchaseDocs,
  type CanonicalOfferDocsSources,
} from "./audit-docs";

describe("subscription failure docs", () => {
  const valid = `
    React Native, Expo, and native promise APIs reject on failure.
    React Native and Expo hooks call <code>onError</code> before rethrowing.
    Godot's compatibility boolean helper still maps failure to{' '}<code>false</code>.
  `;

  test("rejects obsolete React Native false-fallback guidance", () => {
    const source = `${valid}
      React Native's root helper
      and hook map failures to{' '}<code>false</code>`;

    expect(auditSubscriptionFailureDocs("has-active.tsx", source)).toEqual([
      expect.objectContaining({ rule: "R15" }),
    ]);
  });

  test("accepts rejection guidance", () => {
    expect(auditSubscriptionFailureDocs("has-active.tsx", valid)).toEqual([]);
  });

  for (const [name, claim] of [
    [
      "promise rejection guidance",
      "React Native, Expo, and native promise APIs reject on failure.",
    ],
    [
      "hook rejection guidance",
      "React Native and Expo hooks call <code>onError</code> before rethrowing.",
    ],
    [
      "Godot false-fallback guidance",
      "Godot's compatibility boolean helper still maps failure to{' '}<code>false</code>.",
    ],
  ] as const) {
    test(`requires ${name}`, () => {
      expect(
        auditSubscriptionFailureDocs(
          "has-active.tsx",
          valid.replace(claim, ""),
        ),
      ).toEqual([expect.objectContaining({ rule: "R15" })]);
    });
  }
});

describe("verify purchase type docs", () => {
  const valid = `
    <AnchorLink id="verify-purchase-result-ios"><table><tbody><tr><td><code>isValid</code></td></tr></tbody></table></AnchorLink>
    <AnchorLink id="verify-purchase-result-android"><table><tbody><tr><td><code>isValid</code></td></tr></tbody></table></AnchorLink>
    <AnchorLink id="verify-purchase-result-horizon"><table><tbody><tr><td><code>isValid</code></td></tr><tr><td><code>success</code></td><td>Deprecated alias for <code>isValid</code></td></tr></tbody></table></AnchorLink>
  `;
  const generatedTypes = `export interface VerifyPurchaseResultCommon { isValid: boolean; }`;

  test("accepts uniform validity and the deprecated Horizon alias", () => {
    expect(
      auditVerifyPurchaseDocs("verify-purchase.tsx", valid, generatedTypes),
    ).toEqual([]);
  });

  test("rejects a missing Horizon validity field", () => {
    const drifts = auditVerifyPurchaseDocs(
      "verify-purchase.tsx",
      valid.replace(
        "<tr><td><code>isValid</code></td></tr><tr><td><code>success</code>",
        "<tr><td><code>success</code>",
      ),
      generatedTypes,
    );
    expect(drifts.some((drift) => drift.message.includes("Horizon"))).toBe(
      true,
    );
  });

  test("rejects a missing iOS validity field", () => {
    const drifts = auditVerifyPurchaseDocs(
      "verify-purchase.tsx",
      valid.replace("<tr><td><code>isValid</code></td></tr>", ""),
      generatedTypes,
    );
    expect(drifts.some((drift) => drift.message.includes("iOS"))).toBe(true);
  });

  test("rejects duplicate required fields in one result table", () => {
    const duplicate = valid.replace(
      '<AnchorLink id="verify-purchase-result-ios"><table><tbody>',
      '<AnchorLink id="verify-purchase-result-ios"><table><tbody><tr><td><code>isValid</code></td></tr>',
    );

    const drifts = auditVerifyPurchaseDocs(
      "verify-purchase.tsx",
      duplicate,
      generatedTypes,
    );

    expect(drifts.some((drift) => drift.message.includes("iOS"))).toBe(true);
  });

  test("rejects unrelated deprecation prose outside the success row", () => {
    const invalid = valid.replace(
      "<tr><td><code>success</code></td><td>Deprecated alias for <code>isValid</code></td></tr>",
      "<tr><td><code>success</code></td><td>Legacy alias</td></tr><p>Deprecated elsewhere</p>",
    );

    const drifts = auditVerifyPurchaseDocs(
      "verify-purchase.tsx",
      invalid,
      generatedTypes,
    );

    expect(
      drifts.some((drift) =>
        drift.message.includes("deprecated isValid alias"),
      ),
    ).toBe(true);
  });

  test("rejects a deprecated success row without the isValid alias", () => {
    const invalid = valid.replace(
      "Deprecated alias for <code>isValid</code>",
      "Deprecated legacy field",
    );

    const drifts = auditVerifyPurchaseDocs(
      "verify-purchase.tsx",
      invalid,
      generatedTypes,
    );

    expect(
      drifts.some((drift) =>
        drift.message.includes("deprecated isValid alias"),
      ),
    ).toBe(true);
  });

  test("rejects duplicate Horizon success rows", () => {
    const successRow =
      "<tr><td><code>success</code></td><td>Deprecated alias for <code>isValid</code></td></tr>";
    const invalid = valid.replace(successRow, `${successRow}${successRow}`);

    const drifts = auditVerifyPurchaseDocs(
      "verify-purchase.tsx",
      invalid,
      generatedTypes,
    );

    expect(
      drifts.some((drift) =>
        drift.message.includes("deprecated isValid alias"),
      ),
    ).toBe(true);
  });
});

const VALID_GENERATED_OFFER_TYPES = {
  typescript:
    "export type DiscountOfferType = 'introductory' | 'promotional' | 'one-time';",
  swift: `
enum DiscountOfferType: String {
  case introductory = "introductory"
  case promotional = "promotional"
  case oneTime = "one-time"
}`.trim(),
  kotlin: `
enum class DiscountOfferType(val rawValue: String) {
  Introductory("introductory"),
  Promotional("promotional"),
  OneTime("one-time")
}`.trim(),
  dart: `
enum DiscountOfferType {
  Introductory('introductory'),
  Promotional('promotional'),
  OneTime('one-time');
}`.trim(),
} as const;

type OfferTypeLanguage = keyof typeof VALID_GENERATED_OFFER_TYPES;

const offerTypeBlock = (language: OfferTypeLanguage, source: string): string =>
  `<CodeBlock language="${language}">{\`
${source}
\`}</CodeBlock>`;

const offerTypeBlockPattern = (language: OfferTypeLanguage): RegExp =>
  new RegExp(
    `<CodeBlock language="${language}">\\{\\\`[\\s\\S]*?\\\`\\}</CodeBlock>`,
  );

const replaceRequired = (
  source: string,
  search: string | RegExp,
  replacement: string,
): string => {
  const replaced = source.replace(search, replacement);
  if (replaced === source) {
    throw new Error(`Required fixture replacement did not match: ${search}`);
  }
  return replaced;
};

const VALID_DISCOUNT_OFFER_TYPE_BLOCKS = (
  Object.entries(VALID_GENERATED_OFFER_TYPES) as [OfferTypeLanguage, string][]
)
  .map(([language, source]) => offerTypeBlock(language, source))
  .join("\n");

const renderPage = (name: string, body: string): string =>
  `const ${name} = () => (<>${body}</>); export default ${name};`;

describe("active docs code-example audit", () => {
  test("flags recurring cross-language phantom patterns", () => {
    const source = [
      '<CodeBlock language="csharp">{`@Deprecated("old") Task<Boolean> Run()`}</CodeBlock>',
      '<CodeBlock language="dart">{`iap.purchaseUpdatedStream.listen(onPurchase); iap.finishTransaction(purchase);`}</CodeBlock>',
      '<CodeBlock language="swift">{`let store = OpenIapStore.shared; subscription.remove()`}</CodeBlock>',
      '<CodeBlock language="typescript">{`await verifyPurchase({ purchase, serverUrl: url }); await requestPurchase({ sku: "x" });`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`println("Offer token: ${offer.offerToken}")`}</CodeBlock>',
    ].join("\n");

    const drifts = auditActiveCodeExampleSource("/tmp/active.tsx", source);
    expect(drifts.map((drift) => drift.rule)).toEqual([
      "R11",
      "R11",
      "R11",
      "R11",
      "R11",
      "R11",
      "R11",
      "R11",
    ]);
  });

  test("accepts the current listener and purchase shapes", () => {
    const source = [
      '<CodeBlock language="dart">{`iap.purchaseUpdatedListener.listen(onPurchase); await iap.finishTransaction(purchase: purchase);`}</CodeBlock>',
      '<CodeBlock language="typescript">{`await requestPurchase({ request: { apple: { sku: "x" } }, type: "in-app" });`}</CodeBlock>',
    ].join("\n");

    expect(auditActiveCodeExampleSource("/tmp/active.tsx", source)).toEqual([]);
  });

  test("audits formatted multiline CodeBlock children", () => {
    const source = `<CodeBlock language="dart">
      {\`iap.purchaseUpdatedStream.listen(onPurchase);\`}
    </CodeBlock>`;

    expect(auditActiveCodeExampleSource("/tmp/active.tsx", source)).toEqual([
      expect.objectContaining({ rule: "R11", line: 2 }),
    ]);
  });

  test("flags offer-token logging across formatted lines", () => {
    const source = `<CodeBlock language="kotlin">{\`println(
  offer.offerToken
)\`}</CodeBlock>`;

    expect(auditActiveCodeExampleSource("/tmp/active.tsx", source)).toEqual([
      expect.objectContaining({ rule: "R11", line: 1 }),
    ]);
  });

  test("flags a top-level Godot purchase sku", () => {
    const source = `<CodeBlock language="gdscript">{\`var props = Types.RequestPurchaseProps.new()
props.sku = "premium"\`}</CodeBlock>`;

    expect(auditActiveCodeExampleSource("/tmp/active.tsx", source)).toEqual([
      expect.objectContaining({ rule: "R11", line: 1 }),
    ]);
  });

  test("flags obsolete Kotlin and KMP requestPurchase named arguments", () => {
    const source = [
      '<CodeBlock language="kotlin">{`iapStore.requestPurchase(activity = activity, props = request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`kmpIAP.requestPurchase(props = request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`openIapStore.requestPurchase(activity = activity, props = request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`OpenIapStore().requestPurchase(props = request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`stores[0].requestPurchase(props = request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`store./* current instance */requestPurchase(props = request)`}</CodeBlock>',
    ].join("\n");

    expect(auditActiveCodeExampleSource("/tmp/active.tsx", source)).toEqual([
      expect.objectContaining({ rule: "R11" }),
      expect.objectContaining({ rule: "R11" }),
      expect.objectContaining({ rule: "R11" }),
      expect.objectContaining({ rule: "R11" }),
      expect.objectContaining({ rule: "R11" }),
      expect.objectContaining({ rule: "R11" }),
    ]);
  });

  test("accepts current Kotlin and KMP requestPurchase calls", () => {
    const source = [
      '<CodeBlock language="kotlin">{`iapStore.requestPurchase(request)`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`kmpIAP.requestPurchase(RequestPurchaseProps(...))`}</CodeBlock>',
      '<CodeBlock language="kotlin">{`requestPurchase(validLocalProps)`}</CodeBlock>',
    ].join("\n");

    expect(auditActiveCodeExampleSource("/tmp/active.tsx", source)).toEqual([]);
  });
});

const validOfferDocsSources = (
  overrides: {
    discountOffer?: string;
    subscriptionOffer?: string;
    searchData?: string;
    generatedOfferTypes?: Partial<Record<OfferTypeLanguage, string>>;
  } = {},
): CanonicalOfferDocsSources => ({
  discountOffer: {
    file: "/tmp/discount-offer.tsx",
    source: renderPage(
      "DiscountOfferPage",
      overrides.discountOffer ??
        `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${VALID_DISCOUNT_OFFER_TYPE_BLOCKS}`,
    ),
  },
  subscriptionOffer: {
    file: "/tmp/subscription-offer.tsx",
    source: renderPage(
      "SubscriptionOfferPage",
      overrides.subscriptionOffer ??
        "<p>SubscriptionOffer maps to Product.SubscriptionOffer and ProductDetails.SubscriptionOfferDetails.</p>",
    ),
  },
  searchData: {
    file: "/tmp/searchData.ts",
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
  generatedOfferTypes: Object.fromEntries(
    (
      Object.entries(VALID_GENERATED_OFFER_TYPES) as [
        OfferTypeLanguage,
        string,
      ][]
    ).map(([language, source]) => [
      language,
      {
        file: `/tmp/generated-${language}-types`,
        source: overrides.generatedOfferTypes?.[language] ?? source,
      },
    ]),
  ) as CanonicalOfferDocsSources["generatedOfferTypes"],
});

describe("canonical offer docs audit", () => {
  test("accepts canonical one-time, subscription, and search semantics", () => {
    expect(auditCanonicalOfferDocs(validOfferDocsSources())).toEqual([]);
  });

  test("derives TypeScript wire values from the generated SSOT", () => {
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        generatedOfferTypes: {
          typescript:
            "export type DiscountOfferType = 'introductory' | 'promotional' | 'one-time' | 'seasonal';",
        },
      }),
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        rule: "R12",
        message: expect.stringContaining(
          "'introductory', 'promotional', 'one-time', and 'seasonal'",
        ),
      }),
    ]);
  });

  test.each([
    [
      "swift",
      replaceRequired(
        VALID_GENERATED_OFFER_TYPES.swift,
        '  case oneTime = "one-time"',
        '  case oneTime = "one-time"\n  case seasonal = "seasonal"',
      ),
    ],
    [
      "kotlin",
      replaceRequired(
        VALID_GENERATED_OFFER_TYPES.kotlin,
        '  OneTime("one-time")',
        '  OneTime("one-time"),\n  Seasonal("seasonal")',
      ),
    ],
    [
      "dart",
      replaceRequired(
        VALID_GENERATED_OFFER_TYPES.dart,
        "  OneTime('one-time');",
        "  OneTime('one-time'),\n  Seasonal('seasonal');",
      ),
    ],
  ] as const)(
    "derives %s members from the generated SSOT",
    (language, generatedSource) => {
      const drifts = auditCanonicalOfferDocs(
        validOfferDocsSources({
          generatedOfferTypes: {
            [language]: generatedSource,
          },
        }),
      );

      expect(drifts).toEqual([
        expect.objectContaining({
          rule: "R12",
          message: expect.stringContaining(
            `The canonical DiscountOffer ${language} snippet must declare exactly the generated DiscountOfferType members`,
          ),
        }),
      ]);
    },
  );

  test("does not cascade docs errors when the TypeScript SSOT is invalid", () => {
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        generatedOfferTypes: {
          typescript: "export interface NotDiscountOfferType {}",
        },
      }),
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        file: "/tmp/generated-typescript-types",
        rule: "R12",
        message:
          "The generated TypeScript SSOT must declare DiscountOfferType as a string-literal union.",
      }),
    ]);
  });

  test("flags missing one-time Android native semantics", () => {
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        discountOffer: `<p>A generic cross-platform discount.</p>
${VALID_DISCOUNT_OFFER_TYPE_BLOCKS}`,
      }),
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        rule: "R12",
        message: expect.stringContaining("OneTimePurchaseOfferDetails"),
      }),
      expect.objectContaining({
        rule: "R12",
        message: expect.stringContaining("one-time product offers"),
      }),
    ]);
  });

  test("does not accept comments or CodeBlocks as native semantic evidence", () => {
    const decoyBlock = `<CodeBlock language="text">{\`
ProductDetails.OneTimePurchaseOfferDetails
Product.SubscriptionOffer
ProductDetails.SubscriptionOfferDetails
Android one-time
\`}</CodeBlock>`;
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        discountOffer: `<div>
  {/* ProductDetails.OneTimePurchaseOfferDetails; Android one-time */}
  ${decoyBlock}
  ${VALID_DISCOUNT_OFFER_TYPE_BLOCKS}
</div>`,
        subscriptionOffer: `<div>
  {/* Product.SubscriptionOffer and ProductDetails.SubscriptionOfferDetails */}
  ${decoyBlock}
</div>`,
      }),
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        file: "/tmp/discount-offer.tsx",
        message: expect.stringContaining("OneTimePurchaseOfferDetails"),
      }),
      expect.objectContaining({
        file: "/tmp/discount-offer.tsx",
        message: expect.stringContaining("one-time product offers"),
      }),
      expect.objectContaining({
        file: "/tmp/subscription-offer.tsx",
        message: expect.stringContaining("Product.SubscriptionOffer"),
      }),
      expect.objectContaining({
        file: "/tmp/subscription-offer.tsx",
        message: expect.stringContaining(
          "ProductDetails.SubscriptionOfferDetails",
        ),
      }),
    ]);
  });

  test("does not accept unused JSX declarations as rendered semantic evidence", () => {
    const sources = validOfferDocsSources({
      discountOffer: `<p>A generic cross-platform discount.</p>
${VALID_DISCOUNT_OFFER_TYPE_BLOCKS}`,
    });
    sources.discountOffer.source +=
      "\nconst UNUSED_DECOY = <div>ProductDetails.OneTimePurchaseOfferDetails Android one-time product offers</div>;";

    expect(auditCanonicalOfferDocs(sources)).toEqual([
      expect.objectContaining({
        file: "/tmp/discount-offer.tsx",
        message: expect.stringContaining("OneTimePurchaseOfferDetails"),
      }),
      expect.objectContaining({
        file: "/tmp/discount-offer.tsx",
        message: expect.stringContaining("one-time product offers"),
      }),
    ]);
  });

  test("audits prose rendered by local JSX components", () => {
    const sources = validOfferDocsSources({
      discountOffer: `<LocalClaim />
<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${VALID_DISCOUNT_OFFER_TYPE_BLOCKS}`,
    });
    sources.discountOffer.source = `const LocalClaim = () => <p>WinBack is supported.</p>;
${sources.discountOffer.source}`;

    expect(auditCanonicalOfferDocs(sources)).toEqual([
      expect.objectContaining({
        file: "/tmp/discount-offer.tsx",
        rule: "R12",
        message: expect.stringContaining("WinBack"),
      }),
    ]);
  });

  test("ignores forbidden claims that occur only in comments or CodeBlocks", () => {
    const commentsAndExamples = `<div>
  {/* Product.SubscriptionOffer SubscriptionOfferDetails WinBack */}
  <CodeBlock language="text">{\`Product.SubscriptionOffer SubscriptionOfferDetails WinBack\`}</CodeBlock>
</div>`;
    const sources = validOfferDocsSources();

    expect(
      auditCanonicalOfferDocs({
        ...sources,
        discountOffer: {
          ...sources.discountOffer,
          source: `${sources.discountOffer.source}\n${commentsAndExamples}`,
        },
        subscriptionOffer: {
          ...sources.subscriptionOffer,
          source: `${sources.subscriptionOffer.source}\n${commentsAndExamples}`,
        },
      }),
    ).toEqual([]);
  });

  test("flags subscription mappings and invented WinBack claims on DiscountOffer", () => {
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        discountOffer: `<p>Android one-time products use OneTimePurchaseOfferDetails.</p>
<p>Maps to Product.SubscriptionOffer and SubscriptionOfferDetails.</p>
<p>WinBack is supported.</p>
${VALID_DISCOUNT_OFFER_TYPE_BLOCKS}`,
      }),
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        line: 2,
        message: expect.stringContaining("Product.SubscriptionOffer"),
      }),
      expect.objectContaining({
        line: 2,
        message: expect.stringContaining("SubscriptionOfferDetails"),
      }),
      expect.objectContaining({
        line: 3,
        message: expect.stringContaining("WinBack"),
      }),
    ]);
  });

  test("flags an invented WinBack claim on SubscriptionOffer", () => {
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        subscriptionOffer:
          "<p>SubscriptionOffer maps to Product.SubscriptionOffer and ProductDetails.SubscriptionOfferDetails, and includes WinBack.</p>",
      }),
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        rule: "R12",
        line: 1,
        message: expect.stringContaining("WinBack"),
      }),
    ]);
  });

  test("requires both native subscription offer mappings", () => {
    for (const [subscriptionOffer, missingType] of [
      [
        "<p>SubscriptionOffer maps to ProductDetails.SubscriptionOfferDetails.</p>",
        "Product.SubscriptionOffer",
      ],
      [
        "<p>SubscriptionOffer maps to Product.SubscriptionOffer.</p>",
        "ProductDetails.SubscriptionOfferDetails",
      ],
      ["<p>A generic subscription offer.</p>", "Product.SubscriptionOffer"],
    ] as const) {
      const drifts = auditCanonicalOfferDocs(
        validOfferDocsSources({ subscriptionOffer }),
      );

      expect(drifts).toContainEqual(
        expect.objectContaining({
          rule: "R12",
          message: expect.stringContaining(missingType),
        }),
      );
    }
  });

  test("flags incorrect DiscountOfferType wire casing and extra members", () => {
    for (const declaration of [
      "type DiscountOfferType = 'Introductory' | 'Promotional' | 'OneTime';",
      "type DiscountOfferType = 'introductory' | 'promotional' | 'one-time' | 'legacy';",
    ]) {
      const discountOffer = replaceRequired(
        VALID_DISCOUNT_OFFER_TYPE_BLOCKS,
        offerTypeBlockPattern("typescript"),
        offerTypeBlock("typescript", declaration),
      );
      const drifts = auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        }),
      );

      expect(drifts).toEqual([
        expect.objectContaining({
          rule: "R12",
          line: 3,
          message: expect.stringContaining(
            "exactly the generated wire values 'introductory', 'promotional', and 'one-time'",
          ),
        }),
      ]);
    }
  });

  test("accepts a multiline TypeScript union with leading delimiters", () => {
    const discountOffer = replaceRequired(
      VALID_DISCOUNT_OFFER_TYPE_BLOCKS,
      offerTypeBlockPattern("typescript"),
      `<CodeBlock language="typescript">{\`
type DiscountOfferType =
  | 'introductory'
  | 'promotional'
  | 'one-time';
\`}</CodeBlock>`,
    );

    expect(
      auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        }),
      ),
    ).toEqual([]);
  });

  test("accepts a parenthesized TypeScript union", () => {
    const discountOffer = replaceRequired(
      VALID_DISCOUNT_OFFER_TYPE_BLOCKS,
      offerTypeBlockPattern("typescript"),
      `<CodeBlock language="typescript">{\`
type DiscountOfferType = (
  | 'introductory'
  | 'promotional'
  | 'one-time'
);
\`}</CodeBlock>`,
    );

    expect(
      auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        }),
      ),
    ).toEqual([]);
  });

  test("ignores commented TypeScript declarations", () => {
    const discountOffer = replaceRequired(
      VALID_DISCOUNT_OFFER_TYPE_BLOCKS,
      offerTypeBlockPattern("typescript"),
      `<CodeBlock language="typescript">{\`
// type DiscountOfferType = 'introductory' | 'promotional' | 'one-time';
\`}</CodeBlock>`,
    );
    const drifts = auditCanonicalOfferDocs(
      validOfferDocsSources({
        discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
      }),
    );

    expect(drifts).toEqual([
      expect.objectContaining({
        rule: "R12",
        message: expect.stringContaining("TypeScript snippet"),
      }),
    ]);
  });

  test("ignores generated-language enum declarations inside comments and strings", () => {
    for (const language of ["swift", "kotlin", "dart"] as const) {
      const canonical = VALID_GENERATED_OFFER_TYPES[language];
      const stringDecoy =
        language === "swift"
          ? `let decoy = """
${canonical}
"""`
          : language === "kotlin"
            ? `val decoy = """
${canonical}
"""`
            : `const decoy = r'''
${canonical}
''';`;
      const wrongDeclaration = replaceRequired(
        canonical,
        "one-time",
        "OneTime",
      );
      const brokenBlock = offerTypeBlock(
        language,
        `/*
${canonical}
*/
${stringDecoy}
${wrongDeclaration}`,
      );
      const discountOffer = replaceRequired(
        VALID_DISCOUNT_OFFER_TYPE_BLOCKS,
        offerTypeBlockPattern(language),
        brokenBlock,
      );

      expect(
        auditCanonicalOfferDocs(
          validOfferDocsSources({
            discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
          }),
        ),
      ).toEqual([
        expect.objectContaining({
          rule: "R12",
          message: expect.stringContaining(`${language} snippet`),
        }),
      ]);
    }
  });

  test("ignores nested Swift enum declarations when selecting the canonical declaration", () => {
    const canonical = VALID_GENERATED_OFFER_TYPES.swift;
    const wrongDeclaration = replaceRequired(canonical, "one-time", "OneTime");
    const brokenBlock = offerTypeBlock(
      "swift",
      `struct Decoy {
${canonical}
}
${wrongDeclaration}`,
    );
    const discountOffer = replaceRequired(
      VALID_DISCOUNT_OFFER_TYPE_BLOCKS,
      offerTypeBlockPattern("swift"),
      brokenBlock,
    );

    expect(
      auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        rule: "R12",
        message: expect.stringContaining("swift snippet"),
      }),
    ]);
  });

  test("flags incorrect generated-language DiscountOfferType wire values", () => {
    for (const [language, brokenBlock] of [
      [
        "swift",
        `<CodeBlock language="swift">{\`
enum DiscountOfferType: String {
  case introductory = "introductory"
  case promotional = "promotional"
  case oneTime = "OneTime"
}
\`}</CodeBlock>`,
      ],
      [
        "kotlin",
        `<CodeBlock language="kotlin">{\`
enum class DiscountOfferType(val rawValue: String) {
  Introductory("introductory"),
  Promotional("promotional"),
  OneTime("OneTime")
}
\`}</CodeBlock>`,
      ],
      [
        "dart",
        `<CodeBlock language="dart">{\`
enum DiscountOfferType {
  Introductory('introductory'),
  Promotional('promotional'),
  OneTime('OneTime');
}
\`}</CodeBlock>`,
      ],
    ] as const) {
      const discountOffer = replaceRequired(
        VALID_DISCOUNT_OFFER_TYPE_BLOCKS,
        offerTypeBlockPattern(language),
        brokenBlock,
      );
      const drifts = auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        }),
      );

      expect(drifts).toEqual([
        expect.objectContaining({
          rule: "R12",
          message: expect.stringContaining(`${language} snippet`),
        }),
      ]);
    }
  });

  test("flags unmatched extra generated-language enum members", () => {
    for (const [language, brokenBlock] of [
      [
        "swift",
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
        "kotlin",
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
        "dart",
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
      const discountOffer = replaceRequired(
        VALID_DISCOUNT_OFFER_TYPE_BLOCKS,
        offerTypeBlockPattern(language),
        brokenBlock,
      );
      const drifts = auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        }),
      );

      expect(drifts).toEqual([
        expect.objectContaining({
          rule: "R12",
          message: expect.stringContaining(`${language} snippet`),
        }),
      ]);
    }
  });

  test("accepts valid Swift combined cases and Dart double quotes", () => {
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
    const discountOffer = replaceRequired(
      replaceRequired(
        VALID_DISCOUNT_OFFER_TYPE_BLOCKS,
        offerTypeBlockPattern("swift"),
        swiftCombined,
      ),
      offerTypeBlockPattern("dart"),
      dartDoubleQuoted,
    );

    expect(
      auditCanonicalOfferDocs(
        validOfferDocsSources({
          discountOffer: `<p>DiscountOffer represents one-time products on Android via ProductDetails.OneTimePurchaseOfferDetails.</p>
${discountOffer}`,
        }),
      ),
    ).toEqual([]);
  });

  test("flags legacy native search routes and missing canonical entries", () => {
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
      validOfferDocsSources({ searchData: legacySearchData }),
    );

    expect(wrongRouteDrifts).toEqual([
      expect.objectContaining({
        line: 4,
        message: expect.stringContaining("/docs/types/discount-offer"),
      }),
      expect.objectContaining({
        line: 8,
        message: expect.stringContaining("/docs/types/subscription-offer"),
      }),
    ]);

    const missingEntryDrifts = auditCanonicalOfferDocs(
      validOfferDocsSources({ searchData: "export const apiData = [];" }),
    );
    expect(missingEntryDrifts).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("canonical DiscountOffer entry"),
      }),
      expect.objectContaining({
        message: expect.stringContaining("canonical SubscriptionOffer entry"),
      }),
    ]);
  });

  test("ignores commented search entries and path-like description strings", () => {
    const commentedEntries = `export const apiData = [];
// { title: 'DiscountOffer', path: '/docs/types/discount-offer' }
/* { title: 'SubscriptionOffer', path: '/docs/types/subscription-offer' } */`;
    const commentedDrifts = auditCanonicalOfferDocs(
      validOfferDocsSources({ searchData: commentedEntries }),
    );
    expect(commentedDrifts).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("canonical DiscountOffer entry"),
      }),
      expect.objectContaining({
        message: expect.stringContaining("canonical SubscriptionOffer entry"),
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
      validOfferDocsSources({ searchData: misleadingDescriptions }),
    );
    expect(pathDrifts).toEqual([
      expect.objectContaining({
        line: 5,
        message: expect.stringContaining("/wrong-discount-path"),
      }),
      expect.objectContaining({
        line: 10,
        message: expect.stringContaining("/wrong-subscription-path"),
      }),
    ]);
  });

  test("finds canonical search paths across indentation and nested formatting", () => {
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
        validOfferDocsSources({ searchData: reformattedSearchData }),
      ),
    ).toEqual([]);
  });

  test("accepts parenthesized and typed apiData array initializers", () => {
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
        auditCanonicalOfferDocs(validOfferDocsSources({ searchData })),
      ).toEqual([]);
    }
  });

  test("accepts wrapped apiData elements and string properties", () => {
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
      auditCanonicalOfferDocs(validOfferDocsSources({ searchData })),
    ).toEqual([]);
  });

  test("ignores nested apiData shadow declarations", () => {
    const searchData = `export const apiData = [
  { title: 'DiscountOffer', path: '/docs/types/discount-offer' },
  { title: 'SubscriptionOffer', path: '/docs/types/subscription-offer' },
];
function shadow() {
  const apiData = [];
  return apiData;
}`;

    expect(
      auditCanonicalOfferDocs(validOfferDocsSources({ searchData })),
    ).toEqual([]);
  });

  test("parses search entries after nested template literals", () => {
    const searchData = [
      "export const apiData = [",
      "  {",
      "    title: 'DiscountOffer',",
      "    description: `outer ${`}`}`,",
      "    path: '/docs/types/discount-offer',",
      "  },",
      "  {",
      "    title: 'SubscriptionOffer',",
      "    description: `outer ${`}`}`,",
      "    path: '/docs/types/subscription-offer',",
      "  },",
      "];",
    ].join("\n");

    expect(
      auditCanonicalOfferDocs(validOfferDocsSources({ searchData })),
    ).toEqual([]);
  });

  test("ignores braces inside search strings and comments", () => {
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
        auditCanonicalOfferDocs(validOfferDocsSources({ searchData })),
      ).toEqual([]);
    }
  });
});
