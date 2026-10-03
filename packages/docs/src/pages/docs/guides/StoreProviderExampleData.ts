import { Code2, FlaskConical, Package, ShieldCheck } from 'lucide-react';
export const repository =
  'https://github.com/hyodotdev/openiap-google-amazon-community';
export const source = (path: string) => `${repository}/blob/main/${path}`;
export const screens = [
  {
    id: 'home',
    title: 'Same example, new provider',
    image: 'home.png',
    detail:
      'The official Expo example menus remain in place. Amazon Provider Lab changes the package selection and branding, so you can compare the same flows.',
  },
  {
    id: 'catalog',
    title: 'Products from the Amazon SDK',
    image: 'catalog.png',
    detail:
      'The public fetchProducts API loads the App Tester catalog through the separately packaged provider.',
  },
  {
    id: 'acceptance',
    title: 'Inspect the extension boundary',
    image: 'acceptance.png',
    detail:
      'Provider Acceptance checks connection, catalog, custom identity, receipt continuity, sandbox verification and completion. Pending or rejected purchases remain unfinished.',
  },
  {
    id: 'tutorial',
    title: 'Inspect each integration layer',
    image: 'tutorial.png',
    wideImage: 'tutorial-wide.png',
    detail:
      'Tap the app’s numbered layers to open a compact guide. Wide displays show the explanation beside the selected layer; both layouts share the same source data.',
  },
  {
    id: 'completed',
    title: 'Verify, finish, read ownership',
    image: 'completed.png',
    detail:
      'An explicit Amazon verification request reaches the dev backend. Completion is shown only after a valid Sandbox response and an ownership read confirms consumption.',
  },
] as const;
export const files = [
  {
    icon: Package,
    title: 'Package the binding',
    path: 'provider/build.gradle.kts',
    detail:
      'Public core and Amazon SDK dependencies; your own Maven coordinates.',
  },
  {
    icon: Code2,
    title: 'Implement the contract',
    path: 'provider/src/main/kotlin/dev/openiap/provider/fireos/FireOsProviderFactory.kt',
    detail:
      'A discoverable factory creates the provider and declares its identity and capabilities.',
  },
  {
    icon: ShieldCheck,
    title: 'Wire startup and discovery',
    path: 'provider/src/main/AndroidManifest.xml',
    detail:
      'Factory metadata, early Amazon listener registration and protected response delivery.',
  },
  {
    icon: Code2,
    title: 'Select it in the consumer',
    path: 'example/app.config.js',
    detail:
      'The public Expo config plugin selects amazon-example and its artifact; the app imports expo-iap.',
  },
  {
    icon: ShieldCheck,
    title: 'Keep verification explicit',
    path: 'example/src/utils/vegaRuntime.ts',
    detail:
      'Map this known community receipt to Amazon; validate product, environment, state and storeId before finishing.',
  },
  {
    icon: FlaskConical,
    title: 'Prove behavior and packaging',
    path: 'VERIFICATION.md',
    detail:
      'Public conformance, consumer tests, optimized builds and observed device results, with their limits.',
  },
];

export type ExampleScreen = (typeof screens)[number];
