import { afterEach, describe, expect, test } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSchema, SchemaParser } from '../codegen/core/parser.js';
import { lintSchema } from '../codegen/core/schema-linter.js';
import type { LintResult } from '../codegen/core/schema-linter.js';

const temporaryDirectories: string[] = [];

function lintSchemaSource(
  source: string,
  fileName = 'schema.graphql',
): LintResult[] {
  const directory = mkdtempSync(join(tmpdir(), 'openiap-schema-linter-'));
  const schemaPath = join(directory, fileName);
  temporaryDirectories.push(directory);
  writeFileSync(schemaPath, source);

  const parsedSchema = new SchemaParser({
    schemaPaths: [schemaPath],
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
    expect(
      lintSchema(parseSchema()).filter((finding) => finding.level === 'error'),
    ).toEqual([]);
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

    expect(
      findings.filter((finding) => finding.rule === 'future-marker-required'),
    ).toEqual([
      expect.objectContaining({
        level: 'error',
        file: 'schema.graphql',
        line: 3,
        message:
          'Async operation "Query.missingQuery" must be preceded by "# Future"',
      }),
      expect.objectContaining({
        level: 'error',
        file: 'schema.graphql',
        line: 7,
        message:
          'Async operation "Mutation.missingMutation" must be preceded by "# Future"',
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

    expect(
      findings.filter((finding) => finding.rule === 'future-marker-required'),
    ).toEqual([]);
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

    expect(
      findings.filter((finding) => finding.rule === 'future-marker-required'),
    ).toEqual([]);
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

    expect(
      findings.filter((finding) => finding.rule === 'ios-type-suffix'),
    ).toEqual([
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

    expect(
      findings.filter((finding) => finding.rule === 'android-type-suffix'),
    ).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 2,
        message:
          'Type "WrongInput" in Android file should end with "Android" suffix',
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

    expect(
      findings.filter((finding) => finding.rule === 'ios-type-suffix'),
    ).toEqual([]);
  });

  test('accepts a union marker before an extended type', () => {
    const findings = lintSchemaSource(`
type Query { _placeholder: Boolean }

# => Union
extend type Query {
  # Future
  wrapped: String
}
`);

    expect(
      findings.filter((finding) => finding.rule === 'union-marker-target'),
    ).toEqual([]);
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

    expect(
      findings.filter((finding) => finding.rule === 'platform-field-suffix'),
    ).toEqual([
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

    expect(
      findings.filter((finding) => finding.rule === 'platform-field-suffix'),
    ).toEqual([]);
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

    expect(
      findings.filter((finding) => finding.rule === 'platform-field-suffix'),
    ).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 11,
        message:
          'Field "Container.horizonResult" references platform-specific type "VerifyPurchaseResultHorizon" and must end with "Android"',
      }),
      expect.objectContaining({
        level: 'error',
        line: 12,
        message:
          'Field "Container.appTransaction" references platform-specific type "AppTransaction" and must end with "IOS"',
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

    expect(
      findings.filter((finding) => finding.rule === 'platform-field-suffix'),
    ).toEqual([
      expect.objectContaining({
        level: 'error',
        line: 8,
        message:
          'Field "Mutation.launchExternalLink" references platform-specific type "LaunchExternalLinkParamsAndroid" and must end with "Android"',
      }),
    ]);
  });
});
