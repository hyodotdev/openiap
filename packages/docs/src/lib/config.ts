// =============================================================================
// Logo Configuration
// =============================================================================
// Change the logo here for seasonal themes (e.g., Christmas, Halloween, etc.)
// Default: '/logo.webp'
// Christmas: '/openiap-santa.webp'
// =============================================================================

export const LOGO_PATH = '/logo.webp';

// Seasonal logos (uncomment when needed)
// export const LOGO_PATH = '/openiap-santa.webp'; // Christmas

// =============================================================================
// IAPKit Configuration
// =============================================================================

export const IAPKIT_URL = 'https://kit.openiap.dev';
export const IAPKIT_LOGO_PATH = '/iapkit.webp';
export const IAPKIT_AD_BANNER_URL =
  'https://www.hyo.dev/api/ad-banner/cmjf0l27p0004249h2blztbct';

export const trackIapKitClick = (): void => {
  void fetch(IAPKIT_AD_BANNER_URL, { method: 'POST' });
};

export const DOCS_SIDEBAR = {
  defaultWidth: 300,
  minWidth: 180,
  maxWidth: 480,
  mobileWidth: 280,
  keyboardStep: 16,
  dragThreshold: 4,
  widthStorageKey: 'openiap-docs-sidebar-width-v3',
  legacyWidth: {
    storageKey: 'openiap-docs-sidebar-width-v2',
    defaultWidth: 340,
  },
  collapsedStorageKey: 'openiap-docs-sidebar-collapsed-v1',
} as const;

const COMMERCE_SPEC_SOURCE =
  'https://github.com/hyodotdev/openiap/blob/main/specs/commerce-protocol';

export const COMMERCE_PROTOCOL_LINKS = {
  spec: `${COMMERCE_SPEC_SOURCE}/SPEC.md`,
  capabilitiesExample: `${COMMERCE_SPEC_SOURCE}/examples/provider-capabilities.json`,
  example: 'https://github.com/hyodotdev/openiap-commerce-protocol-example',
  buildBrief: 'https://openiap.dev/commerce-example/build-brief.md',
  integrationBrief: 'https://openiap.dev/commerce-example/integration-brief.md',
  exampleSource: '/commerce-example/source.tar.gz',
} as const;

export const COMMERCE_PROTOCOL_INSTALL = '@hyodotdev/openiap-commerce-protocol';
