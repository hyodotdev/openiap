import { GraphQLDeprecatedDirective, isInputObjectType, isObjectType, printSchema, validateSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { parseSchema } from '../codegen/core/parser.js';
import { GENERATOR_INPUT_CONTRACTS } from '../custom-input-contracts.js';

describe('OpenIAP schema contract', () => {
  it('keeps standard and type-level deprecation directives distinct', () => {
    const schema = parseSchema().schema;
    const typeDirective = schema.getDirective('openiapDeprecated');

    expect(schema.getDirective('deprecated')).toBe(GraphQLDeprecatedDirective);
    expect(typeDirective?.locations).toEqual(['OBJECT', 'INTERFACE', 'UNION', 'ENUM', 'INPUT_OBJECT']);
    expect(
      typeDirective?.args.map((argument) => ({
        defaultValue: argument.defaultValue,
        name: argument.name,
        type: argument.type.toString(),
      })),
    ).toEqual([
      {
        defaultValue: undefined,
        name: 'reason',
        type: 'String!',
      },
    ]);
    expect(printSchema(schema)).toContain(
      'directive @openiapDeprecated(reason: String!) on OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT',
    );
  });

  it('allowlists only the intentional nested-union codegen extension', () => {
    expect(validateSchema(parseSchema().schema).map((error) => error.message)).toEqual([
      'Union type ProductOrSubscription can only include Object types, it cannot include Product.',
      'Union type ProductOrSubscription can only include Object types, it cannot include ProductSubscription.',
    ]);
  });

  it('keeps every generator-owned input contract present in the production schema', () => {
    const schema = parseSchema().schema;
    for (const inputName of Object.keys(GENERATOR_INPUT_CONTRACTS)) {
      expect(isInputObjectType(schema.getType(inputName)), inputName).toBe(true);
    }
  });

  it('removes the legacy purchase platform field from concrete purchase types', () => {
    const schema = parseSchema().schema;
    for (const typeName of ['PurchaseAndroid', 'PurchaseIOS']) {
      const purchaseType = schema.getType(typeName);
      expect(isObjectType(purchaseType), typeName).toBe(true);
      if (!isObjectType(purchaseType)) continue;

      expect(purchaseType.getFields().platform, `${typeName}.platform`).toBeUndefined();
      expect(purchaseType.getFields().store, `${typeName}.store`).toBeDefined();
    }
  });
});
