import { describe, expect, it } from 'vitest';
import { assertValidSchemaDeprecations, extractSchemaDeprecations } from '../schema-deprecations.mjs';

describe('canonical schema deprecations', () => {
  it('extracts type, field, and operation-argument metadata once', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'schema.graphql',
        sdl: `
directive @openiapDeprecated(reason: String!) on OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT

type Legacy @openiapDeprecated(reason: "Use Modern instead.") {
  old: String @deprecated(reason: "Use modern instead.")
}

type Query {
  value(
    legacy: String @deprecated(reason: "Use current instead.")
  ): String
}
`,
      },
    ]);

    expect(deprecations.issues).toEqual([]);
    expect(deprecations.typeReasons).toEqual(new Map([['Legacy', 'Use Modern instead.']]));
    expect(deprecations.operationArguments).toEqual([
      {
        rootName: 'Query',
        fieldName: 'value',
        argumentName: 'legacy',
        reason: 'Use current instead.',
      },
    ]);
    expect(deprecations.entries.map((entry) => entry.ownerPath)).toEqual(['Legacy', 'Legacy.old', 'Query.value.legacy']);
  });

  it('rejects wrong directive locations and invalid canonical reasons', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'invalid.graphql',
        sdl: `
type Legacy @deprecated(reason: "Wrong directive.") {
  old: String @openiapDeprecated(reason: "Wrong directive.")
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

  it('rejects duplicate type ownership across definitions and extensions', () => {
    const deprecations = extractSchemaDeprecations([
      {
        sourceId: 'base.graphql',
        sdl: `type Legacy @openiapDeprecated(reason: "Use Modern.") {
  value: String
}`,
      },
      {
        sourceId: 'extension.graphql',
        sdl: `extend type Legacy @openiapDeprecated(reason: "Duplicate.") {
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
  old: String @deprecated(reason: "Use current.")
}
type Query {
  value(legacy: String @deprecated(reason: "Use current.")): String
}`,
      },
      {
        sourceId: 'extension.graphql',
        sdl: `extend type Legacy {
  old: String @deprecated(reason: "Duplicate field.")
}
extend type Query {
  value(legacy: String @deprecated(reason: "Duplicate argument.")): String
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
        reason: 'Use current.',
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
