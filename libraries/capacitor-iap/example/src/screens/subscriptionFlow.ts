import {Capacitor} from '@capacitor/core';
import {
  deepLinkToSubscriptions,
  fetchProducts,
  getActiveSubscriptions,
  purchaseErrorListener,
  requestPurchase,
  type ActiveSubscription,
  type ProductSubscription,
} from 'capacitor-iap';
import {SUBSCRIPTION_PRODUCT_IDS} from '../utils/constants';
import {
  describePurchaseOutcome,
  getReceiptPurchaseFlow,
  verificationSelector,
} from '../utils/purchaseFlow';
import {actionButton, card, errorText, h, statusLine} from '../utils/ui';
import {connection} from '../utils/connection';

const PACKAGE_NAME = 'dev.hyo.martie';

/** Subscribe, change plans, and open the store's subscription management. */
export function renderSubscriptionFlow(container: HTMLElement): () => void {
  const status = statusLine();
  const list = h('div', {class: 'list'});
  const active = h('div', {class: 'list'});
  let activeSubscriptions: ActiveSubscription[] = [];

  const subscribe = async (subscription: ProductSubscription) => {
    // Play needs an offer token; a plan change names the plan it replaces
    // and that plan's purchase token.
    const offerToken = subscription.subscriptionOffers?.find(
      (offer) => offer.offerTokenAndroid,
    )?.offerTokenAndroid;
    const current = activeSubscriptions.find(
      (item) => item.productId !== subscription.id && item.purchaseToken,
    );
    status.set(`Subscribing to ${subscription.title}…`);
    try {
      await requestPurchase({
        request: {
          apple: {sku: subscription.id},
          google: {
            skus: [subscription.id],
            subscriptionOffers: offerToken
              ? [{sku: subscription.id, offerToken}]
              : undefined,
            purchaseToken: current?.purchaseToken,
            subscriptionProductReplacementParams: current
              ? {
                  oldProductId: current.productId,
                  replacementMode: 'with-time-proration',
                }
              : undefined,
          },
        },
        type: 'subs',
      });
    } catch (error) {
      status.set(errorText(error));
    }
  };

  const refreshActive = async () => {
    try {
      activeSubscriptions = await getActiveSubscriptions(
        SUBSCRIPTION_PRODUCT_IDS,
      );
      active.replaceChildren(
        ...(activeSubscriptions.length
          ? activeSubscriptions.map((item) =>
              h(
                'span',
                {},
                `${item.productId} · ${item.isActive ? 'active' : 'inactive'}`,
              ),
            )
          : [h('span', {class: 'muted'}, 'No active subscription')]),
      );
    } catch (error) {
      status.set(errorText(error));
    }
  };

  const unsubscribe = getReceiptPurchaseFlow().subscribe(
    ({purchase, status: outcome}) => {
      status.set(`${purchase.productId}: ${describePurchaseOutcome(outcome)}`);
      void refreshActive();
    },
  );
  const errors = purchaseErrorListener((error) => status.set(errorText(error)));

  connection
    .then(() => fetchProducts({skus: SUBSCRIPTION_PRODUCT_IDS, type: 'subs'}))
    .then((subscriptions) =>
      list.replaceChildren(
        ...((subscriptions ?? []) as ProductSubscription[]).map(
          (subscription) =>
            card(
              subscription.title,
              h('span', {class: 'muted'}, subscription.id),
              actionButton(`Subscribe ${subscription.displayPrice}`, () =>
                subscribe(subscription),
              ),
            ),
        ),
      ),
    )
    .catch((error: unknown) => status.set(errorText(error)));
  void connection.then(refreshActive, () => {});

  container.append(
    card('Verification', verificationSelector()),
    card(
      'Active subscriptions',
      active,
      actionButton('Manage subscriptions', () =>
        deepLinkToSubscriptions({
          skuAndroid: activeSubscriptions[0]?.productId,
          packageNameAndroid:
            Capacitor.getPlatform() === 'android' ? PACKAGE_NAME : undefined,
        }).catch((error: unknown) => status.set(errorText(error))),
      ),
    ),
    status.element,
    list,
  );
  return () => {
    unsubscribe();
    errors.remove();
  };
}
