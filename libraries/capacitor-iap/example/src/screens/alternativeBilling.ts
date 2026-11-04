import {Capacitor} from '@capacitor/core';
import {
  canPresentExternalPurchaseNoticeIOS,
  createBillingProgramReportingDetailsAndroid,
  developerProvidedBillingListenerAndroid,
  endConnection,
  initConnection,
  isBillingProgramAvailableAndroid,
  launchExternalLinkAndroid,
  presentExternalPurchaseLinkIOS,
  presentExternalPurchaseNoticeSheetIOS,
  userChoiceBillingListenerAndroid,
  type BillingProgramAndroid,
} from 'capacitor-iap';
import {actionButton, card, errorText, h, statusLine} from '../utils/ui';

const EXTERNAL_URL = 'https://openiap.dev';
const PROGRAMS: BillingProgramAndroid[] = [
  'external-offer',
  'external-payments',
  'billing-choice',
  'user-choice-billing',
];

/** Android billing programs (Play Billing 8.2.0+) and iOS external purchase. */
export function renderAlternativeBilling(container: HTMLElement): () => void {
  const status = statusLine();
  const show = (value: unknown) =>
    status.set(
      typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    );
  const run = (action: () => Promise<unknown>) => async () => {
    try {
      show(await action());
    } catch (error) {
      status.set(errorText(error));
    }
  };

  if (Capacitor.getPlatform() === 'ios') {
    container.append(
      card(
        'External purchase (iOS 17.4+)',
        actionButton(
          'Can present notice',
          run(() => canPresentExternalPurchaseNoticeIOS()),
        ),
        actionButton(
          'Present notice sheet',
          run(() => presentExternalPurchaseNoticeSheetIOS()),
        ),
        actionButton(
          'Open external link',
          run(() => presentExternalPurchaseLinkIOS(EXTERNAL_URL)),
        ),
      ),
      status.element,
    );
    return () => {};
  }

  const program = h('select');
  for (const value of PROGRAMS) program.append(new Option(value, value));
  const selected = () => program.value as BillingProgramAndroid;

  // A billing program applies to the next connection.
  const reconnect = async () => {
    await endConnection();
    return initConnection({enableBillingProgramAndroid: selected()});
  };

  const listeners = [
    userChoiceBillingListenerAndroid((details) =>
      show({userChoice: details.products}),
    ),
    developerProvidedBillingListenerAndroid((details) =>
      show({developerProvidedBilling: details.products}),
    ),
  ];

  container.append(
    card(
      'Billing program (Android)',
      program,
      actionButton(
        'Reconnect with program (enableBillingProgramAndroid)',
        run(reconnect),
      ),
      actionButton(
        'Check availability',
        run(() => isBillingProgramAvailableAndroid(selected())),
      ),
      actionButton(
        'Launch external link',
        run(() =>
          launchExternalLinkAndroid({
            billingProgram: selected(),
            launchMode: 'launch-in-external-browser-or-app',
            linkType: 'link-to-digital-content-offer',
            linkUri: EXTERNAL_URL,
          }),
        ),
      ),
      actionButton(
        'Create reporting details',
        run(() => createBillingProgramReportingDetailsAndroid(selected())),
      ),
    ),
    status.element,
  );
  return () => listeners.forEach((listener) => listener.remove());
}
