import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function Purchase() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Purchase"
        description="Handle in-app purchases with proper transaction management - setup, purchase flow, validation, and completion."
        path="/docs/features/purchase"
        keywords="purchase flow, in-app purchase, transaction management"
      />
      <h1>Purchase</h1>
      <p>
        Handle in-app purchases with proper transaction management. This guide
        covers the complete purchase flow from setup to completion.
      </p>

      <section>
        <AnchorLink id="purchase-flow-overview" level="h2">
          Purchase Flow Overview
        </AnchorLink>
        <p>A complete purchase flow follows these steps:</p>
        <ol>
          <li>
            <strong>Setup Listeners</strong> - Register callbacks before any
            purchase
          </li>
          <li>
            <strong>Fetch Products</strong> - Get available products from the
            store
          </li>
          <li>
            <strong>Request Purchase</strong> - Initiate the purchase UI
          </li>
          <li>
            <strong>Handle Listener Callback</strong> - Receive success or error
            from listener
          </li>
          <li>
            <strong>Verify Purchase</strong> - Validate with your backend or
            IAPKit
          </li>
          <li>
            <strong>Finish Transaction</strong> - Complete the transaction
          </li>
        </ol>

        <Callout kind="warning" title="Critical">
          <p>
            You must complete all steps in order. Skipping verification or
            failing to finish transactions will cause issues:
          </p>
          <ul>
            <li>
              Android: Purchases refunded after 3 days if not acknowledged
            </li>
            <li>iOS: Transaction replays on every app launch</li>
            <li>Both: Users cannot repurchase consumables</li>
          </ul>
        </Callout>
      </section>

      <section>
        <AnchorLink id="setup-purchase-listeners" level="h2">
          Setup Purchase Listeners
        </AnchorLink>
        <p>
          Register purchase listeners <strong>before</strong> making any
          purchase requests. These listeners handle successful purchases and
          errors.
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// expo-iap
import { useEffect, useCallback } from 'react';
import {
  initConnection,
  endConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
  type PurchaseError,
} from 'expo-iap';
// Same API in react-native-iap:
// import {
//   initConnection,
//   endConnection,
//   purchaseUpdatedListener,
//   purchaseErrorListener,
//   type Purchase,
//   type PurchaseError,
// } from 'react-native-iap';

function App() {
  useEffect(() => {
    let purchaseUpdateSubscription: ReturnType<typeof purchaseUpdatedListener>;
    let purchaseErrorSubscription: ReturnType<typeof purchaseErrorListener>;

    const init = async () => {
      // 1. Initialize connection first
      const connected = await initConnection();
      if (!connected) throw new Error('Store connection failed');

      // 2. Setup purchase success listener
      purchaseUpdateSubscription = purchaseUpdatedListener((purchase) => {
        console.log('Purchase received:', purchase.productId);
        // Handle the purchase (verify + finish)
        void handlePurchase(purchase).catch((error) => {
          console.warn('Purchase processing failed:', error);
        });
      });

      // 3. Setup error listener
      purchaseErrorSubscription = purchaseErrorListener((error) => {
        console.warn('Purchase error:', error);
        handlePurchaseError(error);
      });
    };

    void init().catch((error) => {
      console.warn('Store initialization failed:', error);
    });

    // Cleanup on unmount
    return () => {
      purchaseUpdateSubscription?.remove();
      purchaseErrorSubscription?.remove();
      void endConnection().catch((error) => {
        console.warn('Store teardown failed:', error);
      });
    };
  }, []);

  return <YourAppContent />;
}

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP handles connection, listener wiring, and cleanup for you. Pass
// onPurchaseSuccess / onPurchaseError to receive the same callbacks.
import { useIAP } from 'expo-iap';

