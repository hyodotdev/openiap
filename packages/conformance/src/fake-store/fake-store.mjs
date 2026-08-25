/**
 * Deterministic in-memory store backend.
 *
 * This stands in for Apple/Google/Amazon servers so purchase flows can be
 * exercised in CI, where a real purchase is impossible. It models the store,
 * not OpenIAP: it speaks store-shaped results and knows nothing about the
 * spec's normalized types. An implementation under test sits on top and is
 * responsible for the normalization the conformance suite asserts.
 */

export const StoreOutcome = Object.freeze({
  Success: 'Success',
  UserCancelled: 'UserCancelled',
  AlreadyOwned: 'AlreadyOwned',
  Pending: 'Pending',
  Unknown: 'Unknown',
});

let sequence = 0;
function nextId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export class FakeStore {
  /**
   * @param {object} options
   * @param {Array<{sku: string, type: 'in-app'|'subs', title?: string, currency?: string, displayPrice?: string}>} options.catalog
   * @param {string} [options.store]
   */
  constructor({ catalog = [], store = 'Fake' } = {}) {
    this.store = store;
    this.catalog = new Map(catalog.map((entry) => [entry.sku, entry]));
    /** @type {Map<string, object>} owned purchases keyed by token */
    this.owned = new Map();
    /** @type {Set<string>} tokens not yet finished */
    this.unfinished = new Set();
    /** @type {Map<string, string>} sku -> forced outcome */
    this.forcedOutcomes = new Map();
    /** Verifier reachability, so infrastructure failure can be simulated. */
    this.verifierAvailable = true;
  }

  /** Force the next purchase of `sku` to take a non-success path. */
  forceOutcome(sku, outcome) {
    this.forcedOutcomes.set(sku, outcome);
  }

  /** Simulate the verification backend being unreachable. */
  setVerifierAvailable(available) {
    this.verifierAvailable = available;
  }

  reset() {
    this.owned.clear();
    this.unfinished.clear();
    this.forcedOutcomes.clear();
    this.verifierAvailable = true;
  }

  /** Store-shaped product lookup. Unknown skus are simply absent. */
  queryProducts(skus, type) {
    return skus
      .map((sku) => this.catalog.get(sku))
      .filter(Boolean)
      .filter((entry) => (type ? entry.type === type : true))
      .map((entry) => ({
        sku: entry.sku,
        type: entry.type,
        title: entry.title ?? `Product ${entry.sku}`,
        currency: entry.currency ?? 'USD',
        displayPrice: entry.displayPrice ?? '$0.99',
      }));
  }

  /**
   * Attempt a purchase. Returns a store-shaped outcome; it never throws, the
   * way a real billing callback reports failure rather than raising.
   */
  purchase(sku) {
    if (!this.catalog.has(sku)) {
      return { outcome: StoreOutcome.Unknown, sku, reason: 'sku not in catalog' };
    }

    const forced = this.forcedOutcomes.get(sku);
    if (forced) {
      this.forcedOutcomes.delete(sku);
      if (forced !== StoreOutcome.Success) {
        if (forced === StoreOutcome.Pending) {
          const token = nextId('token');
          const record = { token, sku, state: 'pending', type: this.catalog.get(sku).type };
          this.owned.set(token, record);
          this.unfinished.add(token);
          return { outcome: StoreOutcome.Pending, purchase: record };
        }
        return { outcome: forced, sku };
      }
    }

    const alreadyOwned = [...this.owned.values()].some(
      (record) => record.sku === sku && record.state === 'purchased',
    );
    if (alreadyOwned && this.catalog.get(sku).type === 'in-app') {
      return { outcome: StoreOutcome.AlreadyOwned, sku };
    }

    const token = nextId('token');
    const record = { token, sku, state: 'purchased', type: this.catalog.get(sku).type };
    this.owned.set(token, record);
    this.unfinished.add(token);
    return { outcome: StoreOutcome.Success, purchase: record };
  }

  /** Purchases the store would return on a restore/query. */
  queryPurchases() {
    return [...this.owned.values()];
  }

  unfinishedTokens() {
    return [...this.unfinished];
  }

  /**
   * Finish a transaction. Consuming a consumable removes ownership, matching
   * how a consumed item stops being reported by the store.
   */
  finish(token, { consume = false } = {}) {
    this.unfinished.delete(token);
    if (consume) this.owned.delete(token);
  }
}
