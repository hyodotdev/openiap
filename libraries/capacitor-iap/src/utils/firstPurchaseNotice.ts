import {Capacitor} from '@capacitor/core';
import {CapacitorIap} from '../plugin';
import type {PurchaseInput} from '../types';

// Byte-identical to consoleNotice in packages/docs/community-touchpoints.json.
export const FIRST_PURCHASE_NOTICE = [
  '[OpenIAP] First purchase finished in this app 🎉',
  'If OpenIAP saved you time, a star helps: https://github.com/hyodotdev/openiap',
  'When your app ships, list it for free: https://openiap.dev/showcase',
  '(Shown once, debug builds only.)',
].join('\n');

export interface FirstPurchaseNoticeSignals {
  isDebugBuild: () => boolean;
  isTestRunner: () => boolean;
  hasFlagStore: () => boolean;
  /** True only the first time on this install. */
  claim: () => Promise<boolean>;
  log: (message: string) => void;
}

/** Call after a finish resolves; it never throws and never blocks the caller. */
export function createFirstPurchaseNotice(
  signals: FirstPurchaseNoticeSignals,
): (purchase: PurchaseInput) => void {
  let tried = false;

  return (purchase) => {
    if (
      tried ||
      purchase.purchaseState !== 'purchased' ||
      !signals.isDebugBuild() ||
      signals.isTestRunner() ||
      !signals.hasFlagStore()
    ) {
      return;
    }

    // One native claim per process; the stored flag covers relaunches.
    tried = true;
    void Promise.resolve()
      .then(() => signals.claim())
      .then((first) => {
        if (first) signals.log(FIRST_PURCHASE_NOTICE);
      })
      .catch(() => {});
  };
}

export const showFirstPurchaseNotice = createFirstPurchaseNotice({
  // The native claim answers false unless the host app is a debug build.
  isDebugBuild: () => true,
  // Through globalThis: consumers type-check without Node types.
  isTestRunner: () =>
    (globalThis as {process?: {env?: Record<string, string | undefined>}})
      .process?.env?.JEST_WORKER_ID !== undefined,
  hasFlagStore: () => Capacitor.isNativePlatform(),
  claim: async () => (await CapacitorIap.claimFirstPurchaseNotice()).value,
  log: (message) => console.log(message),
});
