import type {ProductSubscription, SubscriptionOffer} from 'expo-iap';

function billingPeriod(value: string): string {
  const match = /^P(\d+)([DWMY])$/.exec(value);
  if (!match) return value;
  const unit = {D: 'day', W: 'week', M: 'month', Y: 'year'}[
    match[2] as 'D' | 'W' | 'M' | 'Y'
  ];
  return `${match[1]} ${unit}${match[1] === '1' ? '' : 's'}`;
}

export function subscriptionDisplay(product: ProductSubscription): {
  offer?: SubscriptionOffer;
  price: string;
  terms?: string;
} {
  const offer =
    product.platform === 'android'
      ? product.subscriptionOffers?.find((item) => item.offerTokenAndroid)
      : undefined;
  const phases = offer?.pricingPhasesAndroid?.pricingPhaseList;
  let terms: string | undefined;
  if (phases?.length) {
    terms = phases
      .map((phase, index) => {
        const period = billingPeriod(phase.billingPeriod);
        const price = phases.length > 1 ? `${phase.formattedPrice} ` : '';
        switch (phase.recurrenceMode) {
          case 1:
            return `${price}every ${period} · Auto-renews`;
          case 2:
            return `${price}every ${period} for ${
              phase.billingCycleCount
            } payment${phase.billingCycleCount === 1 ? '' : 's'}`;
          case 3:
            return `${price}for ${period}${index === phases.length - 1 ? ' · Does not renew' : ''}`;
          default:
            return `${price}/ ${period}`;
        }
      })
      .join(', then ');
    const commitment = offer?.installmentPlanDetailsAndroid;
    if (commitment) {
      terms += ` · ${commitment.commitmentPaymentsCount} payments required`;
      if (commitment.subsequentCommitmentPaymentsCount > 0) {
        terms += ` on signup and ${commitment.subsequentCommitmentPaymentsCount} on renewal`;
      }
    }
  } else if (offer?.period && offer.period.unit !== 'unknown') {
    terms = `${offer.period.value} ${offer.period.unit}${
      offer.period.value === 1 ? '' : 's'
    }`;
  } else if (
    product.platform === 'ios' &&
    product.subscriptionPeriodNumberIOS &&
    product.subscriptionPeriodUnitIOS &&
    product.subscriptionPeriodUnitIOS !== 'empty'
  ) {
    const count = product.subscriptionPeriodNumberIOS;
    terms = `${count} ${product.subscriptionPeriodUnitIOS}${
      count === '1' ? '' : 's'
    }`;
    if (product.typeIOS === 'auto-renewable-subscription') {
      terms += ' · Auto-renews';
    }
  }
  return {offer, price: offer?.displayPrice ?? product.displayPrice, terms};
}