function AppWithHook() {
  useIAP({
    onPurchaseSuccess: (purchase) => {
      void handlePurchase(purchase).catch((error) => {
        console.warn('Purchase processing failed:', error);
      });
    },
    onPurchaseError: (error) => {
      handlePurchaseError(error);
    },
  });

  return <YourAppContent />;
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap
import SwiftUI

@MainActor
class PurchaseManager: ObservableObject {
    private let iapStore = OpenIapStore()

    init() {
        setupListeners()
    }

    private func setupListeners() {
        // 1. Setup purchase success callback
        iapStore.onPurchaseSuccess = { [weak self] purchase in
            print("Purchase received: \\(purchase.productId)")
            Task {
                await self?.handlePurchase(purchase)
            }
        }

        // 2. Setup error callback
        iapStore.onPurchaseError = { [weak self] error in
            print("Purchase error: \\(error.localizedDescription)")
            self?.handlePurchaseError(error)
        }

        // 3. Initialize connection
        Task {
            do {
                try await iapStore.initConnection()
                print("Store connection established")
            } catch {
                print("Failed to connect: \\(error.localizedDescription)")
            }
        }
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*
import dev.hyo.openiap.store.OpenIapStore
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class PurchaseManager(
    private val context: Context,
    private val lifecycleScope: CoroutineScope
) {
    private val iapStore = OpenIapStore(context)

    init {
        setupListeners()
    }

    private fun setupListeners() {
        // 1. Collect purchase updates using Flow
        lifecycleScope.launch {
            iapStore.currentPurchase.collect { purchase ->
                if (purchase != null) {
                    println("Purchase received: \${purchase.productId}")
                    handlePurchase(purchase)
                }
            }
        }

        // 2. Collect error updates
        lifecycleScope.launch {
            iapStore.status.collect { status ->
                status.lastError?.let { error ->
                    println("Purchase error: \${error.message}")
                    handlePurchaseError(error)
                }
            }
        }

        // 3. Initialize connection
        lifecycleScope.launch {
            try {
                val connected = iapStore.initConnection()
                if (connected) {
                    println("Store connection established")
                }
            } catch (e: Exception) {
                println("Failed to connect: \${e.message}")
            }
        }
    }
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.openiap.*
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class PurchaseManager(
    private val context: Context,
    private val lifecycleScope: CoroutineScope
) {
    private val kmpIAP = KmpIAP()

    init {
        setupListeners()
    }

    private fun setupListeners() {
        // 1. Collect purchase updates using Flow
        lifecycleScope.launch {
            kmpIAP.purchaseUpdatedListener.collect { purchase ->
                println("Purchase received: \${purchase.productId}")
                handlePurchase(purchase)
            }
        }

        // 2. Collect error updates
        lifecycleScope.launch {
            kmpIAP.purchaseErrorListener.collect { error ->
                println("Purchase error: \${error.message}")
                handlePurchaseError(error)
            }
        }

        // 3. Initialize connection
        lifecycleScope.launch {
            try {
                val connected = kmpIAP.initConnection()
                if (connected) {
                    println("Store connection established")
                }
            } catch (e: Exception) {
                println("Failed to connect: \${e.message}")
            }
        }
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'dart:async';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

class PurchaseManager {
  final FlutterInappPurchase _iap = FlutterInappPurchase.instance;
  StreamSubscription<Purchase>? _purchaseSubscription;
  StreamSubscription<PurchaseError>? _errorSubscription;

  Future<void> initialize() async {
    // 1. Initialize connection first
    await _iap.initConnection();

    // 2. Setup purchase success listener
    _purchaseSubscription = _iap.purchaseUpdatedListener.listen((purchase) {
      print('Purchase received: \${purchase.productId}');
      _handlePurchase(purchase);
    });

    // 3. Setup error listener
    _errorSubscription = _iap.purchaseErrorListener.listen((error) {
      print('Purchase error: \${error.message}');
      _handlePurchaseError(error);
    });
  }

  void dispose() {
    _purchaseSubscription?.cancel();
    _errorSubscription?.cancel();
    _iap.endConnection();
  }
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

sealed class PurchaseManager : IDisposable
{
    private readonly IOpenIap iap = OpenIapClient.Instance;
    private readonly IDisposable purchaseSubscription;
    private readonly IDisposable errorSubscription;

    public PurchaseManager()
    {
        purchaseSubscription = iap.PurchaseUpdated.Subscribe(purchase =>
            HandlePurchaseAsync(purchase));
        errorSubscription = iap.PurchaseError.Subscribe(HandlePurchaseError);
    }

    public async Task InitializeAsync() =>
        await ((MutationResolver)iap).InitConnectionAsync();

    public void Dispose()
    {
        purchaseSubscription.Dispose();
        errorSubscription.Dispose();
    }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`extends Node

var iap: OpenIap

func _ready() -> void:
    setup_listeners()

func setup_listeners() -> void:
    # 1. Setup purchase success listener
    iap.purchase_updated.connect(_on_purchase_received)

    # 2. Setup error listener
    iap.purchase_error.connect(_on_purchase_error)

    # 3. Initialize connection
    var connected = await iap.init_connection(null)
    if connected:
        print("Store connection established")

func _on_purchase_received(purchase: Purchase) -> void:
    print("Purchase received: %s" % purchase.product_id)
    handle_purchase(purchase)

func _on_purchase_error(error: PurchaseError) -> void:
    print("Purchase error: %s" % error.message)
    handle_purchase_error(error)

func _exit_tree() -> void:
    await iap.end_connection()`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="request-purchase" level="h2">
          Request Purchase
        </AnchorLink>
        <p>
          After setting up listeners, you can request purchases. The purchase
          request triggers the native store UI (App Store / Google Play).
        </p>

        <Callout kind="important" title="Terminology">
          APIs starting with <code>request</code> are{' '}
          <strong>event-based</strong> operations, not promise-based. Do not
          rely on their return values for actual purchase results — instead,
          listen for events through{' '}
          <Link to="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </Link>{' '}
          or{' '}
          <Link to="/docs/events/purchase-error-listener">
            <code>purchaseErrorListener</code>
          </Link>
          . See{' '}
          <Link to="/docs/apis/fetch-products#request-apis">
            API Terminology
          </Link>{' '}
          for details.
        </Callout>

        <AnchorLink id="request-purchase-consumable" level="h3">
          Consumable / Non-Consumable Products
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// expo-iap
import { requestPurchase } from 'expo-iap';
// Same API in react-native-iap:
// import { requestPurchase } from 'react-native-iap';

// Purchase a one-time product (consumable or non-consumable)
const purchaseProduct = async (productId: string) => {
  try {
    await requestPurchase({
      request: {
        apple: { sku: productId },
        google: { skus: [productId] },
      },
      type: 'in-app', // 'in-app' for consumables/non-consumables
    });
    // Purchase result will be delivered to purchaseUpdatedListener
  } catch (error) {
    console.error('Purchase request failed:', error);
  }
};

// Example usage
await purchaseProduct('com.app.coins_100');

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
import { useIAP } from 'expo-iap';

function BuyButton({ productId }: { productId: string }) {
  const { connected, requestPurchase } = useIAP();

  return (
    <Button
      title="Buy"
      disabled={!connected}
      onPress={() => {
        void requestPurchase({
          request: {
            apple: { sku: productId },
            google: { skus: [productId] },
          },
          type: 'in-app',
        }).catch((error) => {
          console.warn('Purchase dispatch failed', error);
        });
      }}
    />
  );
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

@MainActor
func purchaseProduct(productId: String) async {
    let iapStore = OpenIapStore()

    do {
        // Request purchase - result delivered to onPurchaseSuccess
        _ = try await iapStore.requestPurchase(
            sku: productId,
            type: .inApp,  // .inApp for consumables/non-consumables
            autoFinish: false  // We'll finish manually after verification
        )
    } catch {
        print("Purchase request failed: \\(error.localizedDescription)")
    }
}

// Example usage
await purchaseProduct(productId: "com.app.coins_100")`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*
import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.utils.toPurchaseInput

suspend fun purchaseProduct(productId: String) {
    try {
        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(
                        skus = listOf(productId)
                    )
                )
            ),
            type = ProductQueryType.InApp  // InApp for consumables/non-consumables
        )

        // Request purchase - result delivered to currentPurchase flow
        iapStore.requestPurchase(props)
    } catch (e: Exception) {
        println("Purchase request failed: \${e.message}")
    }
}

// Example usage
purchaseProduct("com.app.coins_100")`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.openiap.*

suspend fun purchaseProduct(productId: String) {
    try {
        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(
                        skus = listOf(productId)
                    )
                )
            ),
            type = ProductQueryType.InApp  // InApp for consumables/non-consumables
        )

        // Request purchase - result delivered to currentPurchase flow
        kmpIAP.requestPurchase(props)
    } catch (e: Exception) {
        println("Purchase request failed: \${e.message}")
    }
}

// Example usage
purchaseProduct("com.app.coins_100")`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

Future<void> purchaseProduct(String productId) async {
  final iap = FlutterInappPurchase.instance;

  try {
    // Result is delivered to purchaseUpdatedListener.
    await iap.requestPurchase(
      RequestPurchaseProps.inApp((
        apple: RequestPurchaseIosProps(sku: productId),
        google: RequestPurchaseAndroidProps(skus: [productId]),
      )),
    );
  } catch (e) {
    print('Purchase request failed: $e');
  }
}

// Example usage
await purchaseProduct('com.app.coins_100');`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

async Task PurchaseProductAsync(string productId)
{
    var mutate = (MutationResolver)OpenIapClient.Instance;
    await mutate.RequestPurchaseAsync(new RequestPurchaseProps
    {
        RequestPurchase = new RequestPurchasePropsByPlatforms
        {
            Apple = new RequestPurchaseIosProps { Sku = productId },
            Google = new RequestPurchaseAndroidProps
            {
                Skus = new[] { productId },
            },
        },
        Type = ProductQueryType.InApp,
    });
}

await PurchaseProductAsync("com.app.coins_100");`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Purchase a one-time product (consumable or non-consumable)
func purchase_product(product_id: String) -> void:
    var props = RequestPurchaseProps.new()
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.apple = RequestPurchaseIosProps.new()
    props.request.apple.sku = product_id
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = [product_id]
    props.type = ProductQueryType.IN_APP  # IN_APP for consumables/non-consumables

    # Purchase result will be delivered to purchase_updated signal
    await iap.request_purchase(props)

# Example usage
await purchase_product("com.app.coins_100")`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="verify-purchase" level="h2">
          Verify Purchase with Your Backend
        </AnchorLink>
        <p>
          <strong>Always verify purchases with a trusted verifier.</strong>{' '}
          Client-side store state alone can be bypassed. Use your networking
          layer to send purchase data to your own backend, or use the IAPKit
          section below when you want OpenIAP&apos;s managed validation backend
          to do that work. The generated <code>verifyPurchase</code> API accepts
          platform verification options, not a Purchase object plus a server
          URL.
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// expo-iap
import type { Purchase } from 'expo-iap';
import { Platform } from 'react-native';
// Same Purchase type is exported from react-native-iap.

const verifyOnServer = async (purchase: Purchase) => {
  // yourBackend is your authenticated networking client.
  const result = await yourBackend.verifyPurchase({
    platform: Platform.OS,
    productId: purchase.productId,
    purchaseToken: purchase.purchaseToken,
  });

  if (result.isValid) {
    console.log('Purchase verified!');
    return true;
  }

  console.error('Verification failed');
  return false;
};

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
import { useIAP } from 'expo-iap';

function PurchaseScreen() {
  useIAP({
    onPurchaseSuccess: (purchase) => {
      void verifyOnServer(purchase)
        .then((verified) => {
          if (!verified) console.error('Verification failed');
        })
        .catch((error) => console.warn('Verification failed:', error));
    },
  });

  return null;
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

func verifyOnServer(_ purchase: PurchaseIOS) async -> Bool {
    do {
        // yourBackend is your authenticated networking client.
        return try await yourBackend.verifyApplePurchase(
            productId: purchase.productId,
            jws: purchase.purchaseToken ?? ""
        )
    } catch {
        print("Verification error: \\(error.localizedDescription)")
        return false
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*

suspend fun verifyOnServer(purchase: PurchaseAndroid): Boolean {
    return try {
        // yourBackend is your authenticated networking client.
        yourBackend.verifyGooglePurchase(
            productId = purchase.productId,
            purchaseToken = requireNotNull(purchase.purchaseToken)
        )
    } catch (e: Exception) {
        println("Verification error: \${e.message}")
        false
    }
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.*

suspend fun verifyOnServer(purchase: PurchaseAndroid): Boolean {
    return try {
        // yourBackend is your authenticated shared networking client.
        yourBackend.verifyGooglePurchase(
            productId = purchase.productId,
            purchaseToken = requireNotNull(purchase.purchaseToken)
        )
    } catch (e: Exception) {
        println("Verification error: \${e.message}")
        false
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

Future<bool> verifyOnServer(Purchase purchase) async {
  try {
    // yourBackend is your authenticated networking client.
    return await yourBackend.verifyPurchase(
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
    );
  } catch (e) {
    print('Verification error: $e');
    return false;
  }
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using System.Net.Http.Json;
using OpenIap;

async Task<bool> VerifyOnServerAsync(Purchase purchase)
{
    using var http = new HttpClient();
    var response = await http.PostAsJsonAsync(
        "https://your-server.com/api/verify",
        new { purchase.ProductId, purchase.PurchaseToken });
    if (!response.IsSuccessStatusCode) return false;

    var result = await response.Content.ReadFromJsonAsync<VerificationResponse>();
    return result?.IsValid == true;
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func verify_on_server(purchase: Dictionary) -> bool:
    # your_backend is your authenticated HTTP client/autoload.
    var result = await your_backend.verify_purchase({
        "productId": purchase.get("productId", ""),
        "purchaseToken": purchase.get("purchaseToken", ""),
        "platform": OS.get_name()
    })
    return result.get("isValid", false)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <Callout kind="note" title="Server-Side Implementation">
          For detailed server-side verification implementation (JWS verification
          for iOS, Google Play API for Android), see the{' '}
          <a href="/tutorials#verify-purchase">Verify Purchase tutorials</a>.
        </Callout>

        <Callout kind="warning" title="Security Best Practices">
          <ul>
            <li>
              Never rely only on local StoreKit or Play Billing client state
            </li>
            <li>Store purchase records in your database</li>
            <li>
              Implement idempotency to handle duplicate verification requests
            </li>
            <li>Use HTTPS for all server communication</li>
            <li>
              Keep service account credentials secure (never in client code)
            </li>
          </ul>
        </Callout>
      </section>

      <section>
        <AnchorLink id="verify-purchase-iapkit" level="h2">
          Verify Purchase with IAPKit
        </AnchorLink>
        <p>
          Don&apos;t want to implement store receipt verification yourself?{' '}
          <a
            href="https://kit.openiap.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            IAPKit
          </a>{' '}
          is a hosted purchase verification service that validates App Store,
          Google Play, Amazon Appstore, and Meta Horizon purchases for you. Use{' '}
          <code>verifyPurchaseWithProvider</code> with the{' '}
          <code>&apos;iapkit&apos;</code> provider and pass the
          platform-specific token or receipt payload. Fire OS and Vega OS use{' '}
          <code>iapkit.amazon</code> with the Amazon receipt id, and no
          app-owned Amazon RVS server is required. If your own backend serves
          protected paid resources, have that backend authenticate the user and
          query IAPKit before serving them; direct app-to-IAPKit calls are fine
          for in-app or local feature unlocks, but they cannot authorize backend
          resources by themselves. In either case, require the returned
          store-verified <code>productId</code> to be present and match the
          product your app expected; <code>isValid</code> alone is not enough.
        </p>

        <p>
          For Amazon, include <code>expectedProductId</code> in the verification
          payload. Amazon App Tester receipts require enabling{' '}
          <strong>Allow Amazon App Tester / RVS Cloud Sandbox</strong> in the
          IAPKit project before passing <code>sandbox: true</code>. Handled
          Amazon results report exactly <code>'Sandbox'</code> or{' '}
          <code>'Production'</code> in <code>environment</code>; require the
          value expected by the build.
        </p>

        <Callout kind="note" title="Get a project key">
          Sign up at{' '}
          <a
            href="https://kit.openiap.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            kit.openiap.dev
          </a>{' '}
          to obtain an <code>openiap-kit_pk_</code> publishable key. You can
          pass it directly, or configure it once in your app (Expo extra,
          Info.plist, AndroidManifest, etc.) so the SDK picks it up
          automatically. Never use an <code>openiap-kit_sk_</code> secret key in
          app code.
        </Callout>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// expo-iap
import { Platform } from 'react-native';
import { verifyPurchaseWithProvider, type Purchase } from 'expo-iap';
// Same API in react-native-iap:
// import { verifyPurchaseWithProvider, type Purchase } from 'react-native-iap';

const amazonSandbox =
  process.env.EXPO_PUBLIC_AMAZON_RVS_SANDBOX === 'true';

const iapkitPayloadFor = async (purchase: Purchase) => {
  const token = purchase.purchaseToken ?? '';
  const runtimeOS = Platform.OS as string;
  const isFireOSBuild = process.env.EXPO_PUBLIC_STORE === 'amazon';
  const isAmazonRuntime = runtimeOS === 'kepler' || isFireOSBuild;

  if (Platform.OS === 'ios') {
    return { apple: { jws: token } };
  }

  if (isAmazonRuntime) {
    return {
      amazon: {
        expectedProductId: purchase.productId,
        receiptId: token,
        sandbox: amazonSandbox,
      },
    };
  }

  return { google: { purchaseToken: token } };
};

const verifyWithIapkit = async (purchase: Purchase) => {
  const result = await verifyPurchaseWithProvider({
    provider: 'iapkit',
    iapkit: {
      // Use an openiap-kit_pk_ key. Optional when configured via app config,
      // Info.plist, or AndroidManifest.
      apiKey: process.env.EXPO_PUBLIC_IAPKIT_PUBLISHABLE_KEY,
      ...(await iapkitPayloadFor(purchase)),
    },
  });

  const verified = result.iapkit;
  const verifiedProductId = verified?.productId;
  const hasExpectedEnvironment =
    verified?.store !== 'amazon' ||
    verified?.environment === (amazonSandbox ? 'Sandbox' : 'Production');
  if (
    verified?.isValid === true &&
    hasExpectedEnvironment &&
    verifiedProductId != null &&
    verifiedProductId === purchase.productId
  ) {
    console.log('IAPKit verified:', verified.state);
    return true;
  }

  console.error('IAPKit verification failed');
  return false;
};

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
import { useIAP } from 'expo-iap';

function PurchaseScreen() {
  const { verifyPurchaseWithProvider } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void (async () => {
        const result = await verifyPurchaseWithProvider({
          provider: 'iapkit',
          iapkit: {
            apiKey: process.env.EXPO_PUBLIC_IAPKIT_PUBLISHABLE_KEY,
            ...(await iapkitPayloadFor(purchase)),
          },
        });
        const verified = result.iapkit;
        if (
          verified?.isValid !== true ||
          (verified.store === 'amazon' &&
            verified.environment !==
              (amazonSandbox ? 'Sandbox' : 'Production')) ||
          verified.productId == null ||
          verified.productId !== purchase.productId
        ) {
          console.error('IAPKit verification failed');
        }
      })().catch((error) => console.warn('IAPKit verification failed:', error));
    },
  });

  return null;
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

func verifyWithIapkit(_ purchase: PurchaseIOS) async -> Bool {
    do {
        let result = try await OpenIapModule.shared.verifyPurchaseWithProvider(
            VerifyPurchaseWithProviderProps(
                provider: .iapkit,
                iapkit: RequestVerifyPurchaseWithIapkitProps(
                    apiKey: Bundle.main.object(forInfoDictionaryKey: "IAPKitAPIKey") as? String,
                    apple: RequestVerifyPurchaseWithIapkitAppleProps(jws: purchase.purchaseToken ?? "")
                )
            )
        )

        if let verified = result.iapkit,
           verified.isValid,
           let verifiedProductId = verified.productId,
           verifiedProductId == purchase.productId {
            print("IAPKit verified: \\(verified.state.rawValue)")
            return true
        }

        print("IAPKit verification failed")
        return false
    } catch {
        print("IAPKit verification error: \\(error.localizedDescription)")
        return false
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*

suspend fun verifyWithIapkit(purchase: PurchaseAndroid): Boolean {
    return try {
        val result = module.verifyPurchaseWithProvider(
            VerifyPurchaseWithProviderProps(
                provider = PurchaseVerificationProvider.Iapkit,
                iapkit = RequestVerifyPurchaseWithIapkitProps(
                    // This BuildConfig value must be an openiap-kit_pk_ publishable key.
                    // apiKey is optional when configured via AndroidManifest meta-data.
                    apiKey = BuildConfig.IAPKIT_API_KEY,
                    google = RequestVerifyPurchaseWithIapkitGoogleProps(
                        purchaseToken = purchase.purchaseToken.orEmpty()
                    )
                    // Fire OS: replace google with amazon(expectedProductId,
                    // userId, receiptId, sandbox). App Tester needs project opt-in;
                    // handled Amazon results expose environment.
                )
            )
        )

        val verified = result.iapkit
        val verifiedProductId = verified?.productId
        if (verified?.isValid == true &&
            verifiedProductId != null &&
            verifiedProductId == purchase.productId) {
            println("IAPKit verified: \${verified.state}")
            true
        } else {
            println("IAPKit verification failed")
            false
        }
    } catch (e: Exception) {
        println("IAPKit verification error: \${e.message}")
        false
    }
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.*

suspend fun verifyWithIapkit(purchase: PurchaseAndroid): Boolean {
    return try {
        val result = kmpIAP.verifyPurchaseWithProvider(
            VerifyPurchaseWithProviderProps(
                provider = PurchaseVerificationProvider.Iapkit,
                iapkit = RequestVerifyPurchaseWithIapkitProps(
                    apiKey = AppConfig.iapkitApiKey,
                    google = RequestVerifyPurchaseWithIapkitGoogleProps(
                        purchaseToken = purchase.purchaseToken.orEmpty()
                    )
                    // Fire OS builds use amazon(expectedProductId, userId,
                    // receiptId, sandbox). App Tester needs project opt-in;
                    // handled Amazon results expose environment.
                )
            )
        )

        val verified = result.iapkit
        val verifiedProductId = verified?.productId
        if (verified?.isValid == true &&
            verifiedProductId != null &&
            verifiedProductId == purchase.productId) {
            println("IAPKit verified: \${verified.state}")
            true
        } else {
            println("IAPKit verification failed")
            false
        }
    } catch (e: Exception) {
        println("IAPKit verification error: \${e.message}")
        false
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'dart:io';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

Future<bool> verifyWithIapkit(Purchase purchase) async {
  final iap = FlutterInappPurchase.instance;

  try {
    final result = await iap.verifyPurchaseWithProvider(
      provider: PurchaseVerificationProvider.Iapkit,
      iapkit: RequestVerifyPurchaseWithIapkitProps(
        apiKey: IapConstants.iapkitApiKey,
        apple: Platform.isIOS
            ? RequestVerifyPurchaseWithIapkitAppleProps(
                jws: purchase.purchaseToken ?? '',
              )
            : null,
        google: Platform.isAndroid
            ? RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken: purchase.purchaseToken ?? '',
              )
            : null,
        // Fire OS builds can pass amazon with expectedProductId, userId,
        // receiptId, and sandbox. App Tester needs project opt-in;
        // handled Amazon results expose environment.
      ),
    );

    final verified = result.iapkit;
    final verifiedProductId = verified?.productId;
    if (verified?.isValid == true &&
        verifiedProductId != null &&
        verifiedProductId == purchase.productId) {
      print('IAPKit verified: \${verified.state}');
      return true;
    }

    print('IAPKit verification failed');
    return false;
  } catch (e) {
    print('IAPKit verification error: $e');
    return false;
  }
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

async Task<bool> VerifyWithIapkitAsync(Purchase purchase)
{
    var result = await ((MutationResolver)OpenIapClient.Instance)
        .VerifyPurchaseWithProviderAsync(new VerifyPurchaseWithProviderProps
        {
            Provider = PurchaseVerificationProvider.Iapkit,
            Iapkit = new RequestVerifyPurchaseWithIapkitProps
            {
                ApiKey = AppConfig.IapkitApiKey,
                Google = new RequestVerifyPurchaseWithIapkitGoogleProps
                {
                    PurchaseToken = purchase.PurchaseToken ?? "",
                },
            },
        });

    var verified = result.Iapkit;
    var verifiedProductId = verified?.ProductId;
    return verified?.IsValid == true &&
        verifiedProductId is not null &&
        verifiedProductId == purchase.ProductId;
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func verify_with_iapkit(purchase: Purchase) -> bool:
    var props = VerifyPurchaseWithProviderProps.new()
    props.provider = PurchaseVerificationProvider.IAPKIT
    props.iapkit = RequestVerifyPurchaseWithIapkitProps.new()
    props.iapkit.api_key = AppConfig.iapkit_api_key

    if OS.get_name() == "iOS":
        props.iapkit.apple = RequestVerifyPurchaseWithIapkitAppleProps.new()
        props.iapkit.apple.jws = purchase.purchase_token
    else:
        props.iapkit.google = RequestVerifyPurchaseWithIapkitGoogleProps.new()
        props.iapkit.google.purchase_token = purchase.purchase_token

    var result = await iap.verify_purchase_with_provider(props)

    var verified = result.iapkit
    var verified_product_id = verified.product_id if verified != null else null
    if (
        verified != null
        and verified.is_valid
        and verified_product_id != null
        and verified_product_id == purchase.product_id
    ):
        print("IAPKit verified: %s" % verified.state)
        return true

    print("IAPKit verification failed")
    return false`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <Callout kind="note" title="Endpoint">
          Requests are sent to{' '}
          <a
            href="https://kit.openiap.dev/v1/purchase/verify"
            target="_blank"
            rel="noopener noreferrer"
          >
            <code>https://kit.openiap.dev/v1/purchase/verify</code>
          </a>{' '}
          with <code>Authorization: Bearer &lt;apiKey&gt;</code>. See the{' '}
          <Link to="/docs/types/verify-purchase-with-provider-props">
            PurchaseVerificationProvider
          </Link>{' '}
          type reference for the full response shape.
        </Callout>
      </section>

      <section>
        <AnchorLink id="finish-transaction" level="h2">
          Finish Transaction
        </AnchorLink>
        <p>
          <strong>Always finish transactions after verification.</strong> This
          step is critical - unfinished transactions cause issues on both
          platforms.
        </p>

        <AnchorLink id="finish-transaction-types" level="h3">
          Transaction Types
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>isConsumable</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Consumable</td>
              <td>
                <code>true</code>
              </td>
              <td>Product can be purchased again (coins, gems, etc.)</td>
            </tr>
            <tr>
              <td>Non-Consumable</td>
              <td>
                <code>false</code>
              </td>
              <td>
                One-time purchase, cannot be bought again (premium unlock)
              </td>
            </tr>
            <tr>
              <td>Subscription</td>
              <td>
                <code>false</code>
              </td>
              <td>Recurring purchase, managed by the store</td>
            </tr>
          </tbody>
        </table>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// expo-iap
import { finishTransaction, type Purchase } from 'expo-iap';
// Same API in react-native-iap:
// import { finishTransaction, type Purchase } from 'react-native-iap';

// Complete purchase flow in listener
const handlePurchase = async (purchase: Purchase) => {
  // 1. Verify on server
  const isValid = await verifyPurchase(purchase);
  if (!isValid) {
    console.error('Invalid purchase');
    return;
  }

  // 2. Grant the product to user
  await grantProductToUser(purchase.productId);

  // 3. Finish the transaction (CRITICAL: Android auto-refunds after 3 days!)
  // - isConsumable: true = consume the purchase (can buy again)
  // - isConsumable: false = acknowledge only (one-time purchase)
  const isConsumable = purchase.productId.includes('consumable');
  await finishTransaction({ purchase, isConsumable });

  console.log('Transaction finished successfully');
};

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP exposes finishTransaction and wires the listener for you. Run the
// same verify + grant + finish flow inside onPurchaseSuccess.
import { useIAP } from 'expo-iap';

function PurchaseScreen() {
  useIAP({
    onPurchaseSuccess: (purchase) => {
      void handlePurchase(purchase).catch((error) =>
        console.warn('Purchase processing failed:', error),
      );
    },
  });

  return null;
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

// Complete purchase flow
@MainActor
func handlePurchase(_ purchase: PurchaseIOS) async {
    let iapStore = OpenIapStore()

    // 1. Verify on server
    let isValid = await verifyIOSPurchase(purchase)
    guard isValid else {
        print("Invalid purchase")
        return
    }

    // 2. Grant the product to user
    await grantProductToUser(productId: purchase.productId)

    // 3. Finish the transaction (CRITICAL: Android auto-refunds after 3 days!)
    // - isConsumable: true = consume (can buy again)
    // - isConsumable: false = acknowledge only (one-time purchase)
    let isConsumable = purchase.productId.contains("consumable")
    do {
        try await iapStore.finishTransaction(purchase: purchase, isConsumable: isConsumable)
        print("Transaction finished successfully")
    } catch {
        print("Failed to finish transaction: \\(error.localizedDescription)")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Complete purchase flow
suspend fun handlePurchase(purchase: PurchaseAndroid) {
    // 1. Verify on server
    val isValid = verifyAndroidPurchase(purchase)
    if (!isValid) {
        println("Invalid purchase")
        return
    }

    // 2. Grant the product to user
    grantProductToUser(purchase.productId)

    // 3. Finish the transaction (CRITICAL: Android auto-refunds after 3 days!)
    // - isConsumable: true = consume (can buy again)
    // - isConsumable: false = acknowledge only
    val isConsumable = purchase.productId.contains("consumable", true)
    iapStore.finishTransaction(purchase, isConsumable)

    println("Transaction finished successfully")
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`// Complete purchase flow
suspend fun handlePurchase(purchase: PurchaseAndroid) {
    // 1. Verify on server
    val isValid = verifyAndroidPurchase(purchase)
    if (!isValid) {
        println("Invalid purchase")
        return
    }

    // 2. Grant the product to user
    grantProductToUser(purchase.productId)

    // 3. Finish the transaction (CRITICAL: Android auto-refunds after 3 days!)
    // - isConsumable: true = consume (can buy again)
    // - isConsumable: false = acknowledge only
    val isConsumable = purchase.productId.contains("consumable", true)
    kmpIAP.finishTransaction(purchase, isConsumable)

    println("Transaction finished successfully")
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Complete purchase flow
Future<void> handlePurchase(Purchase purchase) async {
  final iap = FlutterInappPurchase.instance;

  // 1. Verify on server
  final isValid = await verifyPurchase(purchase);
  if (!isValid) {
    print('Invalid purchase');
    return;
  }

  // 2. Grant the product to user
  await grantProductToUser(purchase.productId);

  // 3. Finish the transaction (CRITICAL: Android auto-refunds after 3 days!)
  // - isConsumable: true = consume the purchase (can buy again)
  // - isConsumable: false = acknowledge only (one-time purchase)
  final isConsumable = purchase.productId.contains('consumable');
  await iap.finishTransaction(
    purchase: purchase,
    isConsumable: isConsumable,
  );

  print('Transaction finished successfully');
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`// Complete purchase flow
async Task HandlePurchaseAsync(Purchase purchase)
{
    // 1. Verify on server
    var isValid = await VerifyOnServerAsync(purchase);
    if (!isValid)
    {
        Console.WriteLine("Invalid purchase");
        return;
    }

    // 2. Grant the product to user
    await GrantProductToUserAsync(purchase.ProductId);

    // 3. Finish the transaction (CRITICAL: Android auto-refunds after 3 days!)
    var isConsumable = purchase.ProductId.Contains(
        "consumable", StringComparison.OrdinalIgnoreCase);
    await ((MutationResolver)OpenIapClient.Instance).FinishTransactionAsync(
        new PurchaseInput(purchase),
        isConsumable);

    Console.WriteLine("Transaction finished successfully");
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Complete purchase flow in listener
func handle_purchase(purchase: Purchase) -> void:
    # 1. Verify on server
    var is_valid = await verify_on_server(purchase)
    if not is_valid:
        print("Invalid purchase")
        return

    # 2. Grant the product to user
    await grant_product_to_user(purchase.product_id)

    # 3. Finish the transaction (CRITICAL: Android auto-refunds after 3 days!)
    # - is_consumable: true = consume the purchase (can buy again)
    # - is_consumable: false = acknowledge only (one-time purchase)
    var is_consumable = "consumable" in purchase.product_id
    await iap.finish_transaction(purchase, is_consumable)

    print("Transaction finished successfully")`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="complete-example" level="h2">
          Complete Example
        </AnchorLink>
        <p>Here's a complete implementation combining all steps:</p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// expo-iap
import { useEffect, useCallback, useState } from 'react';
import {
  initConnection,
  endConnection,
  fetchProducts,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type Product,
  type Purchase,
  type PurchaseError,
} from 'expo-iap';
// Same API in react-native-iap:
// import {
//   initConnection,
//   endConnection,
//   fetchProducts,
//   purchaseUpdatedListener,
//   purchaseErrorListener,
//   finishTransaction,
//   type Product,
//   type Purchase,
//   type PurchaseError,
// } from 'react-native-iap';

const PRODUCT_IDS = ['com.app.premium', 'com.app.coins_100'];

// yourBackend is your authenticated verification client.
const verifyOnServer = (purchase: Purchase) =>
  yourBackend.verifyPurchase(purchase);

function PurchaseProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = useCallback(async (purchase: Purchase) => {
    setIsProcessing(true);

    try {
      // Step 1: Verify purchase on server
      if (!(await verifyOnServer(purchase))) {
        console.error('Purchase verification failed');
        return;
      }

      // Step 2: Grant product to user (your business logic)
      await grantProductToUser(purchase.productId);

      // Step 3: Finish transaction
      const isConsumable = purchase.productId.includes('coins');
      await finishTransaction({ purchase, isConsumable });

      console.log('Purchase completed successfully!');
    } catch (error) {
      console.error('Purchase processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleError = useCallback((error: PurchaseError) => {
    console.warn('Purchase error:', error.code, error.message);
    setIsProcessing(false);
  }, []);

  useEffect(() => {
    let purchaseSub: ReturnType<typeof purchaseUpdatedListener>;
    let errorSub: ReturnType<typeof purchaseErrorListener>;

    const init = async () => {
      const connected = await initConnection();
      if (!connected) return;

      // Fetch products
      const items = await fetchProducts({
        skus: PRODUCT_IDS,
        type: 'in-app',
      });
      setProducts((items ?? []) as Product[]);

      // Setup listeners
      purchaseSub = purchaseUpdatedListener((purchase) => {
        void handlePurchase(purchase).catch((error) => {
          console.warn('Purchase processing failed:', error);
        });
      });
      errorSub = purchaseErrorListener(handleError);
    };

    void init().catch((error) => {
      console.warn('Store initialization failed:', error);
    });

    return () => {
      purchaseSub?.remove();
      errorSub?.remove();
      void endConnection().catch((error) => {
        console.warn('Store teardown failed:', error);
      });
    };
  }, [handlePurchase, handleError]);

  return (
    <PurchaseContext.Provider value={{ products, isProcessing }}>
      {children}
    </PurchaseContext.Provider>
  );
}

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// Same flow without manual listener / connection wiring. useIAP fetches
// state into reactive arrays and forwards purchase events to the callbacks.
import { useIAP } from 'expo-iap';

function PurchaseProviderWithHook({ children }: { children: React.ReactNode }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const processPurchase = useCallback(async (purchase: Purchase) => {
    setIsProcessing(true);
    try {
      if (!(await verifyOnServer(purchase))) return;

      await grantProductToUser(purchase.productId);

      const isConsumable = purchase.productId.includes('coins');
      await finishTransaction({ purchase, isConsumable });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { connected, products, fetchProducts } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void processPurchase(purchase).catch((error) => {
        console.warn('Purchase processing failed:', error);
      });
    },
    onPurchaseError: (error) => {
      console.warn('Purchase error:', error.code, error.message);
      setIsProcessing(false);
    },
  });

  useEffect(() => {
    if (!connected) return;
    void fetchProducts({ skus: PRODUCT_IDS, type: 'in-app' }).catch((error) =>
      console.warn('Product fetch failed:', error),
    );
  }, [connected, fetchProducts]);

  return (
    <PurchaseContext.Provider value={{ products, isProcessing }}>
      {children}
    </PurchaseContext.Provider>
  );
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap
import SwiftUI

@MainActor
class PurchaseManager: ObservableObject {
    static let shared = PurchaseManager()

    @Published var products: [ProductIOS] = []
    @Published var isProcessing = false

    private let iapStore = OpenIapStore()

    init() {
        setupListeners()
        Task {
            do {
                try await iapStore.initConnection()
                try await iapStore.fetchProducts(
                    skus: ["com.app.premium", "com.app.coins_100"],
                    type: .inApp
                )
                products = iapStore.iosProducts
            } catch {
                print("Failed to fetch products: \\(error.localizedDescription)")
            }
        }
    }

    private func setupListeners() {
        iapStore.onPurchaseSuccess = { [weak self] purchase in
            guard let iosPurchase = purchase.asIOS() else { return }
            Task { @MainActor in
                await self?.handlePurchase(iosPurchase)
            }
        }

        iapStore.onPurchaseError = { [weak self] error in
            Task { @MainActor in
                self?.isProcessing = false
                print("Purchase error: \\(error.localizedDescription)")
            }
        }
    }

    func purchase(_ productId: String) async {
        isProcessing = true
        do {
            _ = try await iapStore.requestPurchase(
                sku: productId,
                type: .inApp,
                autoFinish: false
            )
        } catch {
            isProcessing = false
            print("Purchase request failed: \\(error.localizedDescription)")
        }
    }

    private func handlePurchase(_ purchase: PurchaseIOS) async {
        defer { isProcessing = false }

        // Step 1: Verify
        let isValid = await verifyIOSPurchase(purchase)
        guard isValid else {
            print("Verification failed")
            return
        }

        // Step 2: Grant product
        await grantProductToUser(productId: purchase.productId)

        // Step 3: Finish
        do {
            let isConsumable = purchase.productId.contains("coins")
            try await iapStore.finishTransaction(
                purchase: purchase,
                isConsumable: isConsumable
            )
            print("Purchase completed!")
        } catch {
            print("Failed to finish: \\(error.localizedDescription)")
        }
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.*
import dev.hyo.openiap.store.OpenIapStore
import kotlinx.coroutines.flow.*

class PurchaseManager(
    private val context: Context,
    private val scope: CoroutineScope
) {
    private val iapStore = OpenIapStore(context)

    private val _products = MutableStateFlow<List<ProductAndroid>>(emptyList())
    val products: StateFlow<List<ProductAndroid>> = _products.asStateFlow()

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    init {
        setupListeners()
        scope.launch {
            try {
                iapStore.initConnection()
                val request = ProductRequest(
                    skus = listOf("com.app.premium", "com.app.coins_100"),
                    type = ProductQueryType.InApp
                )
                val result = iapStore.fetchProducts(request)
                _products.value = (result as? FetchProductsResultProducts)
                    ?.value
                    .orEmpty()
                    .filterIsInstance<ProductAndroid>()
            } catch (e: Exception) {
                println("Failed to fetch products: \${e.message}")
            }
        }
    }

    private fun setupListeners() {
        scope.launch {
            iapStore.currentPurchase.collect { purchase ->
                if (purchase != null) {
                    handlePurchase(purchase as PurchaseAndroid)
                }
            }
        }

        scope.launch {
            iapStore.status.collect { status ->
                status.lastError?.let { error ->
                    _isProcessing.value = false
                    println("Purchase error: \${error.message}")
                }
            }
        }
    }

    fun purchase(productId: String) {
        _isProcessing.value = true
        scope.launch {
            try {
                val props = RequestPurchaseProps(
                    request = RequestPurchaseProps.Request.Purchase(
                        RequestPurchasePropsByPlatforms(
                            google = RequestPurchaseAndroidProps(skus = listOf(productId))
                        )
                    ),
                    type = ProductQueryType.InApp
                )
                iapStore.requestPurchase(props)
            } catch (e: Exception) {
                _isProcessing.value = false
                println("Purchase request failed: \${e.message}")
            }
        }
    }

    private suspend fun handlePurchase(purchase: PurchaseAndroid) {
        try {
            // Step 1: Verify
            val isValid = verifyAndroidPurchase(purchase)
            if (!isValid) {
                println("Verification failed")
                return
            }

            // Step 2: Grant product
            grantProductToUser(purchase.productId)

            // Step 3: Finish
            val isConsumable = purchase.productId.contains("coins", true)
            iapStore.finishTransaction(purchase.toPurchaseInput(), isConsumable)
            println("Purchase completed!")
        } finally {
            _isProcessing.value = false
        }
    }
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.*
import io.github.hyochan.kmpiap.openiap.*
import kotlinx.coroutines.flow.*

class PurchaseManager(
    private val context: Context,
    private val scope: CoroutineScope
) {
    private val kmpIAP = KmpIAP()

    private val _products = MutableStateFlow<List<ProductAndroid>>(emptyList())
    val products: StateFlow<List<ProductAndroid>> = _products.asStateFlow()

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    init {
        setupListeners()
        scope.launch {
            try {
                kmpIAP.initConnection()
                val request = ProductRequest(
                    skus = listOf("com.app.premium", "com.app.coins_100"),
                    type = ProductQueryType.InApp
                )
                val result = kmpIAP.fetchProducts(request)
                _products.value = (result as? FetchProductsResultProducts)
                    ?.value
                    .orEmpty()
                    .filterIsInstance<ProductAndroid>()
            } catch (e: Exception) {
                println("Failed to fetch products: \${e.message}")
            }
        }
    }

    private fun setupListeners() {
        scope.launch {
            kmpIAP.purchaseUpdatedListener.collect { purchase ->
                handlePurchase(purchase as PurchaseAndroid)
            }
        }

        scope.launch {
            kmpIAP.purchaseErrorListener.collect { error ->
                _isProcessing.value = false
                println("Purchase error: \${error.message}")
            }
        }
    }

    fun purchase(productId: String) {
        _isProcessing.value = true
        scope.launch {
            try {
                val props = RequestPurchaseProps(
                    request = RequestPurchaseProps.Request.Purchase(
                        RequestPurchasePropsByPlatforms(
                            google = RequestPurchaseAndroidProps(skus = listOf(productId))
                        )
                    ),
                    type = ProductQueryType.InApp
                )
                kmpIAP.requestPurchase(props)
            } catch (e: Exception) {
                _isProcessing.value = false
                println("Purchase request failed: \${e.message}")
            }
        }
    }

    private suspend fun handlePurchase(purchase: PurchaseAndroid) {
        try {
            // Step 1: Verify
            val isValid = verifyAndroidPurchase(purchase)
            if (!isValid) {
                println("Verification failed")
                return
            }

            // Step 2: Grant product
            grantProductToUser(purchase.productId)

            // Step 3: Finish
            val isConsumable = purchase.productId.contains("coins", true)
            kmpIAP.finishTransaction(purchase.toPurchaseInput(), isConsumable)
            println("Purchase completed!")
        } finally {
            _isProcessing.value = false
        }
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

class PurchaseManager extends ChangeNotifier {
  final FlutterInappPurchase _iap = FlutterInappPurchase.instance;

  List<Product> products = [];
  bool isProcessing = false;

  StreamSubscription<Purchase>? _purchaseSub;
  StreamSubscription<PurchaseError>? _errorSub;

  Future<void> initialize() async {
    await _iap.initConnection();
    products = await _iap.fetchProducts<Product>(
      skus: ['com.app.premium', 'com.app.coins_100'],
      type: ProductQueryType.InApp,
    );
    notifyListeners();
    _setupListeners();
  }

  void _setupListeners() {
    _purchaseSub = _iap.purchaseUpdatedListener.listen(_handlePurchase);

    _errorSub = _iap.purchaseErrorListener.listen((e) {
      isProcessing = false;
      notifyListeners();
      print('Purchase error: \${e.message}');
    });
  }

  Future<void> purchase(String productId) async {
    isProcessing = true;
    notifyListeners();

    try {
      await _iap.requestPurchase(
        RequestPurchaseProps.inApp((
          apple: RequestPurchaseIosProps(sku: productId),
          google: RequestPurchaseAndroidProps(skus: [productId]),
        )),
      );
    } catch (e) {
      isProcessing = false;
      notifyListeners();
      print('Purchase request failed: $e');
    }
  }

  Future<void> _handlePurchase(Purchase purchase) async {
    try {
      // Step 1: Verify
      final isValid = await _verifyPurchase(purchase);
      if (!isValid) {
        print('Verification failed');
        return;
      }

      // Step 2: Grant product
      await _grantProductToUser(purchase.productId);

      // Step 3: Finish
      final isConsumable = purchase.productId.contains('coins');
      await _iap.finishTransaction(
        purchase: purchase,
        isConsumable: isConsumable,
      );
      print('Purchase completed!');
    } finally {
      isProcessing = false;
      notifyListeners();
    }
  }

  void dispose() {
    _purchaseSub?.cancel();
    _errorSub?.cancel();
    _iap.endConnection();
    super.dispose();
  }
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

sealed class PurchaseManager : IAsyncDisposable
{
    private readonly IOpenIap iap = OpenIapClient.Instance;
    private readonly QueryResolver query;
    private readonly MutationResolver mutate;
    private readonly IDisposable purchaseSubscription;
    private readonly IDisposable errorSubscription;

    public IReadOnlyList<Product> Products { get; private set; } = [];
    public bool IsProcessing { get; private set; }

    public PurchaseManager()
    {
        query = (QueryResolver)iap;
        mutate = (MutationResolver)iap;
        purchaseSubscription = iap.PurchaseUpdated.Subscribe(
            purchase => _ = HandlePurchaseAsync(purchase));
        errorSubscription = iap.PurchaseError.Subscribe(error =>
        {
            IsProcessing = false;
            Console.WriteLine($"{error.Code}: {error.Message}");
        });
    }

    public async Task InitializeAsync()
    {
        await mutate.InitConnectionAsync();
        var result = await query.FetchProductsAsync(new ProductRequest
        {
            Skus = new[] { "com.app.premium", "com.app.coins_100" },
            Type = ProductQueryType.InApp,
        });
        Products = (result as FetchProductsResultProducts)?.Value ?? [];
    }

    public async Task PurchaseAsync(string productId)
    {
        IsProcessing = true;
        await mutate.RequestPurchaseAsync(new RequestPurchaseProps
        {
            RequestPurchase = new RequestPurchasePropsByPlatforms
            {
                Apple = new RequestPurchaseIosProps { Sku = productId },
                Google = new RequestPurchaseAndroidProps { Skus = new[] { productId } },
            },
            Type = ProductQueryType.InApp,
        });
    }

    private async Task HandlePurchaseAsync(Purchase purchase)
    {
        try
        {
            if (!await VerifyOnServerAsync(purchase)) return;
            await GrantProductToUserAsync(purchase.ProductId);
            await mutate.FinishTransactionAsync(
                new PurchaseInput(purchase),
                purchase.ProductId.Contains("coins", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            IsProcessing = false;
        }
    }

    public async ValueTask DisposeAsync()
    {
        purchaseSubscription.Dispose();
        errorSubscription.Dispose();
        await mutate.EndConnectionAsync();
    }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Complete example: Purchase Manager (Godot)
extends Node

signal products_loaded
signal processing_changed

var iap: OpenIap
var products: Array[Product] = []
var _is_processing: bool = false
var is_processing: bool:
    get:
        return _is_processing
    set(value):
        _is_processing = value
        processing_changed.emit()

const PRODUCT_IDS = ["com.app.premium", "com.app.coins_100"]

func _ready() -> void:
    setup_listeners()

    # Fetch products directly
    var request = ProductRequest.new()
    request.skus = PRODUCT_IDS
    request.type = ProductQueryType.IN_APP
    products = await iap.fetch_products(request)
    products_loaded.emit()

func setup_listeners() -> void:
    iap.purchase_updated.connect(_on_purchase_updated)
    iap.purchase_error.connect(_on_purchase_error)
    await iap.init_connection(null)

func purchase(product_id: String) -> void:
    is_processing = true

    var props = RequestPurchaseProps.new()
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.apple = RequestPurchaseIosProps.new()
    props.request.apple.sku = product_id
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = [product_id]
    props.type = ProductQueryType.IN_APP

    await iap.request_purchase(props)

func _on_purchase_updated(purchase: Purchase) -> void:
    # Step 1: Verify
    var is_valid = await verify_on_server(purchase)
    if not is_valid:
        print("Verification failed")
        is_processing = false
        return

    # Step 2: Grant product
    await grant_product_to_user(purchase.product_id)

    # Step 3: Finish
    var is_consumable = "coins" in purchase.product_id
    await iap.finish_transaction(purchase, is_consumable)
    print("Purchase completed!")
    is_processing = false

func _on_purchase_error(error: PurchaseError) -> void:
    print("Purchase error: %s" % error.message)
    is_processing = false

func _exit_tree() -> void:
    await iap.end_connection()`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="troubleshooting" level="h2">
          Troubleshooting
        </AnchorLink>

        <AnchorLink id="common-issues" level="h3">
          Common Issues
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Issue</th>
              <th>Cause</th>
              <th>Solution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Purchase replays on launch</td>
              <td>Transaction not finished</td>
              <td>
                Call{' '}
                <Link to="/docs/apis/finish-transaction">
                  <code>finishTransaction()</code>
                </Link>{' '}
                after verification
              </td>
            </tr>
            <tr>
              <td>Android purchase refunded</td>
              <td>Not acknowledged within 3 days</td>
              <td>Finish transaction immediately after verification</td>
            </tr>
            <tr>
              <td>Cannot repurchase consumable</td>
              <td>Not consumed</td>
              <td>
                Pass <code>isConsumable: true</code> to{' '}
                <Link to="/docs/apis/finish-transaction">
                  <code>finishTransaction()</code>
                </Link>
              </td>
            </tr>
            <tr>
              <td>Listener not called</td>
              <td>Listener set up after purchase</td>
              <td>Always set up listeners before any purchase request</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="pending-purchases" level="h3">
          Handling Pending Purchases
        </AnchorLink>
        <p>
          Check for pending (unfinished) purchases on app launch to complete
          interrupted transactions:
        </p>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// expo-iap
import { getAvailablePurchases } from 'expo-iap';
// Same API in react-native-iap:
// import { getAvailablePurchases } from 'react-native-iap';

const checkPendingPurchases = async () => {
  const purchases = await getAvailablePurchases();

  for (const purchase of purchases) {
    // Process each pending purchase
    await handlePurchase(purchase);
  }
};

// Call on app launch after setting up listeners
useEffect(() => {
  const init = async () => {
    await initConnection();
    // Setup listeners first...

    // Then check for pending purchases
    await checkPendingPurchases();
  };

  void init().catch((error) => {
    console.warn('Pending purchase initialization failed:', error);
  });
}, []);

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP's getAvailablePurchases() returns Promise<void> and writes into the
// reactive availablePurchases array — react to it in an effect to process
// any pending transactions found at launch.
import { useIAP } from 'expo-iap';

function PendingPurchaseHandler() {
  const { connected, availablePurchases, getAvailablePurchases } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void handlePurchase(purchase).catch((error) => {
        console.warn('Pending purchase processing failed:', error);
      });
    },
  });

  useEffect(() => {
    if (!connected) return;
    void getAvailablePurchases().catch((error) =>
      console.warn('Pending purchase lookup failed:', error),
    );
  }, [connected, getAvailablePurchases]);

  useEffect(() => {
    availablePurchases.forEach((purchase) => {
      void handlePurchase(purchase).catch((error) => {
        console.warn('Pending purchase processing failed:', error);
      });
    });
  }, [availablePurchases]);

  return null;
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`@MainActor
func checkPendingPurchases() async {
    let iapStore = OpenIapStore()

    do {
        try await iapStore.getAvailablePurchases()

        for purchase in iapStore.availablePurchases {
            // Process each pending purchase
            if let iosPurchase = purchase.asIOS() {
                await handlePurchase(iosPurchase)
            }
        }
    } catch {
        print("Failed to get pending purchases: \\(error.localizedDescription)")
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun checkPendingPurchases() {
    try {
        val purchases = iapStore.getAvailablePurchases(null)

        for (purchase in purchases) {
            // Process each pending purchase
            if (purchase is PurchaseAndroid) {
                handlePurchase(purchase)
            }
        }
    } catch (e: Exception) {
        println("Failed to get pending purchases: \${e.message}")
    }
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`suspend fun checkPendingPurchases() {
    try {
        val purchases = kmpIAP.getAvailablePurchases()

        for (purchase in purchases) {
            // Process each pending purchase
            if (purchase is PurchaseAndroid) {
                handlePurchase(purchase)
            }
        }
    } catch (e: Exception) {
        println("Failed to get pending purchases: \${e.message}")
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<void> checkPendingPurchases() async {
  final purchases = await _iap.getAvailablePurchases();

  for (final purchase in purchases) {
    // Process each pending purchase
    await _handlePurchase(purchase);
  }
}`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`async Task CheckPendingPurchasesAsync()
{
    try
    {
        var purchases = await ((QueryResolver)OpenIapClient.Instance)
            .GetAvailablePurchasesAsync();

        foreach (var purchase in purchases)
        {
            await HandlePurchaseAsync(purchase);
        }
    }
    catch (Exception error)
    {
        Console.WriteLine($"Failed to get pending purchases: {error.Message}");
    }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func check_pending_purchases() -> void:
    var purchases = await iap.get_available_purchases()

    for purchase in purchases:
        # Process each pending purchase
        await handle_purchase(purchase)

# Call on app launch after setting up listeners
func _ready() -> void:
    setup_listeners()

    # Then check for pending purchases
    await check_pending_purchases()`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="references" level="h2">
          Native References
        </AnchorLink>
        <ul>
          <li>
            Apple ·{' '}
            <a
              href="https://developer.apple.com/in-app-purchase/"
              target="_blank"
              rel="noopener noreferrer"
            >
              In-App Purchase overview
            </a>
          </li>
          <li>
            Apple ·{' '}
            <a
              href="https://developer.apple.com/documentation/storekit/in-app_purchase/"
              target="_blank"
              rel="noopener noreferrer"
            >
              StoreKit 2 In-App Purchase
            </a>
          </li>
          <li>
            Apple ·{' '}
            <a
              href="https://developer.apple.com/documentation/storekit/transaction"
              target="_blank"
              rel="noopener noreferrer"
            >
              StoreKit Transaction
            </a>
          </li>
          <li>
            Google ·{' '}
            <a
              href="https://developer.android.com/google/play/billing/integrate"
              target="_blank"
              rel="noopener noreferrer"
            >
              Integrate the Google Play Billing Library
            </a>
          </li>
          <li>
            Google ·{' '}
            <a
              href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient"
              target="_blank"
              rel="noopener noreferrer"
            >
              BillingClient reference
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Purchase;
