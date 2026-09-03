import { describe, expect, it } from 'vitest';
import { assertValidSchemaMarkers, extractSchemaMarkers } from '../schema-markers.mjs';

describe('schema generation markers', () => {
  it('shares union and future marker semantics across generators', () => {
    const markers = extractSchemaMarkers([
      `# => Union
# explanatory comment

type Result {
  value: String
}

extend type Query {
  # Future
  # explanatory comment

  currentValue(id: String!): Result
}
`,
    ]);

    expect([...markers.unionWrappers]).toEqual(['Result']);
    expect([...markers.futureFields]).toEqual(['Query.currentValue']);
  });

  it('uses parsed declaration ownership across valid multiline SDL', () => {
    const markers = extractSchemaMarkers([
      `# => Union
type
Result {
  value: String
}

extend type Query {
  # Future
  currentValue
    (id: String)
    : String
}
`,
    ]);

    expect([...markers.unionWrappers]).toEqual(['Result']);
    expect([...markers.futureFields]).toEqual(['Query.currentValue']);
    expect(markers.issues).toEqual([]);
  });

  it('fails closed on an intervening declaration after a union marker', () => {
    const markers = extractSchemaMarkers([
      `# => Union
enum Intervening {
  VALUE
}
type NotMarked {
  value: String
}
`,
    ]);

    expect([...markers.unionWrappers]).toEqual([]);
    expect(markers.issues).toEqual([
      {
        kind: 'union',
        reason: 'invalid-target',
        sourceId: '<schema:1>',
        markerLine: 1,
        targetLine: 2,
      },
    ]);
  });

  it('does not attach a Future marker to a stale object owner', () => {
    const markers = extractSchemaMarkers([
      `type Query {
  currentValue: String
}

input Filter {
  # Future
  value: String
}
`,
    ]);

    expect([...markers.futureFields]).toEqual([]);
    expect(markers.issues).toEqual([
      {
        kind: 'future',
        reason: 'invalid-owner',
        sourceId: '<schema:1>',
        markerLine: 6,
        targetLine: 7,
        target: 'Filter.value',
      },
    ]);
  });

  it('rejects union markers owned by operation root types', () => {
    const markers = extractSchemaMarkers([
      {
        sourceId: 'root.graphql',
        sdl: `
# => Union
extend type Mutation {
  noop: Boolean
}
`,
      },
    ]);

    expect([...markers.unionWrappers]).toEqual([]);
    expect(markers.issues).toEqual([
      {
        kind: 'union',
        reason: 'invalid-owner',
        sourceId: 'root.graphql',
        markerLine: 2,
        targetLine: 3,
        target: 'Mutation',
      },
    ]);
  });

  it('rejects Future markers on no-effect root placeholders', () => {
    const markers = extractSchemaMarkers([
      `type Query {
  # Future
  _placeholder: Boolean
}
`,
    ]);

    expect([...markers.futureFields]).toEqual([]);
    expect(markers.issues).toEqual([
      {
        kind: 'future',
        reason: 'no-effect',
        sourceId: '<schema:1>',
        markerLine: 2,
        targetLine: 3,
        target: 'Query._placeholder',
      },
    ]);
  });

  it('does not treat a compact type declaration as a Future field target', () => {
    const markers = extractSchemaMarkers([
      `# Future
extend type Query { currentValue: String }
`,
    ]);

    expect([...markers.futureFields]).toEqual([]);
    expect(markers.issues).toEqual([
      {
        kind: 'future',
        reason: 'invalid-target',
        sourceId: '<schema:1>',
        markerLine: 1,
        targetLine: 2,
      },
    ]);
  });

  it('ignores comments that only mention marker text', () => {
    const markers = extractSchemaMarkers([
      `# This example is not a # => Union marker.
type PlainResult {
  value: String
}

extend type Query {
  # Future work may make this asynchronous.
  currentValue: String
}
`,
    ]);

    expect([...markers.unionWrappers]).toEqual([]);
    expect([...markers.futureFields]).toEqual([]);
    expect(markers.issues).toEqual([]);
  });

  it('ignores marker-shaped text inside block string descriptions', () => {
    const markers = extractSchemaMarkers([
      String.raw`"""
# => Union
Escaped block delimiter: \"""
# Future
"""
type PlainResult {
  value: String
}

extend type Query {
  """
  # Future
  """
  currentValue: String
}
`,
    ]);

    expect([...markers.unionWrappers]).toEqual([]);
    expect([...markers.futureFields]).toEqual([]);
    expect(markers.issues).toEqual([]);
  });

  it('rejects marker comments placed after GraphQL declarations', () => {
    const markers = extractSchemaMarkers([
      `type Result { value: String } # => Union
type Query { currentValue: String } # Future
`,
    ]);

    expect([...markers.unionWrappers]).toEqual([]);
    expect([...markers.futureFields]).toEqual([]);
    expect(markers.issues).toEqual([
      {
        kind: 'union',
        reason: 'invalid-placement',
        sourceId: '<schema:1>',
        markerLine: 1,
        targetLine: null,
      },
      {
        kind: 'future',
        reason: 'invalid-placement',
        sourceId: '<schema:1>',
        markerLine: 2,
        targetLine: null,
      },
    ]);
    expect(() => assertValidSchemaMarkers(markers)).toThrow('must be a standalone comment immediately before its target');
  });

  it('reports markers that have no target', () => {
    const markers = extractSchemaMarkers([
      `extend type Query {
  value: String
}

# Future
`,
    ]);

    expect(markers.issues).toEqual([
      {
        kind: 'future',
        reason: 'invalid-target',
        sourceId: '<schema:1>',
        markerLine: 5,
        targetLine: null,
      },
    ]);
  });

  it('rejects duplicate marker ownership within and across sources', () => {
    const markers = extractSchemaMarkers([
      {
        sourceId: 'base.graphql',
        sdl: `# => Union
# => Union
type Result {
  value: String
}

type Query {
  # Future
  # Future
  value: String
}
`,
      },
      {
        sourceId: 'extension.graphql',
        sdl: `# => Union
extend type Result {
  error: String
}

extend type Query {
  # Future
  value: String
}
`,
      },
    ]);

    expect(markers.issues).toEqual([
      expect.objectContaining({
        kind: 'union',
        reason: 'duplicate-marker',
        sourceId: 'base.graphql',
        target: 'Result',
        previous: { sourceId: 'base.graphql', markerLine: 1 },
      }),
      expect.objectContaining({
        kind: 'future',
        reason: 'duplicate-marker',
        sourceId: 'base.graphql',
        target: 'Query.value',
        previous: { sourceId: 'base.graphql', markerLine: 8 },
      }),
      expect.objectContaining({
        kind: 'union',
        reason: 'duplicate-marker',
        sourceId: 'extension.graphql',
        target: 'Result',
        previous: { sourceId: 'base.graphql', markerLine: 1 },
      }),
      expect.objectContaining({
        kind: 'future',
        reason: 'duplicate-marker',
        sourceId: 'extension.graphql',
        target: 'Query.value',
        previous: { sourceId: 'base.graphql', markerLine: 8 },
      }),
    ]);
    expect(() => assertValidSchemaMarkers(markers)).toThrow('Invalid GraphQL generation marker ownership');
  });
});
