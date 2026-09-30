import type {Purchase} from '../types';
import {isVegaOS} from '../vega';

// Byte-identical to consoleNotice in packages/docs/community-touchpoints.json.
export const FIRST_PURCHASE_NOTICE = [
  '[OpenIAP] First purchase finished in this app 🎉',
  'If OpenIAP saved you time, a star helps: https://github.com/hyodotdev/openiap',
  'When your app ships, list it for free: https://openiap.dev/showcase',
  '(Shown once, debug builds only.)',
] as const;

/** What the notice reads from the running app; tests pass their own. */
export interface FirstPurchaseNoticeSignals {
  isDebugBuild: () => boolean;
  isTestRunner: () => boolean;
  /** Vega OS runs the JS adapter, which has no native once-per-install flag. */
  isVegaOS: () => boolean;
  log: (message: string) => void;
}

const appSignals: FirstPurchaseNoticeSignals = {
  isDebugBuild: () => __DEV__,
  // Through globalThis: consumers type-check without Node types.
  isTestRunner: () =>
    (globalThis as {process?: {env?: Record<string, string | undefined>}})
      .process?.env?.JEST_WORKER_ID !== undefined,
  isVegaOS,
  log: (message) => console.log(message),
};

/**
 * Returns the hook `finishTransaction` calls after a successful finish. It
 * prints the notice for a purchased purchase in a debug build, at most once per
 * install (`claim` owns the native flag), and never throws.
 */
export const createFirstPurchaseNotice = (
  claim: () => boolean,
  signals: FirstPurchaseNoticeSignals = appSignals,
): ((purchase: Purchase) => void) => {
  let tried = false;

  return (purchase) => {
    try {
      if (tried || purchase.purchaseState !== 'purchased') return;
      if (
        !signals.isDebugBuild() ||
        signals.isTestRunner() ||
        signals.isVegaOS()
      ) {
        return;
      }
      tried = true;
      if (claim()) {
        signals.log(FIRST_PURCHASE_NOTICE.join('\n'));
      }
    } catch {
      // The notice never changes the finish result.
    }
  };
};
