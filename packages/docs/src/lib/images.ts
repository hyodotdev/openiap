// =============================================================================
// Third Party Library Images
// =============================================================================
// Centralized image URLs for IAP libraries used across the documentation site
// =============================================================================

export const LIBRARY_IMAGES = {
  'openiap-apple': '/frameworks/apple.svg',
  'openiap-google': '/frameworks/google.svg',
  'expo-iap': '/frameworks/expo.svg',
  'react-native-iap': '/frameworks/react-native.webp',
  flutter_inapp_purchase: '/frameworks/flutter.svg',
  'kmp-iap': '/frameworks/kmp.svg',
  'maui-iap': '/frameworks/maui.webp',
  'godot-iap': '/frameworks/godot.webp',
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
    name: 'expo-iap',
    displayName: 'expo-iap',
    description: 'React Native & Expo (Expo Modules)',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap',
    image: LIBRARY_IMAGES['expo-iap'],
  },
  {
    name: 'react-native-iap',
    displayName: 'react-native-iap',
    description: 'React Native & Expo (Nitro Modules)',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap',
    image: LIBRARY_IMAGES['react-native-iap'],
  },
  {
    name: 'flutter_inapp_purchase',
    displayName: 'flutter_inapp_purchase',
    description: 'Flutter',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase',
    image: LIBRARY_IMAGES['flutter_inapp_purchase'],
  },
  {
    name: 'kmp-iap',
    displayName: 'kmp-iap',
    description: 'Kotlin Multiplatform',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap',
    image: LIBRARY_IMAGES['kmp-iap'],
  },
  {
    name: 'maui-iap',
    displayName: 'maui-iap',
    description: '.NET MAUI / C#',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/maui-iap',
    image: LIBRARY_IMAGES['maui-iap'],
  },
  {
    name: 'godot-iap',
    displayName: 'godot-iap',
    description: 'Godot (GDScript)',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap',
    image: LIBRARY_IMAGES['godot-iap'],
  },
];
