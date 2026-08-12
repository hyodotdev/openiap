import { isEnumType } from 'graphql';
import { describe, expect, it } from 'vitest';
import { parseSchema } from '../codegen/core/parser.js';
import {
  CAPABILITY_LEVELS,
  CAPABILITY_MATRIX,
  CAPABILITY_STORES,
  capabilityLevel,
  requiredBehaviors,
  unsupportedBehaviors,
} from './capability-matrix.mjs';

function schemaStores(): string[] {
  const storeEnum = parseSchema().schema.getType('IapStore');
  if (!isEnumType(storeEnum)) throw new Error('IapStore is not an enum type');
  return storeEnum
    .getValues()
    .map((value) => value.name)
    .filter((name) => name !== 'Unknown');
}

describe('store capability matrix', () => {
  // Adding a store to the schema without deciding its capabilities must fail
  // CI rather than silently inherit another store's behavior.
  it('covers exactly the stores declared in the IapStore enum', () => {
    expect([...CAPABILITY_STORES].sort()).toEqual(schemaStores().sort());
  });

  it('assigns every covered store a level for every behavior', () => {
    for (const [behavior, entry] of Object.entries(CAPABILITY_MATRIX)) {
      expect(Object.keys(entry.stores).sort(), `${behavior} store coverage`).toEqual(
        [...CAPABILITY_STORES].sort(),
      );
    }
  });

  it('uses only the defined capability levels', () => {
    for (const [behavior, entry] of Object.entries(CAPABILITY_MATRIX)) {
      for (const [store, level] of Object.entries(entry.stores)) {
        expect(CAPABILITY_LEVELS, `${behavior}.${store}`).toContain(level);
      }
    }
  });

  it('describes every behavior', () => {
    for (const [behavior, entry] of Object.entries(CAPABILITY_MATRIX)) {
      expect(entry.description?.trim(), `${behavior} description`).toBeTruthy();
    }
  });

  // Non-required levels are claims about a store's limitations; evidence keeps
  // them auditable.
  it('cites evidence for every optional or unsupported level', () => {
    for (const [behavior, entry] of Object.entries(CAPABILITY_MATRIX)) {
      for (const [store, level] of Object.entries(entry.stores)) {
        if (level === 'required') continue;
        expect(
          entry.evidence?.[store]?.trim(),
          `${behavior}.${store} is "${level}" and needs evidence`,
        ).toBeTruthy();
      }
    }
  });

  it('keeps core purchase behavior required for every store', () => {
    for (const store of CAPABILITY_STORES) {
      for (const behavior of [
        'fetchProducts',
        'requestPurchase',
        'finishTransaction',
        'getAvailablePurchases',
        'getActiveSubscriptions',
      ]) {
        expect(capabilityLevel(behavior, store), `${behavior} on ${store}`).toBe('required');
      }
    }
  });

  it('exposes required and unsupported behavior sets per store', () => {
    expect(requiredBehaviors('Google')).toContain('pendingPurchases');
    expect(unsupportedBehaviors('Amazon')).toContain('pendingPurchases');
    expect(unsupportedBehaviors('Apple')).toContain('alreadyOwnedError');
    expect(requiredBehaviors('Apple')).not.toContain('alreadyOwnedError');
  });

  // "required" must not imply "identical" — record shape differences.
  it('documents required behaviors whose delivery shape differs by store', () => {
    expect(CAPABILITY_MATRIX.pendingPurchases.notes?.Apple).toMatch(/DeferredPayment/);
    expect(capabilityLevel('pendingPurchases', 'Apple')).toBe('required');
  });

  it('rejects unknown behaviors and stores', () => {
    expect(() => capabilityLevel('notARealBehavior', 'Google')).toThrow(/Unknown capability/);
    expect(() => capabilityLevel('fetchProducts', 'Samsung')).toThrow(/no entry for store/);
  });
});
