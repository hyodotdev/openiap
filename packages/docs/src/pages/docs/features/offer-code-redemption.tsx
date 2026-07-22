import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function OfferCodeRedemption() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Offer Code Redemption"
        description="Implement offer code and promo code redemption for iOS and Android in-app purchases and subscriptions."
        path="/docs/features/offer-code-redemption"
        keywords="offer code, promo code, redemption, iOS, Android"
      />
      <h1>Offer Code Redemption</h1>
      <p>
        Offer codes (also known as promo codes or redemption codes) allow users
        to redeem special offers for in-app purchases and subscriptions.
      </p>
      <p>
        <strong>Current API boundary:</strong>{' '}
        <code>presentCodeRedemptionSheetIOS</code> wraps Apple&apos;s legacy
        system sheet and reports presentation success. The 2026 StoreKit API
        that accepts redeem options and returns a verified transaction is not
        exposed yet; observe redeemed purchases through{' '}
        <Link to="/docs/events/purchase-updated-listener">
          <code>purchaseUpdatedListener</code>
        </Link>
        .
      </p>

      <section>
        <AnchorLink id="platform-differences" level="h2">
          Platform Differences
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Method</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>iOS</td>
              <td>
                <code>presentCodeRedemptionSheetIOS</code>
              </td>
              <td>Present Apple&apos;s system redemption sheet in the app</td>
            </tr>
            <tr>
              <td>Android one-time-use code</td>
              <td>
                <code>openRedeemOfferCodeAndroid</code>
              </td>
              <td>Open the Google Play redemption page</td>
            </tr>
            <tr>
              <td>Android subscription custom code</td>
              <td>
                Normal <code>requestPurchase</code> subscription flow
              </td>
              <td>
                Let the user enter the custom code in the Google Play purchase
                sheet; the redemption URL does not support this code type
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="platform-implementation" level="h2">
          Platform Implementation
        </AnchorLink>

        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="ios-overview" level="h3">
                  iOS
                </AnchorLink>
                <p>
                  Initialize the store connection before presenting the sheet,
                  and register a purchase listener before the user redeems a
                  code. The sheet&apos;s Boolean result means it was presented;
                  the redeemed transaction arrives through the listener.
                </p>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import {
  endConnection,
  initConnection,
  presentCodeRedemptionSheetIOS,
  purchaseUpdatedListener,
} from 'expo-iap';

let subscription: ReturnType<typeof purchaseUpdatedListener> | undefined;

export async function startIap() {
  await initConnection();
  subscription = purchaseUpdatedListener((purchase) => {
    console.log('Redeemed product:', purchase.productId);
  });
}

export async function redeemCode() {
  return presentCodeRedemptionSheetIOS();
}

export async function stopIap() {
  subscription?.remove();
  await endConnection();
}`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`import OpenIAP

@MainActor
final class RedemptionManager {
    private let iapStore = OpenIapStore()

    func start() async throws {
        iapStore.onPurchaseSuccess = { purchase in
            print("Redeemed product: \(purchase.productId)")
        }
        try await iapStore.initConnection()
    }

    func redeemCode() async throws -> Bool {
        try await iapStore.presentCodeRedemptionSheetIOS()
    }

