import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifySchemaChange,
  formatReport,
  parseSchemaFileNames,
} from './audit-schema-semver.mjs';

const BASE = `
type Query {
  ping: String
  product(id: ID!): Product
}

type Product {
  id: ID!
  title: String!
}

enum ProductType {
  InApp
  Subs
}

input ProductRequest {
  skus: [String!]!
}
`;

test('identical schemas classify as clean', () => {
  const result = classifySchemaChange(BASE, BASE);
  assert.equal(result.breaking.length, 0);
  assert.equal(result.dangerous.length, 0);
  assert.deepEqual(result.addedTypes, []);
  assert.match(
    formatReport('base', result),
    /clean — no schema surface change/,
  );
});

test('removed field is breaking', () => {
  const head = BASE.replace('  title: String!\n', '');
  const result = classifySchemaChange(BASE, head);
  assert.equal(result.breaking.length, 1);
  assert.equal(result.breaking[0].type, 'FIELD_REMOVED');
});

test('removed enum value is breaking', () => {
  const head = BASE.replace('  Subs\n', '');
  const result = classifySchemaChange(BASE, head);
  assert.equal(result.breaking.length, 1);
  assert.equal(result.breaking[0].type, 'VALUE_REMOVED_FROM_ENUM');
});

test('changed field type is breaking', () => {
  const head = BASE.replace('ping: String', 'ping: Int');
  const result = classifySchemaChange(BASE, head);
  assert.equal(result.breaking.length, 1);
  assert.equal(result.breaking[0].type, 'FIELD_CHANGED_KIND');
});

test('new required input field is breaking', () => {
  const head = BASE.replace(
    '  skus: [String!]!\n',
    '  skus: [String!]!\n  storefront: String!\n',
  );
  const result = classifySchemaChange(BASE, head);
  assert.equal(result.breaking.length, 1);
  assert.equal(result.breaking[0].type, 'REQUIRED_INPUT_FIELD_ADDED');
});

test('added enum value is dangerous, not breaking', () => {
  const head = BASE.replace('  Subs\n', '  Subs\n  Bundle\n');
  const result = classifySchemaChange(BASE, head);
  assert.equal(result.breaking.length, 0);
  assert.equal(result.dangerous.length, 1);
  assert.equal(result.dangerous[0].type, 'VALUE_ADDED_TO_ENUM');
});

test('added optional field and type are additive only', () => {
  const head = `${BASE}
type Receipt {
  token: String!
}
`.replace('  ping: String\n', '  ping: String\n  receipt: Receipt\n');
  const result = classifySchemaChange(BASE, head);
  assert.equal(result.breaking.length, 0);
  assert.equal(result.dangerous.length, 0);
  assert.deepEqual(result.addedTypes, ['Receipt']);
});

test('report lists each change with its class', () => {
  const head = BASE.replace('  title: String!\n', '').replace(
    '  Subs\n',
    '  Subs\n  Bundle\n',
  );
  const report = formatReport('origin/main', classifySchemaChange(BASE, head));
  assert.match(report, /breaking: 1 · dangerous: 1/);
  assert.match(report, /BREAKING {2}FIELD_REMOVED/);
  assert.match(report, /dangerous VALUE_ADDED_TO_ENUM/);
});

test('swapping a root operation type is breaking even when both types remain', () => {
  const base = `schema { query: Query }
type Query { ping: String }
type NewQuery { ping: String }
`;
  const head = `schema { query: NewQuery }
type Query { ping: String }
type NewQuery { ping: String }
`;
  const result = classifySchemaChange(base, head);
  assert.equal(result.breaking.length, 1);
  assert.equal(result.breaking[0].type, 'ROOT_TYPE_CHANGED');
  assert.match(
    result.breaking[0].description,
    /query root changed from Query to NewQuery/,
  );
});

test('adding a root operation where none existed is additive, not breaking', () => {
  const base = `schema { query: Query }
type Query { ping: String }
`;
  const head = `schema { query: Query mutation: Mutation }
type Query { ping: String }
type Mutation { doIt: String }
`;
  const result = classifySchemaChange(base, head);
  assert.equal(result.breaking.length, 0);
  assert.ok(result.addedTypes.includes('Mutation'));
});

test('removing a root operation is breaking', () => {
  const base = `schema { query: Query mutation: Mutation }
type Query { ping: String }
type Mutation { doIt: String }
`;
  const head = `schema { query: Query }
type Query { ping: String }
type Mutation { doIt: String }
`;
  const result = classifySchemaChange(base, head);
  const roots = result.breaking.filter(
    (change) => change.type === 'ROOT_TYPE_CHANGED',
  );
  assert.equal(roots.length, 1);
  assert.match(
    roots[0].description,
    /mutation root changed from Mutation to none/,
  );
});

test('parses the schema inventory from a schema-files.mjs source snapshot', () => {
  const source = `export const SCHEMA_FILE_NAMES = Object.freeze([
  'schema.graphql',
  'type.graphql',
]);`;
  assert.deepEqual(parseSchemaFileNames(source), [
    'schema.graphql',
    'type.graphql',
  ]);
  assert.deepEqual(parseSchemaFileNames('no inventory here'), []);
});
