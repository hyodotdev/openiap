import { describe, expect, it } from 'vitest';
import { behaviorIds } from '../src/spec/behaviors.mjs';
import {
  METAMORPHIC_RELATIONS,
  assertRelationIntegrity,
  unverifiedRelations,
} from '../src/spec/metamorphic-relations.mjs';

describe('metamorphic relation registry', () => {
  it('gives every relation a unique mr.-namespaced id', () => {
    const ids = METAMORPHIC_RELATIONS.map((relation) => relation.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^mr\.[a-z0-9-]+$/);
  });

  it('references only behaviors the suite defines', () => {
    expect(() => assertRelationIntegrity()).not.toThrow();
    const known = new Set(behaviorIds());
    for (const relation of METAMORPHIC_RELATIONS) {
      for (const behaviorId of relation.verifiedBy) {
        expect(known.has(behaviorId), behaviorId).toBe(true);
      }
    }
  });

  it('states each relation as two or more linked executions', () => {
    for (const relation of METAMORPHIC_RELATIONS) {
      expect(relation.statement.length, relation.id).toBeGreaterThan(20);
      expect(relation.executions.length, relation.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('reports which relations only a live store can exercise', () => {
    const ids = unverifiedRelations().map((relation) => relation.id);
    expect(ids).toContain('mr.fetch-products-repeat-consistency');
    expect(ids).toContain('mr.local-and-server-verification-agree');
  });
});
