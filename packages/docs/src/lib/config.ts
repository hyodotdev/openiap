// =============================================================================
// Logo Configuration
// =============================================================================
// Change the logo here for seasonal themes (e.g., Christmas, Halloween, etc.)
// Default: '/logo.webp'
// Christmas: '/openiap-santa.png'
// =============================================================================

export const LOGO_PATH = '/opaniap-santa.png'; // Christmas 2024

// Default logo (uncomment when Christmas is over)
// export const LOGO_PATH = '/logo.webp';

// =============================================================================
// IAPKit Configuration
// =============================================================================

export const IAPKIT_URL = 'https://iapkit.com';
export const IAPKIT_AD_BANNER_URL =
  'https://www.hyo.dev/api/ad-banner/cmjf0l27p0004249h2blztbct';

export const trackIapKitClick = (): void => {
  void fetch(IAPKIT_AD_BANNER_URL, { method: 'POST' });
};
