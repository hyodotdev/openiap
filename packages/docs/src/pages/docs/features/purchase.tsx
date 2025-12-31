import AnchorLink from '../../../components/AnchorLink';
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
            <strong>Verify Purchase</strong> - Validate on your server
          </li>
          <li>
            <strong>Finish Transaction</strong> - Complete the transaction
          </li>
        </ol>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>⚠️ Critical:</strong> You must complete all steps in order.
            Skipping verification or failing to finish transactions will cause
            issues:
          </p>
          <ul>
            <li>Android: Purchases refunded after 3 days if not acknowledged</li>
            <li>iOS: Transaction replays on every app launch</li>
            <li>Both: Users cannot repurchase consumables</li>
          </ul>
        </div>
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
              <CodeBlock language="typescript">{`import { useEffect, useCallback } from 'react';
import {
  initConnection,
  endConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
  type PurchaseError,
} from 'expo-iap';

function App() {
  useEffect(() => {
    let purchaseUpdateSubscription: ReturnType<typeof purchaseUpdatedListener>;
    let purchaseErrorSubscription: ReturnType<typeof purchaseErrorListener>;

    const init = async () => {
      // 1. Initialize connection first
      await initConnection();

      // 2. Setup purchase success listener
      purchaseUpdateSubscription = purchaseUpdatedListener((purchase) => {
        console.log('Purchase received:', purchase);
        // Handle the purchase (verify + finish)
        void handlePurchase(purchase);
      });

      // 3. Setup error listener
      purchaseErrorSubscription = purchaseErrorListener((error) => {
        console.warn('Purchase error:', error);
        handlePurchaseError(error);
      });
    };

    void init();

    // Cleanup on unmount
    return () => {
      purchaseUpdateSubscription?.remove();
      purchaseErrorSubscription?.remove();
      void endConnection();
    };
  }, []);

  return <YourAppContent />;
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

class PurchaseManager: ObservableObject {
    private let iapStore = OpenIapStore.shared

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
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class PurchaseManager(
    private val context: Context,
    private val lifecycleScope: CoroutineScope
) {
    private val iapStore = OpenIapStore.getInstance(context)

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
            iapStore.purchaseError.collect { error ->
                if (error != null) {
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
            dart: (
              <CodeBlock language="dart">{`import 'dart:async';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

class PurchaseManager {
  final FlutterInappPurchase _iap = FlutterInappPurchase.instance;
  StreamSubscription<ProductPurchase?>? _purchaseSubscription;
  StreamSubscription<PurchaseError?>? _errorSubscription;

  Future<void> initialize() async {
    // 1. Initialize connection first
    await _iap.initConnection();

    // 2. Setup purchase success listener
    _purchaseSubscription = FlutterInappPurchase.purchaseUpdatedStream
        .listen((purchase) {
      if (purchase != null) {
        print('Purchase received: \${purchase.productId}');
        _handlePurchase(purchase);
      }
    });

    // 3. Setup error listener
    _errorSubscription = FlutterInappPurchase.purchaseErrorStream
        .listen((error) {
      if (error != null) {
        print('Purchase error: \${error.message}');
        _handlePurchaseError(error);
      }
    });
  }

  void dispose() {
    _purchaseSubscription?.cancel();
    _errorSubscription?.cancel();
    _iap.endConnection();
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

        <AnchorLink id="request-purchase-consumable" level="h3">
          Consumable / Non-Consumable Products
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { requestPurchase } from 'expo-iap';

// Purchase a one-time product (consumable or non-consumable)
const purchaseProduct = async (productId: string) => {
  try {
    await requestPurchase({
      request: {
        apple: { sku: productId },
        google: { skus: [productId] },
      },
      type: 'inapp', // 'inapp' for consumables/non-consumables
    });
    // Purchase result will be delivered to purchaseUpdatedListener
  } catch (error) {
    console.error('Purchase request failed:', error);
  }
};

// Example usage
await purchaseProduct('com.app.coins_100');`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

func purchaseProduct(productId: String) async {
    let iapStore = OpenIapStore.shared

    do {
        // Request purchase - result delivered to onPurchaseSuccess
        _ = try await iapStore.requestPurchase(
            sku: productId,
            type: .inapp,  // .inapp for consumables/non-consumables
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
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*

suspend fun purchaseProduct(productId: String) {
    try {
        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.InApp(
                RequestInAppPropsByPlatforms(
                    android = RequestInAppAndroidProps(
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
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

Future<void> purchaseProduct(String productId) async {
  final iap = FlutterInappPurchase.instance;

  try {
    // Request purchase - result delivered to purchaseUpdatedStream
    await iap.requestPurchase(productId);
  } catch (e) {
    print('Purchase request failed: $e');
  }
}

// Example usage
await purchaseProduct('com.app.coins_100');`}</CodeBlock>
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
    props.type = ProductType.IN_APP  # IN_APP for consumables/non-consumables

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
          Verify Purchase (Server-Side)
        </AnchorLink>
        <p>
          <strong>Always verify purchases on your server.</strong> Client-side
          verification can be bypassed. Use <code>verifyPurchase</code> to send
          purchase data to your server for validation.
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { verifyPurchase, type Purchase } from 'expo-iap';
import { Platform } from 'react-native';

const verifyOnServer = async (purchase: Purchase) => {
  const result = await verifyPurchase({
    purchase,
    serverUrl: Platform.select({
      ios: 'https://your-server.com/api/verify-ios',
      android: 'https://your-server.com/api/verify-android',
    })!,
  });

  if (result.isValid) {
    console.log('Purchase verified!');
    return true;
  }

  console.error('Verification failed');
  return false;
};`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

func verifyOnServer(_ purchase: PurchaseIOS) async -> Bool {
    let iapStore = OpenIapStore.shared

    do {
        let result = try await iapStore.verifyPurchase(
            purchase: purchase,
            serverUrl: "https://your-server.com/api/verify-ios"
        )

        if result.isValid {
            print("Purchase verified!")
            return true
        }

        print("Verification failed")
        return false
    } catch {
        print("Verification error: \\(error.localizedDescription)")
        return false
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*

suspend fun verifyOnServer(purchase: PurchaseAndroid): Boolean {
    return try {
        val result = iapStore.verifyPurchase(
            purchase = purchase,
            serverUrl = "https://your-server.com/api/verify-android"
        )

        if (result.isValid) {
            println("Purchase verified!")
            true
        } else {
            println("Verification failed")
            false
        }
    } catch (e: Exception) {
        println("Verification error: \${e.message}")
        false
    }
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'dart:io';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

Future<bool> verifyOnServer(ProductPurchase purchase) async {
  final iap = FlutterInappPurchase.instance;

  try {
    final result = await iap.verifyPurchase(
      purchase: purchase,
      serverUrl: Platform.isIOS
          ? 'https://your-server.com/api/verify-ios'
          : 'https://your-server.com/api/verify-android',
    );

    if (result.isValid) {
      print('Purchase verified!');
      return true;
    }

    print('Verification failed');
    return false;
  } catch (e) {
    print('Verification error: $e');
    return false;
  }
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func verify_on_server(purchase: Purchase) -> bool:
    var props = VerifyPurchaseProps.new()
    props.purchase = purchase

    # Use platform-specific server URL
    if OS.get_name() == "iOS":
        props.server_url = "https://your-server.com/api/verify-ios"
    else:
        props.server_url = "https://your-server.com/api/verify-android"

    var result = await iap.verify_purchase(props)

    if result.is_valid:
        print("Purchase verified!")
        return true

    print("Verification failed")
    return false`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <div className="alert-card alert-card--info">
          <p>
            <strong>ℹ️ Server-Side Implementation:</strong> For detailed
            server-side verification implementation (JWS verification for iOS,
            Google Play API for Android), see the{' '}
            <a href="/tutorials#verify-purchase">Verify Purchase tutorials</a>.
          </p>
        </div>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>⚠️ Security Best Practices:</strong>
          </p>
          <ul>
            <li>Never verify purchases only on the client side</li>
            <li>Store purchase records in your database</li>
            <li>
              Implement idempotency to handle duplicate verification requests
            </li>
            <li>Use HTTPS for all server communication</li>
            <li>
              Keep service account credentials secure (never in client code)
            </li>
          </ul>
        </div>
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
              <td>
                Product can be purchased again (coins, gems, etc.)
              </td>
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
              <CodeBlock language="typescript">{`import { finishTransaction, type Purchase } from 'expo-iap';

const completePurchase = async (
  purchase: Purchase,
  isConsumable: boolean
) => {
  try {
    // Finish the transaction
    // - isConsumable: true = consume the purchase (can buy again)
    // - isConsumable: false = acknowledge only (one-time purchase)
    await finishTransaction(purchase, isConsumable);

    console.log('Transaction finished successfully');
  } catch (error) {
    console.error('Failed to finish transaction:', error);
    // Retry finishing the transaction
  }
};

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

  // 3. Finish the transaction
  const isConsumable = purchase.productId.includes('consumable');
  await completePurchase(purchase, isConsumable);
};`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

func completePurchase(
    _ purchase: PurchaseIOS,
    isConsumable: Bool
) async {
    let iapStore = OpenIapStore.shared

    do {
        // Finish the transaction
        try await iapStore.finishTransaction(purchase, isConsumable: isConsumable)
        print("Transaction finished successfully")
    } catch {
        print("Failed to finish transaction: \\(error.localizedDescription)")
        // Retry finishing the transaction
    }
}

// Complete purchase flow
func handlePurchase(_ purchase: PurchaseIOS) async {
    // 1. Verify on server
    let isValid = await verifyIOSPurchase(purchase)
    guard isValid else {
        print("Invalid purchase")
        return
    }

    // 2. Grant the product to user
    await grantProductToUser(productId: purchase.productId)

    // 3. Finish the transaction
    let isConsumable = purchase.productId.contains("consumable")
    await completePurchase(purchase, isConsumable: isConsumable)
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun completePurchase(
    purchase: PurchaseAndroid,
    isConsumable: Boolean
) {
    try {
        // Finish the transaction
        // - isConsumable: true = consume (can buy again)
        // - isConsumable: false = acknowledge only
        iapStore.finishTransaction(purchase, isConsumable)
        println("Transaction finished successfully")
    } catch (e: Exception) {
        println("Failed to finish transaction: \${e.message}")
        // Retry finishing the transaction
    }
}

// Complete purchase flow
suspend fun handlePurchase(purchase: PurchaseAndroid) {
    // 1. Verify on server
    val isValid = verifyAndroidPurchase(purchase)
    if (!isValid) {
        println("Invalid purchase")
        return
    }

    // 2. Grant the product to user
    grantProductToUser(purchase.productId)

    // 3. Finish the transaction
    val isConsumable = purchase.productId.contains("consumable", true)
    completePurchase(purchase, isConsumable)
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<void> completePurchase(
  ProductPurchase purchase,
  bool isConsumable,
) async {
  final iap = FlutterInappPurchase.instance;

  try {
    // Finish the transaction
    await iap.finishTransaction(purchase, isConsumable: isConsumable);
    print('Transaction finished successfully');
  } catch (e) {
    print('Failed to finish transaction: $e');
    // Retry finishing the transaction
  }
}

// Complete purchase flow
Future<void> handlePurchase(ProductPurchase purchase) async {
  // 1. Verify on server
  final isValid = await verifyPurchase(purchase);
  if (!isValid) {
    print('Invalid purchase');
    return;
  }

  // 2. Grant the product to user
  await grantProductToUser(purchase.productId ?? '');

  // 3. Finish the transaction
  final isConsumable = purchase.productId?.contains('consumable') ?? false;
  await completePurchase(purchase, isConsumable);
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`func complete_purchase(purchase: Purchase, is_consumable: bool) -> void:
    # Finish the transaction
    # - is_consumable: true = consume the purchase (can buy again)
    # - is_consumable: false = acknowledge only (one-time purchase)
    await iap.finish_transaction(purchase, is_consumable)
    print("Transaction finished successfully")

# Complete purchase flow in listener
func handle_purchase(purchase: Purchase) -> void:
    # 1. Verify on server
    var is_valid = await verify_on_server(purchase)
    if not is_valid:
        print("Invalid purchase")
        return

    # 2. Grant the product to user
    await grant_product_to_user(purchase.product_id)

    # 3. Finish the transaction
    var is_consumable = "consumable" in purchase.product_id
    await complete_purchase(purchase, is_consumable)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="complete-example" level="h2">
          Complete Example
        </AnchorLink>
        <p>
          Here's a complete implementation combining all steps:
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { useEffect, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  verifyPurchase,
  type Purchase,
  type PurchaseError,
} from 'expo-iap';

const PRODUCT_IDS = ['com.app.premium', 'com.app.coins_100'];

function PurchaseProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = useCallback(async (purchase: Purchase) => {
    setIsProcessing(true);

    try {
      // Step 1: Verify purchase on server
      const verifyResult = await verifyPurchase({
        purchase,
        serverUrl: Platform.select({
          ios: 'https://your-server.com/api/verify-ios',
          android: 'https://your-server.com/api/verify-android',
        })!,
      });

      if (!verifyResult.isValid) {
        console.error('Purchase verification failed');
        return;
      }

      // Step 2: Grant product to user (your business logic)
      await grantProductToUser(purchase.productId, verifyResult);

      // Step 3: Finish transaction
      const isConsumable = purchase.productId.includes('coins');
      await finishTransaction(purchase, isConsumable);

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
      await initConnection();

      // Fetch products
      const items = await fetchProducts({
        skus: PRODUCT_IDS,
        type: 'inapp',
      });
      setProducts(items);

      // Setup listeners
      purchaseSub = purchaseUpdatedListener((p) => void handlePurchase(p));
      errorSub = purchaseErrorListener(handleError);
    };

    void init();

    return () => {
      purchaseSub?.remove();
      errorSub?.remove();
      void endConnection();
    };
  }, [handlePurchase, handleError]);

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

    private let iapStore = OpenIapStore.shared

    init() {
        setupListeners()
        Task { await loadProducts() }
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

    private func loadProducts() async {
        do {
            try await iapStore.initConnection()
            products = try await iapStore.fetchProducts(
                skus: ["com.app.premium", "com.app.coins_100"],
                type: .inapp
            )
        } catch {
            print("Failed to load products: \\(error.localizedDescription)")
        }
    }

    func purchase(_ productId: String) async {
        isProcessing = true
        do {
            _ = try await iapStore.requestPurchase(
                sku: productId,
                type: .inapp,
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
            try await iapStore.finishTransaction(purchase, isConsumable: isConsumable)
            print("Purchase completed!")
        } catch {
            print("Failed to finish: \\(error.localizedDescription)")
        }
    }
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*
import kotlinx.coroutines.flow.*

class PurchaseManager(
    private val context: Context,
    private val scope: CoroutineScope
) {
    private val iapStore = OpenIapStore.getInstance(context)

    private val _products = MutableStateFlow<List<ProductAndroid>>(emptyList())
    val products: StateFlow<List<ProductAndroid>> = _products.asStateFlow()

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    init {
        setupListeners()
        loadProducts()
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
            iapStore.purchaseError.collect { error ->
                if (error != null) {
                    _isProcessing.value = false
                    println("Purchase error: \${error.message}")
                }
            }
        }
    }

    private fun loadProducts() {
        scope.launch {
            try {
                iapStore.initConnection()
                val request = ProductRequest(
                    skus = listOf("com.app.premium", "com.app.coins_100"),
                    type = ProductQueryType.InApp
                )
                _products.value = iapStore.fetchProducts(request)
                    .filterIsInstance<ProductAndroid>()
            } catch (e: Exception) {
                println("Failed to load products: \${e.message}")
            }
        }
    }

    fun purchase(productId: String) {
        _isProcessing.value = true
        scope.launch {
            try {
                val props = RequestPurchaseProps(
                    request = RequestPurchaseProps.Request.InApp(
                        RequestInAppPropsByPlatforms(
                            android = RequestInAppAndroidProps(skus = listOf(productId))
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
            iapStore.finishTransaction(purchase, isConsumable)
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

  List<IAPItem> products = [];
  bool isProcessing = false;

  StreamSubscription<ProductPurchase?>? _purchaseSub;
  StreamSubscription<PurchaseError?>? _errorSub;

  Future<void> initialize() async {
    await _iap.initConnection();
    await _loadProducts();
    _setupListeners();
  }

  Future<void> _loadProducts() async {
    products = await _iap.getProducts(['com.app.premium', 'com.app.coins_100']);
    notifyListeners();
  }

  void _setupListeners() {
    _purchaseSub = FlutterInappPurchase.purchaseUpdatedStream.listen((p) {
      if (p != null) _handlePurchase(p);
    });

    _errorSub = FlutterInappPurchase.purchaseErrorStream.listen((e) {
      if (e != null) {
        isProcessing = false;
        notifyListeners();
        print('Purchase error: \${e.message}');
      }
    });
  }

  Future<void> purchase(String productId) async {
    isProcessing = true;
    notifyListeners();

    try {
      await _iap.requestPurchase(productId);
    } catch (e) {
      isProcessing = false;
      notifyListeners();
      print('Purchase request failed: $e');
    }
  }

  Future<void> _handlePurchase(ProductPurchase purchase) async {
    try {
      // Step 1: Verify
      final isValid = await _verifyPurchase(purchase);
      if (!isValid) {
        print('Verification failed');
        return;
      }

      // Step 2: Grant product
      await _grantProductToUser(purchase.productId ?? '');

      // Step 3: Finish
      final isConsumable = purchase.productId?.contains('coins') ?? false;
      await _iap.finishTransaction(purchase, isConsumable: isConsumable);
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
            gdscript: (
              <CodeBlock language="gdscript">{`# Complete example: Purchase Manager (Godot)
extends Node

signal products_loaded
signal processing_changed

var iap: OpenIap
var products: Array[Product] = []
var is_processing: bool = false:
    set(value):
        is_processing = value
        processing_changed.emit()

const PRODUCT_IDS = ["com.app.premium", "com.app.coins_100"]

func _ready() -> void:
    setup_listeners()
    await load_products()

func setup_listeners() -> void:
    iap.purchase_updated.connect(_on_purchase_updated)
    iap.purchase_error.connect(_on_purchase_error)
    await iap.init_connection(null)

func load_products() -> void:
    var request = ProductRequest.new()
    request.skus = PRODUCT_IDS
    request.type = ProductQueryType.IN_APP
    products = await iap.fetch_products(request)
    products_loaded.emit()

func purchase(product_id: String) -> void:
    is_processing = true

    var props = RequestPurchaseProps.new()
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.apple = RequestPurchaseIosProps.new()
    props.request.apple.sku = product_id
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = [product_id]
    props.type = ProductType.IN_APP

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
                Call <code>finishTransaction()</code> after verification
              </td>
            </tr>
            <tr>
              <td>Android purchase refunded</td>
              <td>Not acknowledged within 3 days</td>
              <td>
                Finish transaction immediately after verification
              </td>
            </tr>
            <tr>
              <td>Cannot repurchase consumable</td>
              <td>Not consumed</td>
              <td>
                Pass <code>isConsumable: true</code> to{' '}
                <code>finishTransaction()</code>
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
              <CodeBlock language="typescript">{`import { getAvailablePurchases } from 'expo-iap';

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

  void init();
}, []);`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func checkPendingPurchases() async {
    let iapStore = OpenIapStore.shared

    do {
        let purchases = try await iapStore.getAvailablePurchases()

        for purchase in purchases {
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
        val purchases = iapStore.getAvailablePurchases()

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
    </div>
  );
}

export default Purchase;
