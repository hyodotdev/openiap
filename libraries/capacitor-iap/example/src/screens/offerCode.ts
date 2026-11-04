import {openRedeemOfferCode} from 'capacitor-iap';
import {actionButton, card, errorText, h, statusLine} from '../utils/ui';

/** Opens the store's offer code sheet; a redeemed purchase also reaches the purchase flow. */
export function renderOfferCode(container: HTMLElement): () => void {
  const status = statusLine();
  container.append(
    card(
      'Redeem an offer code',
      h(
        'p',
        {class: 'muted'},
        'The App Store and Google Play show their own redemption screen. When a purchase is not returned at once, it arrives through the purchase listener.',
      ),
      actionButton('Redeem offer code', async () => {
        try {
          const purchase = await openRedeemOfferCode();
          status.set(
            purchase
              ? `Redeemed ${purchase.productId}`
              : 'Redemption sheet closed',
          );
        } catch (error) {
          status.set(errorText(error));
        }
      }),
      status.element,
    ),
  );
  return () => {};
}
