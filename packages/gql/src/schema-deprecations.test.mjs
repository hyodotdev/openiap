import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEMA_FILE_NAMES } from '../schema-files.mjs';
import { assertValidSchemaDeprecations, extractSchemaDeprecations, OPENIAP_REMOVAL_NOTICE_PATTERN } from '../schema-deprecations.mjs';

const repositorySchemaSources = () =>
  SCHEMA_FILE_NAMES.map((fileName) => ({
    sourceId: fileName,
    sdl: readFileSync(new URL(`./${fileName}`, import.meta.url), 'utf8'),
  }));

describe('canonical schema deprecations', () => {
  it('extracts type, field, and operation-argument metadata once', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'schema.graphql',
        sdl: `
directive @openiapDeprecated(reason: String!) on OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT

type Legacy @openiapDeprecated(reason: "Use Modern instead. Scheduled for removal in OpenIAP 3.0.") {
  old: String @deprecated(reason: "Use modern instead. Scheduled for removal in OpenIAP 3.0.")
}

type Query {
  value(
    legacy: String @deprecated(reason: "Use current instead. Scheduled for removal in OpenIAP 3.0.")
  ): String
}
`,
      },
    ]);

    expect(deprecations.issues).toEqual([]);
    expect(deprecations.typeReasons).toEqual(new Map([['Legacy', 'Use Modern instead. Scheduled for removal in OpenIAP 3.0.']]));
    expect(deprecations.operationArguments).toEqual([
      {
        rootName: 'Query',
        fieldName: 'value',
        argumentName: 'legacy',
        reason: 'Use current instead. Scheduled for removal in OpenIAP 3.0.',
      },
    ]);
    expect(deprecations.entries.map((entry) => entry.ownerPath)).toEqual(['Legacy', 'Legacy.old', 'Query.value.legacy']);
  });

  it('rejects wrong directive locations and invalid canonical reasons', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'invalid.graphql',
        sdl: `
type Legacy @deprecated(reason: "Wrong directive. Scheduled for removal in OpenIAP 3.0.") {
  old: String @openiapDeprecated(reason: "Wrong directive. Scheduled for removal in OpenIAP 3.0.")
}

type Empty @openiapDeprecated(reason: "") {
  value: String
}
`,
      },
    ]);

    expect(deprecations.issues.map((issue) => issue.rule)).toEqual([
      'deprecated-directive-location',
      'deprecated-directive-location',
      'deprecated-reason-invalid',
    ]);
    expect(() => assertValidSchemaDeprecations(deprecations)).toThrow('Invalid GraphQL deprecation metadata');
  });

  it('rejects canonical reasons without the OpenIAP 3.0 removal schedule', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'unscheduled.graphql',
        sdl: `
directive @openiapDeprecated(reason: String!) on OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT

type Legacy @openiapDeprecated(reason: "Use Modern instead.") {
  old: String @deprecated(reason: "Use modern instead.")
}
`,
      },
    ]);

    expect(deprecations.issues).toEqual([
      expect.objectContaining({
        file: 'unscheduled.graphql',
        rule: 'deprecated-removal-schedule-missing',
        message: expect.stringContaining('Scheduled for removal in OpenIAP <major>.<minor>.'),
      }),
      expect.objectContaining({
        file: 'unscheduled.graphql',
        rule: 'deprecated-removal-schedule-missing',
        message: expect.stringContaining('Scheduled for removal in OpenIAP <major>.<minor>.'),
      }),
    ]);
  });

  it('accepts a future OpenIAP removal boundary', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'future.graphql',
        sdl: `
type Query {
  old: String @deprecated(reason: "Use current instead. Scheduled for removal in OpenIAP 4.0.")
}
`,
      },
    ]);

    expect(deprecations.issues).toEqual([]);
    expect(OPENIAP_REMOVAL_NOTICE_PATTERN.test(deprecations.entries[0].reason)).toBe(true);
  });

  // Every scheduled deprecation is listed here on purpose: an unlisted one is
  // either an accident or a removal someone forgot to carry out.
  it('schedules only the deprecations this repository has agreed to', () => {
    const deprecations = extractSchemaDeprecations(repositorySchemaSources());

    expect(deprecations.issues).toEqual([]);
    expect(
      deprecations.entries.map((entry) => ({ owner: entry.ownerPath, reason: entry.reason })),
    ).toEqual([
      {
        owner: 'VerifyPurchaseResultHorizon.success',
        reason:
          'Renamed to isValid so every VerifyPurchaseResult variant answers validity the same way. Scheduled for removal in OpenIAP 4.0.',
      },
    ]);
    expect(deprecations.typeReasons).toEqual(new Map());
    expect(deprecations.operationArguments).toEqual([]);
  });

  it('rejects duplicate type ownership across definitions and extensions', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'base.graphql',
        sdl: `type Legacy @openiapDeprecated(reason: "Use Modern. Scheduled for removal in OpenIAP 3.0.") {
  value: String
}`,
      },
      {
        sourceId: 'extension.graphql',
        sdl: `extend type Legacy @openiapDeprecated(reason: "Duplicate. Scheduled for removal in OpenIAP 3.0.") {
  other: String
}`,
      },
    ]);

    expect(deprecations.issues).toEqual([
      expect.objectContaining({
        file: 'extension.graphql',
        line: 1,
        rule: 'deprecated-directive-duplicate',
        message: 'ObjectTypeExtension "Legacy" duplicates @openiapDeprecated ownership from base.graphql:1',
      }),
    ]);
  });

  it('rejects duplicate field and argument ownership across sources', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'base.graphql',
        sdl: `type Legacy {
  old: String @deprecated(reason: "Use current. Scheduled for removal in OpenIAP 3.0.")
}
type Query {
  value(legacy: String @deprecated(reason: "Use current. Scheduled for removal in OpenIAP 3.0.")): String
}`,
      },
      {
        sourceId: 'extension.graphql',
        sdl: `extend type Legacy {
  old: String @deprecated(reason: "Duplicate field. Scheduled for removal in OpenIAP 3.0.")
}
extend type Query {
  value(legacy: String @deprecated(reason: "Duplicate argument. Scheduled for removal in OpenIAP 3.0.")): String
}`,
      },
    ]);

    expect(deprecations.issues).toEqual([
      expect.objectContaining({
        file: 'extension.graphql',
        message: 'FieldDefinition "Legacy.old" duplicates @deprecated ownership from base.graphql:2',
        rule: 'deprecated-directive-duplicate',
      }),
      expect.objectContaining({
        file: 'extension.graphql',
        message: 'InputValueDefinition "Query.value.legacy" duplicates @deprecated ownership from base.graphql:5',
        rule: 'deprecated-directive-duplicate',
      }),
    ]);
    expect(deprecations.operationArguments).toEqual([
      {
        rootName: 'Query',
        fieldName: 'value',
        argumentName: 'legacy',
        reason: 'Use current. Scheduled for removal in OpenIAP 3.0.',
      },
    ]);
  });

  it('ignores marker-shaped block-string prose but rejects real legacy comments', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'comments.graphql',
        sdl: `"""
# @deprecated This is only an example.
"""
type Current {
  value: String
}

# @deprecated Use Current instead.
type Legacy {
  value: String
}
`,
      },
    ]);

    expect(deprecations.issues).toEqual([
      expect.objectContaining({
        file: 'comments.graphql',
        line: 8,
        rule: 'deprecated-comment-legacy',
      }),
    ]);
  });

  it('rejects trailing legacy deprecation comments outside strings', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'trailing.graphql',
        sdl: `type Legacy { value: String } # @deprecated Use Current.
input Current { note: String = "# @deprecated only string data" }
`,
      },
    ]);

    expect(deprecations.issues).toEqual([
      expect.objectContaining({
        file: 'trailing.graphql',
        line: 1,
        rule: 'deprecated-comment-legacy',
      }),
    ]);
  });
});
