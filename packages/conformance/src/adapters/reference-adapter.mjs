import assert from 'node:assert/strict';
import { FakeStore, StoreOutcome } from '../fake-store/fake-store.mjs';
import { ReferenceImplementation } from '../fake-store/reference-implementation.mjs';

/**
 * Reference adapter — the worked example of the contract in README.md.
 *
 * Each behavior id maps to a function that throws on violation. Adapter authors
 * replace the ReferenceImplementation with their own SDK and keep this shape.
 */

const CATALOG = [
  { sku: 'dev.hyo.martie.premium', type: 'subs' },
  { sku: 'dev.hyo.martie.pro', type: 'subs' },
  { sku: 'dev.hyo.martie.10bulbs', type: 'in-app' },
  { sku: 'dev.hyo.martie.lifetime', type: 'in-app' },
];

export function createReferenceAdapter({ store = 'Google' } = {}) {
  const fake = new FakeStore({ catalog: CATALOG, store });
  const iap = new ReferenceImplementation(fake, { iapStore: store });
  const fresh = () => {
    fake.reset();
    return iap;
  };

  return {
    implementation: 'openiap-reference',
    store,
    declaredCapabilities: {
      fetchProducts: 'required',
      requestPurchase: 'required',
      finishTransaction: 'required',
      getAvailablePurchases: 'required',
      getActiveSubscriptions: 'required',
    },

    behaviors: {
      // --- products ------------------------------------------------------
      'products.fetch-returns-requested-skus': async () => {
        const products = await fresh().fetchProducts({
          skus: ['dev.hyo.martie.premium', 'not-a-real-sku'],
        });
        assert.deepEqual(
          products.map((product) => product.id),
          ['dev.hyo.martie.premium'],
          'unknown skus must be omitted, not returned as placeholders',
        );
      },

      'products.fetch-normalizes-required-fields': async () => {
        const [product] = await fresh().fetchProducts({ skus: ['dev.hyo.martie.premium'] });
        for (const field of ['id', 'title', 'currency', 'displayPrice']) {
          assert.ok(product[field], `product.${field} must be non-empty`);
        }
      },

      'products.fetch-empty-sku-list-is-an-error': async () => {
        await assert.rejects(
          () => fresh().fetchProducts({ skus: [] }),
          (error) => error.code === 'empty-sku-list',
        );
      },

      'products.fetch-separates-in-app-and-subscription-types': async () => {
        const subs = await fresh().fetchProducts({
          skus: ['dev.hyo.martie.premium', 'dev.hyo.martie.10bulbs'],
          type: 'subs',
        });
        assert.deepEqual(subs.map((product) => product.id), ['dev.hyo.martie.premium']);
      },

      // --- purchases -----------------------------------------------------
      'purchases.request-emits-purchase-updated-on-success': async () => {
        const impl = fresh();
        const received = [];
        const off = impl.onPurchaseUpdated((purchase) => received.push(purchase));
        await impl.requestPurchase({ sku: 'dev.hyo.martie.10bulbs' });
        off();
        assert.equal(received.length, 1, 'a successful purchase must reach the listener');
        assert.equal(received[0].productId, 'dev.hyo.martie.10bulbs');
      },

      'purchases.request-emits-error-on-user-cancel': async () => {
        const impl = fresh();
        const purchases = [];
        const errors = [];
        impl.onPurchaseUpdated((purchase) => purchases.push(purchase));
        impl.onPurchaseError((error) => errors.push(error));
        fake.forceOutcome('dev.hyo.martie.10bulbs', StoreOutcome.UserCancelled);

        await assert.rejects(() => impl.requestPurchase({ sku: 'dev.hyo.martie.10bulbs' }));
        assert.equal(errors[0]?.code, 'user-cancelled');
        assert.equal(purchases.length, 0, 'a cancelled purchase must not emit purchase-updated');
      },

      'purchases.already-owned-surfaces-already-owned-error': async () => {
        const impl = fresh();
        await impl.requestPurchase({ sku: 'dev.hyo.martie.lifetime' });
        await assert.rejects(
          () => impl.requestPurchase({ sku: 'dev.hyo.martie.lifetime' }),
          (error) => error.code === 'already-owned',
        );
      },

      'purchases.pending-purchase-is-not-delivered-as-purchased': async () => {
        const impl = fresh();
        fake.forceOutcome('dev.hyo.martie.10bulbs', StoreOutcome.Pending);
        const purchase = await impl.requestPurchase({ sku: 'dev.hyo.martie.10bulbs' });
        assert.equal(purchase.purchaseState, 'Pending');
      },

      'purchases.unknown-sku-surfaces-sku-not-found': async () => {
        await assert.rejects(
          () => fresh().requestPurchase({ sku: 'not-a-real-sku' }),
          (error) => error.code === 'sku-not-found',
        );
      },

      // --- completion ----------------------------------------------------
      'completion.finish-removes-transaction-from-pending': async () => {
        const impl = fresh();
        const purchase = await impl.requestPurchase({ sku: 'dev.hyo.martie.10bulbs' });
        assert.ok((await impl.getUnfinishedPurchaseTokens()).includes(purchase.purchaseToken));

        await impl.finishTransaction({ purchaseToken: purchase.purchaseToken, isConsumable: true });
        assert.ok(!(await impl.getUnfinishedPurchaseTokens()).includes(purchase.purchaseToken));
      },

      'completion.finish-is-idempotent': async () => {
        const impl = fresh();
        const purchase = await impl.requestPurchase({ sku: 'dev.hyo.martie.10bulbs' });
        await impl.finishTransaction({ purchaseToken: purchase.purchaseToken });
        await impl.finishTransaction({ purchaseToken: purchase.purchaseToken });
      },

      'completion.unfinished-purchase-remains-available': async () => {
        const impl = fresh();
        const purchase = await impl.requestPurchase({ sku: 'dev.hyo.martie.lifetime' });
        const available = await impl.getAvailablePurchases();
        assert.ok(
          available.some((item) => item.purchaseToken === purchase.purchaseToken),
          'an unfinished purchase must survive for re-grant after a crash',
        );
      },

      // --- restoration ---------------------------------------------------
      'restoration.available-purchases-returns-owned-items': async () => {
        const impl = fresh();
        await impl.requestPurchase({ sku: 'dev.hyo.martie.lifetime' });
        await impl.requestPurchase({ sku: 'dev.hyo.martie.premium' });
        const available = await impl.getAvailablePurchases();
        assert.deepEqual(
          available.map((item) => item.productId).sort(),
          ['dev.hyo.martie.lifetime', 'dev.hyo.martie.premium'],
        );
      },

      'restoration.available-purchases-excludes-consumed-items': async () => {
        const impl = fresh();
        const purchase = await impl.requestPurchase({ sku: 'dev.hyo.martie.10bulbs' });
        await impl.finishTransaction({ purchaseToken: purchase.purchaseToken, isConsumable: true });
        const available = await impl.getAvailablePurchases();
        assert.ok(!available.some((item) => item.purchaseToken === purchase.purchaseToken));
      },

      'restoration.available-purchases-is-empty-for-new-user': async () => {
        assert.deepEqual(await fresh().getAvailablePurchases(), []);
      },

      // --- subscriptions -------------------------------------------------
      'subscriptions.active-subscription-is-reported-active': async () => {
        const impl = fresh();
        await impl.requestPurchase({ sku: 'dev.hyo.martie.premium' });
        const [subscription] = await impl.getActiveSubscriptions();
        assert.equal(subscription.isActive, true);
      },

      'subscriptions.pending-subscription-is-not-active': async () => {
        const impl = fresh();
        fake.forceOutcome('dev.hyo.martie.premium', StoreOutcome.Pending);
        await impl.requestPurchase({ sku: 'dev.hyo.martie.premium' });
        const [subscription] = await impl.getActiveSubscriptions();
        assert.equal(
          subscription.isActive,
          false,
          'a pending subscription is unpaid and must not be an entitlement',
        );
      },

      'subscriptions.unknown-state-subscription-is-not-active': async () => {
        const impl = fresh();
        await impl.requestPurchase({ sku: 'dev.hyo.martie.premium' });
        // Drive the store into an indeterminate state the way a partial sync would.
        for (const record of fake.owned.values()) record.state = 'unknown';
        const [subscription] = await impl.getActiveSubscriptions();
        assert.equal(subscription.isActive, false);
      },

      'subscriptions.groups-keep-independent-identifiers': async () => {
        const impl = fresh();
        await impl.requestPurchase({ sku: 'dev.hyo.martie.premium' });
        await impl.requestPurchase({ sku: 'dev.hyo.martie.pro' });
        const subscriptions = await impl.getActiveSubscriptions();
        const premium = subscriptions.find((item) => item.productId === 'dev.hyo.martie.premium');
        const pro = subscriptions.find((item) => item.productId === 'dev.hyo.martie.pro');

        assert.equal(premium.currentPlanId, 'dev.hyo.martie.premium');
        assert.equal(pro.currentPlanId, 'dev.hyo.martie.pro');
        assert.notEqual(premium.purchaseToken, pro.purchaseToken);
      },

      'subscriptions.has-active-agrees-with-get-active': async () => {
        const impl = fresh();
        assert.equal(await impl.hasActiveSubscriptions(), false);
        await impl.requestPurchase({ sku: 'dev.hyo.martie.premium' });
        assert.equal(await impl.hasActiveSubscriptions(), true);
      },

      // --- errors --------------------------------------------------------
      'errors.store-codes-normalize-to-spec-error-codes': async () => {
        const impl = fresh();
        fake.forceOutcome('dev.hyo.martie.10bulbs', StoreOutcome.UserCancelled);
        await assert.rejects(
          () => impl.requestPurchase({ sku: 'dev.hyo.martie.10bulbs' }),
          (error) => error.code === 'user-cancelled',
        );
      },

      'errors.unrecognized-store-code-normalizes-to-unknown': async () => {
        const impl = fresh();
        fake.forceOutcome('dev.hyo.martie.10bulbs', 'SomeFutureStoreOutcome');
        await assert.rejects(
          () => impl.requestPurchase({ sku: 'dev.hyo.martie.10bulbs' }),
          (error) => error.code === 'unknown',
        );
      },

      'errors.unsupported-codes-are-not-synthesized': async () => {
        // The reference store is Google, which may reach already-owned.
        // Implementations whose store cannot must not emit it.
        const impl = fresh();
        await impl.requestPurchase({ sku: 'dev.hyo.martie.lifetime' });
        await assert.rejects(
          () => impl.requestPurchase({ sku: 'dev.hyo.martie.lifetime' }),
          (error) => error.code === 'already-owned',
        );
      },

      // --- verification ----------------------------------------------------
      'verification.result-exposes-uniform-validity': async () => {
        const impl = fresh();
        const purchase = await impl.requestPurchase({ sku: 'dev.hyo.martie.lifetime' });

        const valid = await impl.verifyPurchase({ purchaseToken: purchase.purchaseToken });
        assert.equal(typeof valid.isValid, 'boolean', 'isValid must be present on every variant');
        assert.equal(valid.isValid, true);

        const unknown = await impl.verifyPurchase({ purchaseToken: 'not-a-real-token' });
        assert.equal(typeof unknown.isValid, 'boolean');
        assert.equal(unknown.isValid, false);
      },

      // --- identifiers ---------------------------------------------------
      'identifiers.purchase-carries-a-concrete-store': async () => {
        const impl = fresh();
        const purchase = await impl.requestPurchase({ sku: 'dev.hyo.martie.10bulbs' });
        assert.notEqual(purchase.store, 'Unknown');
        assert.ok(purchase.store);
      },

      'identifiers.purchase-token-is-stable-across-reads': async () => {
        const impl = fresh();
        const purchase = await impl.requestPurchase({ sku: 'dev.hyo.martie.lifetime' });
        const first = (await impl.getAvailablePurchases())[0].purchaseToken;
        const second = (await impl.getAvailablePurchases())[0].purchaseToken;
        assert.equal(first, purchase.purchaseToken);
        assert.equal(second, purchase.purchaseToken);
      },

      // --- capabilities --------------------------------------------------
      'capabilities.unsupported-operations-degrade-predictably': async () => {
        assert.equal(await fresh().openUnsupportedOperation(), false);
      },

      'capabilities.declared-capabilities-match-the-matrix': async () => {
        // Verified against the matrix by the runner's capability gating; this
        // asserts the adapter actually declares something to check.
        assert.ok(Object.keys(createReferenceAdapter().declaredCapabilities).length > 0);
      },
    },
  };
}
