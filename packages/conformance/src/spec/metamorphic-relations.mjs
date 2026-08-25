/**
 * Metamorphic relations for store-facing checks.
 *
 * Real stores are oracle-free: no test can predict what StoreKit or Play
 * Billing will return, so store E2E checks assert relations between
 * executions instead of expected outputs (chen2018metamorphic in
 * knowledge/research/bibliography.md; backlog R3).
 *
 * Each relation names the executions it links and the suite behaviors that
 * already verify it against the fake store. Device E2E suites reuse the same
 * ids so a run can report which relations it exercised against a live store.
 */

import { behaviorById } from './behaviors.mjs';

/**
 * @typedef {object} MetamorphicRelation
 * @property {string} id permanent public identifier, `mr.` namespace
 * @property {string} statement the relation that must hold
 * @property {ReadonlyArray<string>} executions the calls being related
 * @property {ReadonlyArray<string>} verifiedBy behavior ids that assert it
 */

/** @type {ReadonlyArray<MetamorphicRelation>} */
export const METAMORPHIC_RELATIONS = Object.freeze([
  {
    id: 'mr.fetch-products-repeat-consistency',
    statement:
      'Two consecutive fetchProducts calls with the same sku list return the same product ids; no oracle states what the catalog is, only that it is stable across reads.',
    executions: ['fetchProducts', 'fetchProducts'],
    verifiedBy: [],
  },
  {
    id: 'mr.purchase-then-restore-includes-purchase',
    statement:
      'After a successful non-consumable purchase, getAvailablePurchases includes a purchase for that sku without any assertion about token contents.',
    executions: ['requestPurchase', 'getAvailablePurchases'],
    verifiedBy: ['completion.unfinished-purchase-remains-available'],
  },
  {
    id: 'mr.consume-then-restore-excludes-purchase',
    statement:
      'After a consumable is finished with consume, getAvailablePurchases no longer includes it.',
    executions: ['finishTransaction', 'getAvailablePurchases'],
    verifiedBy: ['restoration.available-purchases-excludes-consumed-items'],
  },
  {
    id: 'mr.verify-agrees-with-delivery',
    statement:
      'A token delivered by the store verifies isValid true and a token the store never issued verifies isValid false; verification agrees with delivery rather than with any predicted receipt payload.',
    executions: ['requestPurchase', 'verifyPurchase'],
    verifiedBy: [
      'verification.result-exposes-uniform-validity',
      'verification.forged-token-is-invalid',
    ],
  },
  {
    id: 'mr.subscription-views-agree',
    statement:
      'hasActiveSubscriptions is true exactly when getActiveSubscriptions reports at least one entitlement; the two reads must agree without knowing which subscriptions exist.',
    executions: ['hasActiveSubscriptions', 'getActiveSubscriptions'],
    verifiedBy: ['subscriptions.has-active-agrees-with-get-active'],
  },
  {
    id: 'mr.token-stable-across-reads',
    statement:
      'The same purchase reports the same purchase token on every read; no oracle states what the token is.',
    executions: ['getAvailablePurchases', 'getAvailablePurchases'],
    verifiedBy: ['identifiers.purchase-token-is-stable-across-reads'],
  },
  {
    id: 'mr.local-and-server-verification-agree',
    statement:
      'Local verification and a server-side verifier (backend or IAPKit) reach the same isValid verdict for the same purchase, or the disagreement is an error, never a silent entitlement grant.',
    executions: ['verifyPurchase', 'server verification'],
    verifiedBy: [],
  },
]);

/** Relations no fake-store behavior covers; device E2E must exercise these. */
export function unverifiedRelations() {
  return METAMORPHIC_RELATIONS.filter(
    (relation) => relation.verifiedBy.length === 0,
  );
}

/** Throws when a relation references a behavior id that does not exist. */
export function assertRelationIntegrity() {
  for (const relation of METAMORPHIC_RELATIONS) {
    for (const behaviorId of relation.verifiedBy) {
      behaviorById(behaviorId);
    }
  }
}
