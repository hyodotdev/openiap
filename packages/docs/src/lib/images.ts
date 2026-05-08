// =============================================================================
// Library Images and Metadata
// =============================================================================
// Centralized image URLs and framework ordering for the documentation site.
// Keep framework listings in pages derived from LIBRARIES to avoid drift.
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
// Framework Library Metadata
// =============================================================================

export type FrameworkLibraryName =
  | 'expo-iap'
  | 'react-native-iap'
  | 'flutter_inapp_purchase'
  | 'kmp-iap'
  | 'maui-iap'
  | 'godot-iap';

export interface LibraryInfo {
  name: FrameworkLibraryName;
  displayName: string;
  frameworkName: string;
  homeLabel: string;
  setupPath: string;
  language: string;
  description: string;
  languagesDescription: string;
  setupDescription: string;
  installCommand?: string;
  releaseUrl?: string;
  documentationUrl: string;
  url: string;
  image: string;
  imageAlt: string;
}

export const LIBRARIES: LibraryInfo[] = [
  {
    name: 'expo-iap',
    displayName: 'expo-iap',
    frameworkName: 'Expo',
    homeLabel: 'Expo',
    setupPath: '/docs/setup/expo',
    language: 'TypeScript',
    description: 'React Native & Expo (Expo Modules)',
    languagesDescription:
      'React Native & Expo implementation of OpenIAP specification (Expo Modules)',
    setupDescription:
      'Expo SDK projects via Expo Modules. Same API surface as react-native-iap, including the `useIAP` hook, with managed-workflow-friendly install. Recommended for any Expo app.',
    installCommand: 'npm install expo-iap',
    documentationUrl: 'https://hyochan.github.io/expo-iap',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap',
    image: LIBRARY_IMAGES['expo-iap'],
    imageAlt: 'Expo IAP',
  },
  {
    name: 'react-native-iap',
    displayName: 'react-native-iap',
    frameworkName: 'React Native',
    homeLabel: 'React Native',
    setupPath: '/docs/setup/react-native',
    language: 'TypeScript',
    description: 'React Native & Expo (Nitro Modules)',
    languagesDescription:
      'React Native & Expo implementation of OpenIAP specification (Nitro Modules)',
    setupDescription:
      'Bare React Native CLI projects (RN 0.79+). Built on Nitro Modules with the `useIAP` hook, error normalization, and full StoreKit 2 / Play Billing 8 coverage.',
    installCommand: 'npm install react-native-iap',
    documentationUrl: 'https://hyochan.github.io/react-native-iap',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap',
    image: LIBRARY_IMAGES['react-native-iap'],
    imageAlt: 'React Native IAP',
  },
  {
    name: 'flutter_inapp_purchase',
    displayName: 'flutter_inapp_purchase',
    frameworkName: 'Flutter',
    homeLabel: 'Flutter',
    setupPath: '/docs/setup/flutter',
    language: 'Dart',
    description: 'Flutter',
    languagesDescription: 'Flutter implementation of OpenIAP specification',
    setupDescription:
      'Flutter apps via the `flutter_inapp_purchase` package. Generated `types.dart`, sealed-class results, and a Stream-based event API that mirrors the OpenIAP schema.',
    installCommand: 'flutter pub add flutter_inapp_purchase',
    documentationUrl: 'https://hyochan.github.io/flutter_inapp_purchase',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase',
    image: LIBRARY_IMAGES['flutter_inapp_purchase'],
    imageAlt: 'Flutter IAP',
  },
  {
    name: 'kmp-iap',
    displayName: 'kmp-iap',
    frameworkName: 'Kotlin Multiplatform',
    homeLabel: 'KMP',
    setupPath: '/docs/setup/kmp',
    language: 'Kotlin',
    description: 'Kotlin Multiplatform',
    languagesDescription:
      'Kotlin Multiplatform implementation of OpenIAP specification',
    setupDescription:
      'KMP / Compose Multiplatform via the `kmp-iap` library. Flow-based API on top of OpenIAP, with CocoaPods integration for iOS targets and shared business logic across platforms.',
    installCommand: 'implementation("io.github.hyochan:kmp-iap:1.0.0-rc.6")',
    documentationUrl: 'https://hyochan.github.io/kmp-iap',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap',
    image: LIBRARY_IMAGES['kmp-iap'],
    imageAlt: 'KMP IAP',
  },
  {
    name: 'maui-iap',
    displayName: 'maui-iap',
    frameworkName: '.NET MAUI',
    homeLabel: '.NET MAUI',
    setupPath: '/docs/setup/maui',
    language: 'C#',
    description: '.NET MAUI / C#',
    languagesDescription:
      '.NET MAUI / C# implementation of OpenIAP specification',
    setupDescription:
      '.NET MAUI / C# 12 via the `maui-iap` library (OpenIap.Maui on NuGet). Ships as one NuGet package with generated `Types.cs`, flattened Android AAR bindings, and StoreKit xcframework resources for iOS / macCatalyst.',
    installCommand: 'dotnet add package OpenIap.Maui --version 1.0.1',
    documentationUrl: '/docs/setup/maui',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/maui-iap',
    image: LIBRARY_IMAGES['maui-iap'],
    imageAlt: '.NET MAUI IAP',
  },
  {
    name: 'godot-iap',
    displayName: 'godot-iap',
    frameworkName: 'Godot',
    homeLabel: 'Godot',
    setupPath: '/docs/setup/godot',
    language: 'GDScript',
    description: 'Godot (GDScript)',
    languagesDescription:
      'Godot implementation of OpenIAP specification (GDScript)',
    setupDescription:
      'Godot 4.x via the `godot-iap` plugin (iOS GDExtension + Android AAR). Exposes the same OpenIAP function set so the same purchase flow can ship across mobile + console targets.',
    releaseUrl: 'https://github.com/hyodotdev/openiap/releases',
    documentationUrl:
      'https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap',
    url: 'https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap',
    image: LIBRARY_IMAGES['godot-iap'],
    imageAlt: 'Godot IAP',
  },
];
