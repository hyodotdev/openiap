# Expo IAP Examples - Best Practice Implementations

This example app demonstrates the **expo-iap** library's best practice implementations using **expo-router**. The examples showcase TypeScript-first approaches to in-app purchases.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Purchase Verification

Create the ignored environment file before testing IAPKit:

```bash
cp .env.example .env
```

For hosted IAPKit, get an `openiap-kit_pk_` publishable key from the [IAPKit dashboard](https://kit.openiap.dev) and set it as `EXPO_PUBLIC_IAPKIT_API_KEY`. Expo embeds every `EXPO_PUBLIC_*` value in the app, so never use an `openiap-kit_sk_` secret admin key. For **Local (IAPKit)**, the publishable key and local server must target the same Convex deployment. Also set `EXPO_PUBLIC_IAPKIT_BASE_URL` to the device-reachable HTTP(S) origin only; do not append `/v1/purchase/verify`. Set `EXPO_PUBLIC_AMAZON_RVS_SANDBOX=true` only for Amazon App Tester receipts after enabling the matching sandbox option in the IAPKit project settings. A physical iPhone must use the Mac's LAN address. An Android device connected over USB can use `http://127.0.0.1:3100`: inspect `adb -s "$ANDROID_SERIAL" reverse --list`, reuse an exact `tcp:3100` mapping when present, or create it with `adb -s "$ANDROID_SERIAL" reverse --no-rebind tcp:3100 tcp:3100`. Record whether this run created the rule and remove only that rule during cleanup; if `--no-rebind` fails, use another port instead of overwriting an existing mapping.

The Vega build scripts load the same Expo environment-file chain as the normal
Expo CLI: Debug uses `.env.development.local`, `.env.local`,
`.env.development`, then `.env`; Release uses the corresponding `production`
files. Values already exported in the shell take precedence. Keep local keys in
an ignored `.env.local` file and rebuild the VPK after changing them:

```bash
bun run build:vega:debug
VEGA_DEVICE_ID=<device-id> bun run run:vega:firetv
```

The purchase and subscription screens list verification in this order:

1. **Local (Device)** — direct Apple/Google verification on the device.
2. **Local (IAPKit)** — IAPKit provider routed to the configured local origin.
3. **IAPKit** — hosted IAPKit; the local URL is deliberately omitted.
4. **None (Skip)** — skip verification.

With both values configured, the example defaults to **Local (IAPKit)**. With only the key, it defaults to hosted **IAPKit**; without a key, it defaults to **None (Skip)**.

## 📱 Example Structure

This example provides two focused implementations, each demonstrating best practices for specific use cases:

### 🛒 **Purchase Flow** (`/purchase-flow`)

- **What**: Complete implementation for one-time in-app products
- **Why**: Demonstrates TypeScript-first approach for product purchases
- **Features**:
  - Automatic TypeScript type inference - no manual casting required
  - Platform-agnostic property access using type guards
  - Focused on one-time purchases (products)
  - Clean error handling with proper types

### 🔄 **Subscription Flow** (`/subscription-flow`)

- **What**: Complete implementation for recurring subscription products
- **Why**: Demonstrates TypeScript-first approach for subscription management
- **Features**:
  - Automatic TypeScript type inference - no manual casting required
  - Platform-agnostic subscription handling
  - Subscription-specific pricing and period display
  - Auto-renewal state management
  - Clean error handling with proper types

### ✅ **No Manual Type Casting**

```typescript
// ❌ OLD WAY - Manual casting required
const result = await requestPurchase(...) as ProductPurchaseIos;

// ✅ NEW WAY - Automatic type inference
const result = await requestPurchase({
  request: { sku: 'product.id' },
  type: 'in-app'
});
// TypeScript automatically knows the correct return type!
```

### 🔄 **Universal Cross-Platform API**

```typescript
// Works on both iOS and Android without platform checks
const result = await requestPurchase({
  request: {
    sku: 'product.id', // Universal property
    quantity: 1, // iOS-specific (ignored on Android)
  },
  type: 'in-app',
});
```

### 🛡️ **Type-Safe Error Handling**

```typescript
// Enhanced API with automatic type guards
if (isAndroidPurchaseArray(result)) {
  // TypeScript knows this is ProductPurchaseAndroid[]
  const purchase = result[0];
  console.log(
    'Android token available:',
    Boolean(purchase.purchaseTokenAndroid),
  );
} else if (isIosPurchase(result)) {
  // TypeScript knows this is ProductPurchaseIos
  console.log('iOS Transaction ID:', result.transactionId);
}
```

## 💎 TypeScript-First Development

These examples demonstrate modern TypeScript-first development patterns:

- **Focused Architecture**: Separate examples for products and subscriptions
- **Type Safety**: Automatic inference eliminates manual casting
- **Platform Agnostic**: Works seamlessly on iOS and Android
- **Best Practices**: Modern TypeScript development patterns

## 🏗️ Architecture

```
example/
├── App.tsx                 # Expo Router root
├── app/
│   ├── _layout.tsx        # Navigation stack
│   ├── index.tsx          # Landing page with navigation
│   ├── purchase-flow.tsx  # In-app products implementation
│   └── subscription-flow.tsx # Subscription implementation
└── README.md              # This file
```

## 📖 Key Learning Points

1. **TypeScript Inference**: See how expo-iap eliminates manual type casting
2. **Focused Examples**: Separate implementations for products vs subscriptions
3. **Error Handling**: Proper error handling with type-safe patterns
4. **Platform Abstraction**: Cross-platform code without conditional logic

## 🚀 Next Steps

After running these examples:

1. **Start with Purchase Flow** - Learn basic product purchase implementation
2. **Explore Subscription Flow** - Understand subscription-specific patterns
3. Replace the sample product/subscription IDs with your actual store IDs
4. Configure your app store products and subscriptions
5. Implement the patterns in your own app
6. Test on both iOS and Android to see the unified behavior

## 📝 Development Standards

These examples follow modern TypeScript development best practices:

- ✅ TypeScript-first development with strict type safety
- ✅ Function overloads for better IntelliSense
- ✅ Discriminated unions for platform-specific handling
- ✅ Result pattern for error handling
- ✅ Immutable parameter objects with readonly properties
- ✅ Clear documentation with JSDoc comments
- ✅ Performance-optimized patterns

---

**Happy coding!** 🎉 These examples demonstrate the power of TypeScript-first in-app purchase implementation with expo-iap.
