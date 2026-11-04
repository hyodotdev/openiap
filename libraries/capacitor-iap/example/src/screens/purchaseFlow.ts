import {
  fetchProducts,
  purchaseErrorListener,
  requestPurchase,
  type Product,
} from 'capacitor-iap';
import {PRODUCT_IDS} from '../utils/constants';
import {
  describePurchaseOutcome,
  getReceiptPurchaseFlow,
  verificationSelector,
} from '../utils/purchaseFlow';
import {actionButton, card, errorText, h, statusLine} from '../utils/ui';
import {connection} from '../utils/connection';

/**
 * One-time purchases through the app's shared purchase flow:
 * 1. requestPurchase opens the store sheet.
 * 2. The flow confirms the delivered purchase, finishes it, and reports the outcome.
 */
export function renderPurchaseFlow(container: HTMLElement): () => void {
  const status = statusLine();
  const list = h('div', {class: 'list'});

  const buy = async (product: Product) => {
    status.set(`Purchasing ${product.title}…`);
    try {
      await requestPurchase({
        request: {
          apple: {sku: product.id},
          google: {skus: [product.id]},
        },
        type: 'in-app',
      });
    } catch (error) {
      status.set(errorText(error));
    }
  };

  const unsubscribe = getReceiptPurchaseFlow().subscribe(
    ({purchase, status: outcome}) => {
      status.set(`${purchase.productId}: ${describePurchaseOutcome(outcome)}`);
    },
  );
  const errors = purchaseErrorListener((error) => status.set(errorText(error)));

  connection
    .then(() => fetchProducts({skus: PRODUCT_IDS, type: 'in-app'}))
    .then((products) =>
      list.replaceChildren(
        ...((products ?? []) as Product[]).map((product) =>
          card(
            product.title,
            h('span', {class: 'muted'}, product.id),
            actionButton(`Buy ${product.displayPrice}`, () => buy(product)),
          ),
        ),
      ),
    )
    .catch((error: unknown) => status.set(errorText(error)));

  container.append(
    card('Verification', verificationSelector()),
    status.element,
    list,
  );
  return () => {
    unsubscribe();
    errors.remove();
  };
}
