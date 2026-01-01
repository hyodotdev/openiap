// =============================================================================
// Third Party Library Images
// =============================================================================
// Centralized image URLs for IAP libraries used across the documentation site
// =============================================================================

export const LIBRARY_IMAGES = {
  'react-native-iap': 'https://hyochan.github.io/react-native-iap/img/logo.png',
  'expo-iap': 'https://hyochan.github.io/expo-iap/img/icon.png',
  flutter_inapp_purchase:
    'https://hyochan.github.io/flutter_inapp_purchase/img/logo.png',
  'kmp-iap': 'https://hyochan.github.io/kmp-iap/img/logo.png',
  'godot-iap': '/godot-iap.png',
} as const;

export type LibraryName = keyof typeof LIBRARY_IMAGES;

// =============================================================================
// Third Party Library Metadata
// =============================================================================

export interface LibraryInfo {
  name: string;
  displayName: string;
  description: string;
  url: string;
  image: string;
}

export const LIBRARIES: LibraryInfo[] = [
  {
    name: 'react-native-iap',
    displayName: 'react-native-iap',
    description: 'React Native & Expo (Nitro Modules)',
    url: 'https://github.com/dooboolab-community/react-native-iap',
    image: LIBRARY_IMAGES['react-native-iap'],
  },
  {
    name: 'expo-iap',
    displayName: 'expo-iap',
    description: 'React Native & Expo (Expo Modules)',
    url: 'https://github.com/hyochan/expo-iap',
    image: LIBRARY_IMAGES['expo-iap'],
  },
  {
    name: 'flutter_inapp_purchase',
    displayName: 'flutter_inapp_purchase',
    description: 'Flutter',
    url: 'https://github.com/dooboolab-community/flutter_inapp_purchase',
    image: LIBRARY_IMAGES['flutter_inapp_purchase'],
  },
  {
    name: 'kmp-iap',
    displayName: 'kmp-iap',
    description: 'Kotlin Multiplatform',
    url: 'https://github.com/nicoseng/kmp-iap',
    image: LIBRARY_IMAGES['kmp-iap'],
  },
  {
    name: 'godot-iap',
    displayName: 'godot-iap',
    description: 'Godot (GDScript)',
    url: 'https://github.com/hyochan/godot-iap',
    image: LIBRARY_IMAGES['godot-iap'],
  },
];
