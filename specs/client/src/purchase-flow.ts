// Published purchase-flow entry point: keep legacy helpers outside the core.
import type {
  PurchaseFlowPurchase,
  PurchaseFlowOptions,
  PurchaseConfirmation,
} from "./purchase-flow-core.js";

import {
  createDeviceConfirmationIOS as deviceConfirmation,
  createIapkitConfirmation as iapkitConfirmation,
  readIapkitVerification as readVerification,
  toIapkitVerificationProps as verificationProps,
  type IapkitConfirmationOptions as ConfirmationOptions,
  type IapkitVerificationProps as VerificationProps,
  type IapkitVerificationResult as VerificationResult,
} from "./purchase-flow-confirmers.js";

export * from "./purchase-flow-core.js";

/* eslint-disable @typescript-eslint/no-empty-object-type -- Preserve the published mergeable interfaces. */
/** @deprecated Use the SDK's IapkitConfirmationOptions. Removed in the next major release. */
export interface IapkitConfirmationOptions<
  P extends PurchaseFlowPurchase = PurchaseFlowPurchase,
> extends ConfirmationOptions<P> {}

/** @deprecated Use the SDK's VerifyPurchaseWithProviderProps. Removed in the next major release. */
export interface IapkitVerificationProps extends VerificationProps {}

/** @deprecated Use the SDK's VerifyPurchaseWithProviderResult. Removed in the next major release. */
export interface IapkitVerificationResult extends VerificationResult {}
/* eslint-enable @typescript-eslint/no-empty-object-type */

/** @deprecated Use the SDK's confirmWithIapkit. Removed in the next major release. */
export function createIapkitConfirmation<P extends PurchaseFlowPurchase>(
  verify: (props: IapkitVerificationProps) => Promise<IapkitVerificationResult>,
  options: IapkitConfirmationOptions<P>,
): PurchaseFlowOptions<P>["confirmWithBackend"] {
  return iapkitConfirmation(verify, options);
}

/** @deprecated Use the SDK's confirmOnDeviceIOS. Removed in the next major release. */
export function createDeviceConfirmationIOS<P extends PurchaseFlowPurchase>(
  getPendingTransactionsIOS: () => Promise<P[]>,
  options: {
    grant?: (purchase: P, context: { isConsumable: boolean }) => Promise<void>;
  } = {},
): PurchaseFlowOptions<P>["confirmWithBackend"] {
  return deviceConfirmation(getPendingTransactionsIOS, options);
}

/** @deprecated Use the SDK's confirmWithIapkit. Removed in the next major release. */
export function toIapkitVerificationProps<P extends PurchaseFlowPurchase>(
  purchase: P,
  options: IapkitConfirmationOptions<P>,
): IapkitVerificationProps {
  return verificationProps(purchase, options);
}

/** @deprecated Use the SDK's confirmWithIapkit. Removed in the next major release. */
export function readIapkitVerification<P extends PurchaseFlowPurchase>(
  result: IapkitVerificationResult,
  purchase: P,
  context: { isConsumable: boolean },
  options: Omit<IapkitConfirmationOptions<P>, "apiKey"> = {},
): PurchaseConfirmation {
  return readVerification(result, purchase, context, options);
}
