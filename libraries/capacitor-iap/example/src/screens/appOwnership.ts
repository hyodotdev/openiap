import {verifyAppOwnership} from 'capacitor-iap';
import {actionButton, card, errorText, h, statusLine} from '../utils/ui';

/** App Ownership example: evidence that this install came from its store. */
export function renderAppOwnership(container: HTMLElement): () => void {
  const projectNumber = h('input', {
    placeholder: 'Google Cloud project number',
    inputmode: 'numeric',
  });
  const requestHash = h('input', {
    placeholder: 'Request hash',
    autocapitalize: 'off',
  });
  const status = statusLine();

  const check = async () => {
    const cloudProjectNumber = projectNumber.value.trim();
    const digest = requestHash.value.trim();
    if (Boolean(cloudProjectNumber) !== Boolean(digest)) {
      status.set(
        'developer-error: Enter both Google fields or leave both empty.',
      );
      return;
    }
    try {
      const evidence = await verifyAppOwnership(
        cloudProjectNumber && digest
          ? {google: {cloudProjectNumber, requestHash: digest}}
          : undefined,
      );
      status.set(
        [
          `Status: ${evidence.status}`,
          `Store ID: ${evidence.storeId}`,
          `Reason: ${evidence.reason ?? 'none'}`,
          `Signed AppTransaction length: ${evidence.signedAppTransactionIOS?.length ?? 0}`,
          `Integrity token length: ${evidence.integrityTokenAndroid?.length ?? 0}`,
        ].join('\n'),
      );
    } catch (error) {
      status.set(errorText(error));
    }
  };

  container.append(
    card(
      'App ownership',
      h(
        'p',
        {class: 'muted'},
        'Google Play requires a linked Cloud project number and a request hash from your backend. Unknown is inconclusive; send evidence to your backend for verification.',
      ),
      projectNumber,
      requestHash,
      actionButton('Check app ownership', check),
      status.element,
    ),
  );
  return () => {};
}
