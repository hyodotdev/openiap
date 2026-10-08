import { readFileSync } from 'node:fs';
import { Kind, parse, type TypeNode } from 'graphql';
import { describe, expect, it } from 'vitest';
import { SCHEMA_FILE_NAMES } from '../schema-files.mjs';

function isRequiredNamed(type: TypeNode, name: string): boolean {
  return (
    type.kind === Kind.NON_NULL_TYPE &&
    type.type.kind === Kind.NAMED_TYPE &&
    type.type.name.value === name
  );
}

function objectFields(sources: string[]): Map<string, Map<string, TypeNode>> {
  const byType = new Map<string, Map<string, TypeNode>>();
  for (const source of sources) {
    for (const definition of parse(source).definitions) {
      if (
        definition.kind !== Kind.OBJECT_TYPE_DEFINITION &&
        definition.kind !== Kind.OBJECT_TYPE_EXTENSION
      ) {
        continue;
      }
      let fields = byType.get(definition.name.value);
      if (!fields) {
        fields = new Map();
        byType.set(definition.name.value, fields);
      }
      for (const field of definition.fields ?? []) {
        fields.set(field.name.value, field.type);
      }
    }
  }
  return byType;
}

function collectViolations(sources: string[]): string[] {
  const violations: string[] = [];
  for (const [typeName, fields] of objectFields(sources)) {
    const store = fields.get('store');
    if (store && isRequiredNamed(store, 'IapStore')) {
      const storeId = fields.get('storeId');
      if (!storeId || !isRequiredNamed(storeId, 'String')) {
        violations.push(typeName);
      }
    }
  }
  return violations.sort();
}

function realSources(): string[] {
  return SCHEMA_FILE_NAMES.map((fileName) =>
    readFileSync(new URL(`./${fileName}`, import.meta.url), 'utf8'),
  );
}

describe('store identity invariant', () => {
  it('requires storeId alongside a required store on every object type', () => {
    expect(collectViolations(realSources())).toEqual([]);
    const withStore = [...objectFields(realSources())]
      .filter(([, fields]) => {
        const store = fields.get('store');
        return store ? isRequiredNamed(store, 'IapStore') : false;
      })
      .map(([typeName]) => typeName);
    expect(withStore).toEqual(
      expect.arrayContaining([
        'PurchaseAndroid',
        'PurchaseIOS',
        'RequestVerifyPurchaseWithIapkitResult',
      ]),
    );
  });

  it('exempts inputs such as PurchaseInput', () => {
    expect(collectViolations([`input PurchaseInput { store: IapStore! }`])).toEqual(
      [],
    );
  });

  it('fails when an object type omits storeId', () => {
    expect(collectViolations([`type Widget { store: IapStore! }`])).toEqual([
      'Widget',
    ]);
    expect(
      collectViolations([`type Widget { store: IapStore! storeId: String! }`]),
    ).toEqual([]);
  });
});
