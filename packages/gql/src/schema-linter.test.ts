import { afterEach, describe, expect, test } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSchema, SchemaParser } from '../codegen/core/parser.js';
import { lintSchema } from '../codegen/core/schema-linter.js';
import type { LintResult } from '../codegen/core/schema-linter.js';

const temporaryDirectories: string[] = [];

function lintSchemaSource(source: string, fileName = 'schema.graphql'): LintResult[] {
  return lintSchemaSources({ [fileName]: source });
}

function lintSchemaSources(sources: Record<string, string>): LintResult[] {
  const directory = mkdtempSync(join(tmpdir(), 'openiap-schema-linter-'));
  temporaryDirectories.push(directory);
  const schemaPaths = Object.entries(sources).map(([fileName, source], index) => {
    const schemaPath = join(directory, fileName);
    writeFileSync(
      schemaPath,
      `${source}${index === 0 ? '\ndirective @openiapDeprecated(reason: String!) on OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT\n' : ''}`,
    );
    return schemaPath;
  });

  const parsedSchema = new SchemaParser({
    schemaPaths,
  }).parse();
  return lintSchema(parsedSchema);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('GraphQL Future marker lint', () => {
  test('keeps the repository schema free of lint errors', () => {
    expect(lintSchema(parseSchema()).filter((finding) => finding.level === 'error')).toEqual([]);
  });

  test('requires Future markers on Query and Mutation fields', () => {
    const findings = lintSchemaSource(`
type Query {
  missingQuery: String!
}

type Mutation {
  missingMutation(
    value: String!
  ): Boolean!
}
`);

    expect(findings.filter((finding) => finding.rule === 'future-marker-required')).toEqual([
      expect.objectContaining({
        level: 'error',
        file: 'schema.graphql',
        line: 3,
        message: 'Async operation "Query.missingQuery" must be preceded by "# Future"',
      }),
      expect.objectContaining({
        level: 'error',
        file: 'schema.graphql',
        line: 7,
        message: 'Async operation "Mutation.missingMutation" must be preceded by "# Future"',
      }),
    ]);
  });

  test('accepts marked operations and ignores root placeholders', () => {
    const findings = lintSchemaSource(`
type Query {
  _placeholder: Boolean
  # Future
  fetchProducts: String!
}

type Mutation {
  _placeholder: Boolean
  # Future
  requestPurchase: Boolean!
}
`);

    expect(findings.filter((finding) => finding.rule === 'future-marker-required')).toEqual([]);
  });

  test('does not require Future markers on Subscription fields', () => {
    const findings = lintSchemaSource(`
type Query {
  _placeholder: Boolean
}

type Mutation {
  _placeholder: Boolean
}

type Subscription {
  purchaseUpdated: String!
}
`);

    expect(findings.filter((finding) => finding.rule === 'future-marker-required')).toEqual([]);
  });

  test('rejects Future markers on root placeholders', () => {
    const findings = lintSchemaSource(`
type Query {
  # Future
  _placeholder: Boolean
}
`);

    expect(findings.filter((finding) => finding.rule === 'future-marker-target')).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 3,
        message: '"# Future" targets Query._placeholder; placeholder fields cannot carry generation markers',
      }),
    ]);
  });

  test('reports invalid marker targets through the shared parser', () => {
    const findings = lintSchemaSource(`
type Query {
  _placeholder: Boolean
}

input Filter {
  # Future
  value: String
}

# => Union
enum ResultMode {
  SUCCESS
}
`);

    expect(findings.filter((finding) => ['future-marker-target', 'union-marker-target'].includes(finding.rule))).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 7,
        message: '"# Future" targets Filter.value; only Query and Mutation fields may be asynchronous',
        rule: 'future-marker-target',
      }),
      expect.objectContaining({
        level: 'error',
        line: 11,
        message: '"# => Union" is not followed by a valid object type definition',
        rule: 'union-marker-target',
      }),
    ]);
  });

  test('strict parsing rejects duplicate operation fields across files', () => {
    expect(() =>
      lintSchemaSources({
        'base.graphql': `
type Query {
  # Future
  value: String
}
`,
        'extension.graphql': `
extend type Query {
  value: String
}
`,
      }),
    ).toThrow('Field "Query.value" can only be defined once');
  });
});

