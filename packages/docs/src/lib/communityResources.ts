export type Ecosystem =
  | 'openiap'
  | 'apple'
  | 'android'
  | 'react-native'
  | 'expo'
  | 'flutter'
  | 'kmp'
  | 'maui'
  | 'godot'
  | 'iapkit';

export type ResourceType = 'article' | 'video' | 'community' | 'documentation';

export type ResourceSourceKind =
  | 'official'
  | 'company'
  | 'independent'
  | 'community';

export interface ResourceLink {
  label: string;
  url: string;
}

export interface CommunityResource {
  id: string;
  title: string;
  url: string;
  ecosystems: readonly Ecosystem[];
  type: ResourceType;
  sourceKind: ResourceSourceKind;
  author?: string;
  organization?: string;
  platform: string;
  publishedAt: string;
  dateLabel?: 'Published' | 'Updated' | 'Submitted';
  summary: string;
  featured?: boolean;
  language: 'en';
  seriesLabel?: string;
  relatedLinks?: readonly ResourceLink[];
}

export interface OfficialOpenIapResource {
  id: string;
  title: string;
  url: string;
  platform: string;
  summary: string;
}

export const OFFICIAL_OPENIAP_RESOURCES: OfficialOpenIapResource[] = [
  {
    id: 'openiap-official-announcements',
    title: 'OpenIAP Announcements',
    url: 'https://www.openiap.dev/docs/updates/announcements',
    platform: 'OpenIAP Documentation',
    summary:
      'Official maintainer updates about OpenIAP releases, platform support, and ecosystem changes.',
  },
];

