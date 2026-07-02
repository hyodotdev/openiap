export interface ExampleTarget {
  path: string;
  label: string;
  store: string;
  sourcePath: string;
  summary: string;
  status: 'ready' | 'planned';
}

export const EXAMPLE_TARGETS: ExampleTarget[] = [
  {
    path: '/docs/example',
    label: 'Apple',
    store: 'App Store / StoreKit 2',
    sourcePath: 'packages/apple/Example/',
    summary:
      'StoreKit 2 walkthrough with recorded iOS purchase, subscription, restore, and verification flows.',
    status: 'ready',
  },
  {
    path: '/docs/example',
    label: 'Google',
    store: 'Google Play Billing',
    sourcePath: 'packages/google/Example/',
    summary:
      'Google Play Billing walkthrough with recorded Android purchase, subscription, restore, and verification flows.',
    status: 'ready',
  },
  {
    path: '/docs/example',
    label: 'Horizon OS',
    store: 'Meta Horizon Billing',
    sourcePath: 'packages/google/Example/',
    summary:
      'Meta Horizon Billing walkthrough with recorded Quest purchase, subscription, restore, and verification flows.',
    status: 'ready',
  },
  {
    path: '/docs/example',
    label: 'Fire OS',
    store: 'Amazon Appstore IAP',
    sourcePath: 'packages/google/Example/',
    summary:
      'Complete walkthrough for the Amazon flavor on a real Fire OS tablet.',
    status: 'ready',
  },
];

export const VIDEO_STEPS = [
  'Overview',
  'In-app purchase',
  'Subscription',
  'Available purchases',
  'Verification',
];