describe('GraphQL deprecation documentation lint', () => {
  test('rejects legacy comment-only deprecation markers', () => {
    const findings = lintSchemaSource(`
enum LegacyMode {
  # @deprecated Use MODERN instead.
  LEGACY
  MODERN
}
`);

    expect(findings.filter((finding) => finding.rule === 'deprecated-comment-legacy')).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 3,
        message: 'Legacy "# @deprecated" comments are not canonical; use a GraphQL deprecation directive',
      }),
    ]);
  });

  test('requires a directive for canonical deprecation guidance', () => {
    const findings = lintSchemaSource(`
"""
Legacy offer.
@deprecated Use DiscountOffer instead.
"""
type LegacyOffer {
  id: String
}
`);

    expect(findings.filter((finding) => finding.rule === 'deprecated-directive-missing')).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 2,
        message:
          'ObjectTypeDefinition "LegacyOffer" declares @deprecated guidance only in its description; move the canonical reason to a directive',
      }),
    ]);
  });

  test('rejects descriptions that duplicate directive-owned guidance', () => {
    const findings = lintSchemaSource(`
"""
Legacy offer.
@deprecated Manual duplicate.
"""
type LegacyOffer @openiapDeprecated(reason: "Use DiscountOffer instead.") {
  """
  Legacy identifier.
  @deprecated Manual duplicate.
  """
  legacyId: String @deprecated(reason: "Use id instead.")
}
`);

    expect(findings.filter((finding) => finding.rule === 'deprecated-description-duplicate')).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 2,
        message: 'ObjectTypeDefinition "LegacyOffer" duplicates directive-owned @deprecated guidance in its description',
      }),
      expect.objectContaining({
        level: 'error',
        line: 7,
        message: 'FieldDefinition "LegacyOffer.legacyId" duplicates directive-owned @deprecated guidance in its description',
      }),
    ]);
  });

  test('rejects empty canonical reasons', () => {
    const findings = lintSchemaSource(`
type LegacyOffer @openiapDeprecated(reason: "") {
  legacyId: String @deprecated(reason: "")
}
`);

    expect(findings.filter((finding) => finding.rule === 'deprecated-reason-invalid')).toEqual([
      expect.objectContaining({
        level: 'error',
        message:
          'ObjectTypeDefinition "LegacyOffer" must declare exactly one non-empty string @openiapDeprecated reason and no other arguments',
      }),
      expect.objectContaining({
        level: 'error',
        message:
          'FieldDefinition "LegacyOffer.legacyId" must declare exactly one non-empty string @deprecated reason and no other arguments',
      }),
    ]);
  });

  test('strict parsing rejects missing and unknown directive arguments', () => {
    expect(() =>
      lintSchemaSource(`
type LegacyOffer @openiapDeprecated {
  legacyId: String @deprecated(foo: "Use id instead.")
}
`),
    ).toThrow();
  });

  test('strict parsing rejects type-level directive ownership split across files', () => {
    expect(() =>
      lintSchemaSources({
        'base.graphql': `
type LegacyOffer @openiapDeprecated(reason: "Use DiscountOffer instead.") {
  id: String
}
`,
        'extension.graphql': `
extend type LegacyOffer @openiapDeprecated(reason: "Duplicate ownership.") {
  legacyId: String
}
`,
      }),
    ).toThrow('The directive "@openiapDeprecated" can only be used once at this location');
  });
});