export const COMMUNITY_RESOURCES: CommunityResource[] = [
  {
    id: 'anisha-malde-openiap-ecosystem',
    title: 'React Native IAP and the OpenIAP ecosystem',
    url: 'https://www.linkedin.com/posts/anishamalde_mondaykudos-activity-7431758243921797120-4AzA',
    ecosystems: ['openiap', 'react-native'],
    type: 'community',
    sourceKind: 'community',
    author: 'Anisha Malde',
    organization: 'Amazon Developer Relations',
    platform: 'LinkedIn',
    publishedAt: '2026-02-23',
    summary:
      'An Amazon Developer Relations post recommends react-native-iap to Amazon React Native developers and highlights OpenIAP as infrastructure for a broader cross-platform ecosystem.',
    featured: true,
    language: 'en',
  },
  {
    id: 'expo-official-in-app-purchases',
    title: 'In-app purchases',
    url: 'https://docs.expo.dev/guides/in-app-purchases/',
    ecosystems: ['openiap', 'expo'],
    type: 'documentation',
    sourceKind: 'official',
    organization: 'Expo',
    platform: 'Expo Documentation',
    publishedAt: '2026-05-20',
    dateLabel: 'Updated',
    summary:
      "Expo's official guide lists expo-iap and notes that the library conforms to the OpenIAP specification.",
    featured: true,
    language: 'en',
  },
  {
    id: 'callstack-expo-horizon-compatibility',
    title: 'Using Expo Libraries on Horizon OS: A Guide to Compatibility',
    url: 'https://www.callstack.com/blog/using-expo-libraries-on-horizon-os-a-guide-to-compatibility',
    ecosystems: ['openiap', 'expo'],
    type: 'article',
    sourceKind: 'company',
    author: 'Jan Jaworski',
    organization: 'Callstack',
    platform: 'Callstack Blog',
    publishedAt: '2025-10-30',
    summary:
      'Callstack covers expo-iap as an in-app purchase option for Expo applications running on Meta Horizon OS.',
    featured: true,
    language: 'en',
  },
  {
    id: 'callstack-horizon-library-alternatives',
    title: 'Library compatibility: alternatives for Horizon OS',
    url: 'https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/library-compatibility/alternatives',
    ecosystems: ['openiap', 'expo'],
    type: 'documentation',
    sourceKind: 'company',
    organization: 'Callstack',
    platform: 'React Native Meta Horizon OS Docs',
    publishedAt: '2026-01-13',
    summary:
      "Callstack's compatibility documentation identifies expo-iap as the in-app purchase library for Meta Horizon OS billing.",
    language: 'en',
  },
  {
    id: 'this-week-in-react-openiap-coverage',
    title: 'Recurring OpenIAP ecosystem coverage',
    url: 'https://thisweekinreact.com/newsletter/249',
    ecosystems: ['openiap', 'react-native', 'expo'],
    type: 'community',
    sourceKind: 'independent',
    organization: 'This Week in React',
    platform: 'Newsletter',
    publishedAt: '2025-09-10',
    summary:
      'Three newsletter editions track Expo IAP and OpenIAP, Alternative Billing support, and react-native-iap support for Horizon OS.',
    featured: true,
    language: 'en',
    seriesLabel: '#249 · Expo IAP / OpenIAP',
    relatedLinks: [
      {
        label: '#253 · Alternative Billing',
        url: 'https://thisweekinreact.com/newsletter/253',
      },
      {
        label: '#256 · Horizon OS',
        url: 'https://thisweekinreact.com/newsletter/256',
      },
    ],
  },
  {
    id: 'prototyp-react-native-iap-guide',
    title: "Developer's Guide to React Native In-App Purchases",
    url: 'https://prototyp.digital/blog/react-native-in-app-purchases-guide',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'company',
    organization: 'Prototyp Digital',
    platform: 'Prototyp Blog',
    publishedAt: '2024-12-11',
    summary:
      'A practical guide to configuring products, purchases, and subscriptions with react-native-iap.',
    language: 'en',
  },
  {
    id: 'to-the-new-storekit-guide',
    title: 'React Native IAP · StoreKit & StoreKit 2',
    url: 'https://web.archive.org/web/20260421140635id_/https://www.tothenew.com/blog/react-native-iap-%C2%B7-storekit-storekit-2-the-definitive-ios-guide/',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'company',
    author: 'Nikhil Singh',
    organization: 'TO THE NEW Engineering',
    platform: 'Engineering Blog · Internet Archive',
    publishedAt: '2026-03-13',
    summary:
      'An archived iOS-focused guide to using react-native-iap with StoreKit and StoreKit 2.',
    language: 'en',
  },
  {
    id: 'folio3-storekit-google-billing',
    title: 'In-App Purchases using StoreKit 2 & Google Billing',
    url: 'https://folio3.com/blog/in-app-purchases-in-react-native-using-storekit2-google-billing/',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'company',
    organization: 'Folio3',
    platform: 'Folio3 Blog',
    publishedAt: '2024-05-13',
    summary:
      'A cross-platform walkthrough of React Native purchases with StoreKit 2 and Google Play Billing.',
    language: 'en',
  },
  {
    id: 'uxcam-react-native-iap-analytics',
    title: 'React Native IAP: In-App Purchases and Analytics',
    url: 'https://uxcam.com/blog/react-native-iap/',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'company',
    organization: 'UXCam',
    platform: 'UXCam Blog',
    publishedAt: '2024-06-02',
    summary:
      'A guide to implementing react-native-iap and connecting purchase flows with product analytics.',
    language: 'en',
  },
  {
    id: 'simform-react-native-iap-part-4',
    title: 'React Native In-App Purchases — Part 4',
    url: 'https://medium.com/simform-engineering/react-native-in-app-purchases-part-4-02b719f4d5b0',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'company',
    organization: 'Simform Engineering',
    platform: 'Medium',
    publishedAt: '2024-05-30',
    summary:
      "Part of Simform's engineering series on implementing in-app purchases in React Native.",
    language: 'en',
  },
  {
    id: 'haris-consumable-apple-purchases',
    title:
      'Implementing Consumable In-App Purchases in React Native for Apple Devices',
    url: 'https://dev.to/harisbinejaz/implementing-consumable-in-app-purchases-in-react-native-for-apple-devices-2ag9',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Haris Bin Ejaz',
    platform: 'DEV Community',
    publishedAt: '2024-05-30',
    summary:
      'A focused tutorial for configuring and delivering consumable purchases on Apple devices with react-native-iap.',
    language: 'en',
  },
  {
    id: 'pelumi-react-native-complete-guide',
    title: 'Implementing In-App Purchases in React Native: The Complete Guide',
    url: 'https://medium.com/@pelumiogundipe905/implementing-in-app-purchases-in-react-native-the-complete-guide-7c8a8ff10b98',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Pelumi Ogundipe',
    platform: 'Medium',
    publishedAt: '2026-03-02',
    summary:
      'An end-to-end community guide to integrating in-app purchases in a React Native application.',
    language: 'en',
  },
  {
    id: 'olga-react-native-comprehensive-guide',
    title: 'In-App Purchase in React Native: A Comprehensive Guide',
    url: 'https://medium.com/@greennolgaa/in-app-purchase-in-react-native-a-comprehensive-guide-777d608fd25',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Olga',
    platform: 'Medium',
    publishedAt: '2023-07-26',
    summary:
      'A community walkthrough of React Native in-app purchase setup and implementation.',
    language: 'en',
  },
  {
    id: 'shakeb-react-native-purchases',
    title: 'Implementing In-App Purchases in React Native',
    url: 'https://medium.com/@shakeb.khan/implementing-in-app-purchases-in-react-native-62928e43c853',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Shakeb Khan',
    platform: 'Medium',
    publishedAt: '2025-09-06',
    summary:
      'A concise implementation guide for adding in-app purchases to a React Native project.',
    language: 'en',
  },
  {
    id: 'ross-bulat-purchases-subscriptions',
    title: 'In-App Purchases and Subscriptions in React Native',
    url: 'https://rossbulat.medium.com/in-app-purchases-and-subscriptions-in-react-native-2021-walkthrough-26d2056e1a27',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Ross Bulat',
    platform: 'Medium',
    publishedAt: '2021-06-15',
    summary:
      'A detailed walkthrough of one-time products and subscriptions using react-native-iap.',
    language: 'en',
  },
  {
    id: 'yusra-react-native-iap-guide',
    title: 'React Native IAP — Simple Guide',
    url: 'https://medium.com/@yusramasood019/in-app-purchase-iap-in-react-native-simple-guide-b8e5397e8011',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Yusra Masood',
    platform: 'Medium',
    publishedAt: '2025-04-07',
    summary:
      'A short introduction to configuring and using react-native-iap in a mobile application.',
    language: 'en',
  },
  {
    id: 'keshav-purchases-without-hooks',
    title: 'Integrating In-App Purchases in React Native Without Hooks',
    url: 'https://medium.com/@i8skd/integrating-in-app-purchases-in-react-native-without-hooks-js-implementation-4c3a16180e95',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Keshav Pawar',
    platform: 'Medium',
    publishedAt: '2023-10-04',
    summary:
      'A JavaScript-focused guide to using react-native-iap through its direct API rather than React hooks.',
    language: 'en',
  },
  {
    id: 'ali-node-react-native-purchase',
    title: 'In App Purchase — Node + React Native',
    url: 'https://dev.to/aliosaid01/in-app-purchase-node-react-native-256k',
    ecosystems: ['react-native'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Ali Osaid',
    platform: 'DEV Community',
    publishedAt: '2024-12-09',
    summary:
      'A community tutorial connecting a React Native purchase flow with a Node.js backend.',
    language: 'en',
  },
  {
    id: 'muhammad-saad-react-native-iap',
    title: 'A flexible in-app purchase library for React Native',
    url: 'https://www.linkedin.com/posts/muhammad-saad-82111b1a3_github-hyochanreact-native-iap-in-app-activity-7314324016930992128-U_QZ',
    ecosystems: ['react-native'],
    type: 'community',
    sourceKind: 'community',
    author: 'Muhammad Saad',
    platform: 'LinkedIn',
    publishedAt: '2025-04-05',
    summary:
      'A community post highlighting react-native-iap as a flexible option for cross-platform purchase flows.',
    language: 'en',
  },
  {
    id: 'muhammad-rafeh-contribution',
    title: 'Contributing to react-native-iap',
    url: 'https://www.linkedin.com/posts/muhammadrafeh_github-hyochanreact-native-iap-in-app-activity-7292895056863125504-cgdW',
    ecosystems: ['react-native'],
    type: 'community',
    sourceKind: 'community',
    author: 'Muhammad Rafeh Atique',
    platform: 'LinkedIn',
    publishedAt: '2025-02-05',
    summary:
      'A contributor post discussing work on react-native-iap and its place in the React Native ecosystem.',
    language: 'en',
  },
  {
    id: 'euan-morgan-react-native-android-video',
    title: 'React Native In-App Purchases (Android) — Backend and Testers',
    url: 'https://www.youtube.com/watch?v=9kXF-IrJ_SI',
    ecosystems: ['react-native'],
    type: 'video',
    sourceKind: 'independent',
    author: 'Euan Morgan',
    platform: 'YouTube',
    publishedAt: '2021-03-21',
    summary:
      'A from-scratch Android walkthrough covering react-native-iap, test users, and backend receipt validation.',
    language: 'en',
  },
  {
    id: 'doable-danny-android-example-video',
    title: 'React Native In-App Purchases for Android — Example App',
    url: 'https://www.youtube.com/watch?v=nLBoVrAMF04',
    ecosystems: ['react-native'],
    type: 'video',
    sourceKind: 'independent',
    author: 'DoableDanny',
    platform: 'YouTube',
    publishedAt: '2021-05-24',
    summary:
      'A complete Android example app showing Play Console setup, test purchases, and react-native-iap integration.',
    language: 'en',
  },
  {
    id: 'programming-decoded-expo-android',
    title:
      'Getting In-App Purchases Working for an Android App Created with React Expo',
    url: 'https://dev.to/programmingdecoded/getting-in-app-purchases-working-for-an-android-app-created-with-react-expo-4phh',
    ecosystems: ['expo'],
    type: 'article',
    sourceKind: 'independent',
    author: 'ProgrammingDecoded',
    platform: 'DEV Community',
    publishedAt: '2025-08-09',
    summary:
      'A developer account of setting up Android purchases in an Expo application with expo-iap.',
    language: 'en',
  },
  {
    id: 'eyup-expo-iap-admob',
    title: 'Using Expo IAP and Google AdMob Together',
    url: 'https://www.linkedin.com/posts/eypk_using-expo-iap-and-google-admob-together-activity-7426583291010527232-Axo7',
    ecosystems: ['expo'],
    type: 'community',
    sourceKind: 'community',
    author: 'Eyup K.',
    platform: 'LinkedIn',
    publishedAt: '2026-02-09',
    summary:
      'A community implementation note about combining expo-iap purchase flows with Google AdMob.',
    language: 'en',
  },
  {
    id: 'amazon-flutter-appstore-iap',
    title: 'Adding IAP to Flutter Apps for Amazon Appstore',
    url: 'https://dev.to/amazonappdev/adding-iap-to-flutter-apps-for-amazon-appstore-45jc',
    ecosystems: ['flutter'],
    type: 'article',
    sourceKind: 'company',
    organization: 'Amazon Developer Community',
    platform: 'DEV Community',
    publishedAt: '2023-06-02',
    summary:
      'An Amazon Appstore guide to adding in-app purchases to Flutter applications with flutter_inapp_purchase.',
    language: 'en',
  },
  {
    id: 'logrocket-flutter-purchasing',
    title: '3 Ways to Implement Flutter In-App Purchasing',
    url: 'https://blog.logrocket.com/flutter-in-app-purchase-subscription-capability/',
    ecosystems: ['flutter'],
    type: 'article',
    sourceKind: 'company',
    organization: 'LogRocket',
    platform: 'LogRocket Blog',
    publishedAt: '2022-03-29',
    summary:
      'A comparison of common Flutter purchase approaches, including flutter_inapp_purchase for products and subscriptions.',
    language: 'en',
  },
  {
    id: 'flutter-gems-package-listing',
    title: 'flutter_inapp_purchase Package',
    url: 'https://fluttergems.dev/packages/flutter_inapp_purchase/',
    ecosystems: ['flutter'],
    type: 'documentation',
    sourceKind: 'independent',
    organization: 'Flutter Gems',
    platform: 'Package Directory',
    publishedAt: '2026-05-18',
    dateLabel: 'Updated',
    summary:
      'A focused ecosystem listing for flutter_inapp_purchase with package metadata and related Flutter resources.',
    language: 'en',
  },
  {
    id: 'bosc-flutter-subscriptions',
    title: 'Implement Subscriptions In-App Purchase in Flutter',
    url: 'https://medium.com/bosc-tech-labs-private-limited/how-to-implement-subscriptions-in-app-purchase-in-flutter-7ce8906e608a',
    ecosystems: ['flutter'],
    type: 'article',
    sourceKind: 'company',
    author: 'Varun Kamani',
    organization: 'BOSC Tech Labs',
    platform: 'Medium',
    publishedAt: '2020-10-05',
    summary:
      'A company engineering tutorial on implementing subscription purchases in Flutter.',
    language: 'en',
  },
  {
    id: 'nikhil-flutter-firebase-purchases',
    title: 'Working with In-App Purchases in Flutter and Firebase',
    url: 'https://nikhhil.medium.com/working-with-in-app-purchases-in-flutter-and-firebase-non-consumable-3cd494a08ebf',
    ecosystems: ['flutter'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Nikhil',
    platform: 'Medium',
    publishedAt: '2020-07-19',
    summary:
      'A tutorial on non-consumable Flutter purchases backed by Firebase.',
    language: 'en',
  },
  {
    id: 'samarth-flutter-purchases',
    title: 'In-App Purchases in Flutter',
    url: 'https://medium.com/@samarth_agarwal/in-app-purchases-in-flutter-f9ca7ee9e2ce',
    ecosystems: ['flutter'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Samarth Agarwal',
    platform: 'Medium',
    publishedAt: '2019-04-02',
    summary:
      'A community introduction to product configuration and purchase handling in Flutter.',
    language: 'en',
  },
  {
    id: 'vignesh-flutter-purchase',
    title: 'Flutter In-App Purchase',
    url: 'https://vignesh-prakash.medium.com/flutter-in-app-purchase-2927731e5a6f',
    ecosystems: ['flutter'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Vignesh Prakash',
    platform: 'Medium',
    publishedAt: '2020-08-22',
    summary:
      'A practical Flutter in-app purchase implementation guide using flutter_inapp_purchase.',
    language: 'en',
  },
  {
    id: 'nhan-flutter-subscription-config',
    title: 'Flutter IAP Subscription Config',
    url: 'https://nhancv.medium.com/flutter-iap-subscription-config-3fb339a163f',
    ecosystems: ['flutter'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Nhan Cao',
    platform: 'Medium',
    publishedAt: '2020-12-13',
    summary:
      'A focused guide to configuring subscription products for a Flutter purchase flow.',
    language: 'en',
  },
  {
    id: 'solar-moon-flutter-no-backend',
    title: 'In-App Purchases Without Backend Validation in Flutter',
    url: 'https://medium.com/@s0larm00n/in-app-purchases-without-backend-validation-in-flutter-aa9d976c7797',
    ecosystems: ['flutter'],
    type: 'article',
    sourceKind: 'independent',
    author: 'SolarMoon',
    platform: 'Medium',
    publishedAt: '2024-11-22',
    summary:
      'A client-side Flutter purchase walkthrough for projects evaluating a flow without backend validation.',
    language: 'en',
  },
  {
    id: 'jaimil-flutter-subscription-no-backend',
    title: 'Purchase Subscription Without Backend in Flutter',
    url: 'https://medium.com/@jaimil.dev8819/purchase-subscription-without-backend-in-flutter-6f22aead77ea',
    ecosystems: ['flutter'],
    type: 'article',
    sourceKind: 'independent',
    author: 'Jaimil',
    platform: 'Medium',
    publishedAt: '2023-09-29',
    summary:
      'A community tutorial for wiring a Flutter subscription purchase flow without a separate backend.',
    language: 'en',
  },
];