    func stop() async {
        try? await iapStore.endConnection()
    }
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`// This StoreKit sheet is iOS-only.
// For shared Kotlin code, use the KMP API shown in the KMP tab.`}</CodeBlock>
                    ),
                    kmp: (
                      <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class RedemptionManager(private val scope: CoroutineScope) {
    private val iap = KmpIAP()
    private var purchaseJob: Job? = null

    suspend fun start() {
        iap.initConnection()
        purchaseJob = scope.launch {
            iap.purchaseUpdatedListener.collect { purchase ->
                println("Redeemed product: " + purchase.productId)
            }
        }
    }

    suspend fun redeemCode(): Boolean =
        iap.presentCodeRedemptionSheetIOS()

    suspend fun stop() {
        purchaseJob?.cancel()
        iap.endConnection()
    }
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'dart:async';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

class RedemptionManager {
  final iap = FlutterInappPurchase.instance;
  StreamSubscription<Purchase>? subscription;

  Future<void> start() async {
    await iap.initConnection();
    subscription = iap.purchaseUpdatedListener.listen((purchase) {
      print('Redeemed product: ' + purchase.productId);
    });
  }

  Future<bool> redeemCode() => iap.presentCodeRedemptionSheetIOS();

  Future<void> stop() async {
    await subscription?.cancel();
    await iap.endConnection();
  }
}`}</CodeBlock>
                    ),
                    csharp: (
                      <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

public sealed class RedemptionManager : IDisposable
{
    private readonly IOpenIap _iap = OpenIapClient.Instance;
    private IDisposable? _purchaseSubscription;

    public async Task StartAsync()
    {
        _purchaseSubscription = _iap.PurchaseUpdated.Subscribe(
            purchase => Console.WriteLine("Redeemed product: " + purchase.ProductId));
        await ((MutationResolver)_iap).InitConnectionAsync();
    }

    public Task<bool> RedeemCodeAsync() =>
        ((MutationResolver)_iap).PresentCodeRedemptionSheetIOSAsync();

    public async Task StopAsync()
    {
        _purchaseSubscription?.Dispose();
        _purchaseSubscription = null;
        await ((MutationResolver)_iap).EndConnectionAsync();
    }

    public void Dispose() => _purchaseSubscription?.Dispose();
}`}</CodeBlock>
                    ),
                    gdscript: (
                      <CodeBlock language="gdscript">{`extends Node

func _ready() -> void:
    GodotIapPlugin.purchase_updated.connect(_on_purchase_updated)
    if not await GodotIapPlugin.init_connection():
        push_error("Failed to connect to the App Store")

func _on_purchase_updated(purchase: Dictionary) -> void:
    print("Redeemed product: ", purchase.get("productId", ""))

func redeem_code() -> bool:
    return await GodotIapPlugin.present_code_redemption_sheet_ios()

func _exit_tree() -> void:
    await GodotIapPlugin.end_connection()`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="ios-testing" level="h3">
                  Testing
                </AnchorLink>
                <ul>
                  <li>Test on a real iOS device, not a simulator</li>
                  <li>Generate test codes in App Store Connect</li>
                  <li>Use a sandbox account or TestFlight build</li>
                </ul>
              </>
            ),
            android: (
              <>
                <AnchorLink id="android-overview" level="h3">
                  Android
                </AnchorLink>
                <p>
                  Google Play does not expose a general in-app redemption API.
                  For a <strong>one-time-use promo code</strong>, open the Play
                  Store redemption URL and keep your purchase listener active.
                  For a <strong>subscription custom code</strong>, start the
                  normal subscription purchase flow instead; the user enters the
                  code in the Google Play purchase sheet.
                </p>
                <p>
                  A redemption completed while your billing connection was
                  inactive might not reach the live listener. Run this complete
                  reconciliation sequence from your app-resume or foreground
                  handler:
                </p>
                <ol>
                  <li>
                    Wait for <code>initConnection</code> (or reconnection) to
                    succeed.
                  </li>
                  <li>
                    Query <code>getAvailablePurchases</code> after the
                    connection is ready.
                  </li>
                  <li>
                    Process only purchases whose state is <code>purchased</code>
                    ; never grant a pending or unknown purchase.
                  </li>
                  <li>Verify the store receipt on your server.</li>
                  <li>
                    Grant the entitlement idempotently, so a resume or listener
                    replay cannot grant it twice.
                  </li>
                  <li>
                    Call <code>finishTransaction</code> only after verification
                    and grant. Consume consumables; acknowledge non-consumables
                    and subscriptions.
                  </li>
                </ol>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import {
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  openRedeemOfferCodeAndroid,
  type Purchase,
} from 'expo-iap';

export async function openRedeemPage() {
  await openRedeemOfferCodeAndroid();
}

// Call this from the app's foreground/resume handler after the user returns.
export async function reconcileAfterResume() {
  await initConnection();
  const purchases = await getAvailablePurchases();

  for (const purchase of purchases) {
    if (purchase.purchaseState !== 'purchased') continue;
    if (!(await verifyOnServer(purchase))) continue;

    await grantIdempotently(purchase);
    await finishTransaction({
      purchase,
      isConsumable: isConsumableProduct(purchase.productId),
    });
  }
}

declare function verifyOnServer(purchase: Purchase): Promise<boolean>;
declare function grantIdempotently(purchase: Purchase): Promise<void>;
declare function isConsumableProduct(productId: string): boolean;

// react-native-iap exports the same APIs.`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`// Android-only. On iOS, call presentCodeRedemptionSheetIOS().`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import android.app.Activity
import dev.hyo.openiap.PurchaseState
import dev.hyo.openiap.utils.toPurchaseInput

suspend fun openRedeemPage(activity: Activity): Boolean =
    openIapStore.openRedeemOfferCode(activity)

suspend fun reconcileAfterResume() {
    check(openIapStore.initConnection())
    for (purchase in openIapStore.getAvailablePurchases(null)) {
        if (purchase.purchaseState != PurchaseState.Purchased) continue
        if (!verifyOnServer(purchase)) continue

        grantIdempotently(purchase)
        openIapStore.finishTransaction(
            purchase.toPurchaseInput(),
            isConsumableProduct(purchase.productId),
        )
    }
}`}</CodeBlock>
                    ),
                    kmp: (
                      <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.toPurchaseInput
import io.github.hyochan.kmpiap.openiap.PurchaseState

suspend fun openRedeemPage(): Boolean =
    kmpIAP.openRedeemOfferCodeAndroid()

suspend fun reconcileAfterResume() {
    check(kmpIAP.initConnection())
    for (purchase in kmpIAP.getAvailablePurchases()) {
        if (purchase.purchaseState != PurchaseState.Purchased) continue
        if (!verifyOnServer(purchase)) continue

        grantIdempotently(purchase)
        kmpIAP.finishTransaction(
            purchase.toPurchaseInput(),
            isConsumable = isConsumableProduct(purchase.productId),
        )
    }
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

Future<bool> openRedeemPage() =>
    FlutterInappPurchase.instance.openRedeemOfferCodeAndroid();

Future<void> reconcileAfterResume() async {
  final iap = FlutterInappPurchase.instance;
  await iap.initConnection();
  final purchases = await iap.getAvailablePurchases();

  for (final purchase in purchases) {
    if (purchase.purchaseState != PurchaseState.Purchased) continue;
    if (!await verifyOnServer(purchase)) continue;

    await grantIdempotently(purchase);
    await iap.finishTransaction(
      purchase: purchase,
      isConsumable: isConsumableProduct(purchase.productId),
    );
  }
}`}</CodeBlock>
                    ),
                    csharp: (
                      <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var mutations = (MutationResolver)OpenIapClient.Instance;
await mutations.OpenRedeemOfferCodeAndroidAsync();

async Task ReconcileAfterResumeAsync()
{
    var iap = OpenIapClient.Instance;
    var mutations = (MutationResolver)iap;
    var queries = (QueryResolver)iap;

    if (!await mutations.InitConnectionAsync()) return;
    foreach (var purchase in await queries.GetAvailablePurchasesAsync())
    {
        if (purchase.PurchaseState != PurchaseState.Purchased) continue;
        if (!await VerifyOnServerAsync(purchase)) continue;

        await GrantIdempotentlyAsync(purchase);
        await mutations.FinishTransactionAsync(
            new PurchaseInput(purchase),
            IsConsumableProduct(purchase.ProductId));
    }
}`}</CodeBlock>
                    ),
                    gdscript: (
                      <CodeBlock language="gdscript">{`func open_redeem_page() -> bool:
    return await GodotIapPlugin.open_redeem_offer_code_android()

func reconcile_after_resume() -> void:
    if not await GodotIapPlugin.init_connection():
        return

    for purchase in await GodotIapPlugin.get_available_purchases():
        if purchase.purchase_state != Types.PurchaseState.PURCHASED:
            continue
        if not await verify_on_server(purchase):
            continue

        await grant_idempotently(purchase)
        await GodotIapPlugin.finish_transaction(
            purchase,
            is_consumable_product(purchase.product_id),
        )`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="android-testing" level="h3">
                  Testing
                </AnchorLink>
                <ul>
                  <li>
                    Generate a one-time-use promo code or subscription custom
                    code in Google Play Console
                  </li>
                  <li>
                    Test one-time-use codes through the Play Store redemption
                    flow
                  </li>
                  <li>
                    Test subscription custom codes in the normal subscription
                    purchase sheet
                  </li>
                  <li>Use a configured license tester account</li>
                  <li>
                    Return to the app and run the complete reconciliation flow
                  </li>
                </ul>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="related" level="h2">
          Related
        </AnchorLink>
        <ul>
          <li>
            <Link to="/docs/apis/ios/present-code-redemption-sheet-ios">
              presentCodeRedemptionSheetIOS API Reference
            </Link>
          </li>
          <li>
            <Link to="/docs/apis/android/open-redeem-offer-code-android">
              openRedeemOfferCodeAndroid API Reference
            </Link>
          </li>
          <li>
            <Link to="/docs/events/purchase-updated-listener">
              Purchase Updated Listener
            </Link>
          </li>
          <li>
            <a
              href="https://developer.apple.com/app-store/subscriptions/offer-codes/"
              target="_blank"
              rel="noopener noreferrer"
            >
              App Store Subscription Offer Codes
            </a>
          </li>
          <li>
            <a
              href="https://support.google.com/googleplay/android-developer/answer/6321495"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Promotions
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default OfferCodeRedemption;