describe('GraphQL platform field suffix lint', () => {
  test('checks every named definition in platform schema files', () => {
    const findings = lintSchemaSource(
      `
input WrongInput {
  value: String
}

enum WrongEnum {
  One
}

input WrongIos {
  value: String
}
`,
      'type-ios.graphql',
    );

    expect(findings.filter((finding) => finding.rule === 'ios-type-suffix')).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 2,
        message: 'Type "WrongInput" in iOS file should end with "IOS" suffix',
      }),
      expect.objectContaining({
        level: 'error',
        line: 6,
        message: 'Type "WrongEnum" in iOS file should end with "IOS" suffix',
      }),
      expect.objectContaining({
        level: 'error',
        line: 10,
        message: 'Type "WrongIos" in iOS file should end with "IOS" suffix',
      }),
    ]);
  });

  test('treats missing Android type suffixes as errors', () => {
    const findings = lintSchemaSource(
      `
input WrongInput {
  value: String
}
`,
      'type-android.graphql',
    );

    expect(findings.filter((finding) => finding.rule === 'android-type-suffix')).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 2,
        message: 'Type "WrongInput" in Android file should end with "Android" suffix',
      }),
    ]);
  });

  test('accepts root operation names and exact platform naming exceptions', () => {
    const findings = lintSchemaSource(
      `
type Query { _placeholder: Boolean }
type Mutation { _placeholder: Boolean }
type Subscription { event: String }
input RequestPurchaseIosProps { sku: String }
input VerifyPurchaseAppleOptions { sku: String }
enum ExternalPurchaseNoticeAction { Continue }
`,
      'type-ios.graphql',
    );

    expect(findings.filter((finding) => finding.rule === 'ios-type-suffix')).toEqual([]);
  });

  test('rejects a union marker before an operation root extension', () => {
    const findings = lintSchemaSource(`
type Query { _placeholder: Boolean }

# => Union
extend type Query {
  # Future
  wrapped: String
}
`);

    expect(findings.filter((finding) => finding.rule === 'union-marker-target')).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 4,
        message: '"# => Union" targets Query; operation root types cannot be union wrappers',
        rule: 'union-marker-target',
      }),
    ]);
  });

  test('requires a suffix when a common type references an Android type', () => {
    const findings = lintSchemaSource(`
enum SubResponseCodeAndroid {
  None
}

type PurchaseError {
  subResponseCode: SubResponseCodeAndroid
}
`);

    expect(findings.filter((finding) => finding.rule === 'platform-field-suffix')).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 7,
        message:
          'Field "PurchaseError.subResponseCode" references platform-specific type "SubResponseCodeAndroid" and must end with "Android"',
      }),
    ]);
  });

  test('accepts suffixed common fields and platform-scoped parent types', () => {
    const findings = lintSchemaSource(`
enum SubResponseCodeAndroid {
  None
}

type PurchaseError {
  subResponseCodeAndroid: SubResponseCodeAndroid
}

type BillingResultAndroid {
  subResponseCode: SubResponseCodeAndroid
}
`);

    expect(findings.filter((finding) => finding.rule === 'platform-field-suffix')).toEqual([]);
  });

  test('classifies platform type-name exceptions consistently', () => {
    const findings = lintSchemaSource(`
type VerifyPurchaseResultHorizon {
  ok: Boolean
}

type AppTransaction {
  id: String
}

type Container {
  horizonResult: VerifyPurchaseResultHorizon
  appTransaction: AppTransaction
}
`);

    expect(findings.filter((finding) => finding.rule === 'platform-field-suffix')).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 11,
        message:
          'Field "Container.horizonResult" references platform-specific type "VerifyPurchaseResultHorizon" and must end with "Android"',
      }),
      expect.objectContaining({
        level: 'error',
        line: 12,
        message: 'Field "Container.appTransaction" references platform-specific type "AppTransaction" and must end with "IOS"',
      }),
    ]);
  });

  test('checks platform-specific operation arguments', () => {
    const findings = lintSchemaSource(`
input LaunchExternalLinkParamsAndroid {
  url: String!
}

type Mutation {
  # Future
  launchExternalLink(params: LaunchExternalLinkParamsAndroid!): Boolean!
}
`);

    expect(findings.filter((finding) => finding.rule === 'platform-field-suffix')).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 8,
        message:
          'Field "Mutation.launchExternalLink" references platform-specific type "LaunchExternalLinkParamsAndroid" and must end with "Android"',
      }),
    ]);
  });
});
