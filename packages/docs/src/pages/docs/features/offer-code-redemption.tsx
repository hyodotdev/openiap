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
              <td>Native in-app code redemption sheet handled by the system</td>
            </tr>
            <tr>
              <td>Android</td>
              <td>
                <code>openRedeemOfferCodeAndroid</code>
              </td>
              <td>
                Deep link to Google Play Store (no native in-app API available)
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
                  Overview
                </AnchorLink>
                <p>
                  iOS provides a native code redemption sheet that can be
                  presented directly within your app using{' '}
                  <code>presentCodeRedemptionSheetIOS</code>.
                </p>
                <ul>
                  <li>Works only on real iOS devices (not simulators)</li>
                  <li>Not available on tvOS</li>
                  <li>Handled entirely by the iOS system</li>
                  <li>
                    Purchase updates delivered through{' '}
                    <code>purchaseUpdatedListener</code>
                  </li>
                </ul>

                <AnchorLink id="ios-usage" level="h3">
                  Usage
                </AnchorLink>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import { presentCodeRedemptionSheetIOS } from 'expo-iap';

const redeemCode = async () => {
  try {
    const result = await presentCodeRedemptionSheetIOS();
    if (result) {
      console.log('Code redemption sheet presented successfully');
      // The system handles the redemption process
      // Listen for purchase updates via purchaseUpdatedListener
    }
  } catch (error) {
    console.error('Failed to present code redemption sheet:', error);
  }
};`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`import OpenIap

let iapStore = OpenIapStore.shared

func redeemCode() async {
    do {
        let result = try await iapStore.presentCodeRedemptionSheetIOS()
        if result {
            print("Code redemption sheet presented successfully")
            // The system handles the redemption process
            // Listen for purchase updates via onPurchaseSuccess callback
        }
    } catch {
        print("Failed to present code redemption sheet: \\(error.localizedDescription)")
    }
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore

// KMP iOS target
val iapStore = OpenIapStore.shared

suspend fun redeemCode() {
    try {
        val result = iapStore.presentCodeRedemptionSheetIOS()
        if (result) {
            println("Code redemption sheet presented successfully")
            // The system handles the redemption process
            // Listen for purchase updates via purchaseFlow
        }
    } catch (e: Exception) {
        println("Failed to present code redemption sheet: \${e.message}")
    }
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

Future<void> redeemCode() async {
  try {
    final result = await iap.presentCodeRedemptionSheetIOS();
    if (result) {
      print('Code redemption sheet presented successfully');
      // The system handles the redemption process
      // Listen for purchase updates via purchaseUpdatedStream
    }
  } catch (e) {
    print('Failed to present code redemption sheet: $e');
  }
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="ios-complete-example" level="h3">
                  Complete Example
                </AnchorLink>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import { useEffect } from 'react';
import {
  presentCodeRedemptionSheetIOS,
  purchaseUpdatedListener,
  finishTransaction,
} from 'expo-iap';

function RedeemCodeButton() {
  useEffect(() => {
    // Listen for purchases from code redemption
    const subscription = purchaseUpdatedListener(async (purchase) => {
      console.log('Purchase from code redemption:', purchase);

      // Verify and finish the transaction
      const isValid = await verifyPurchaseOnServer(purchase);
      if (isValid) {
        await finishTransaction(purchase, false);
        console.log('Redemption completed successfully');
      }
    });

    return () => subscription.remove();
  }, []);

  const handleRedeem = async () => {
    try {
      await presentCodeRedemptionSheetIOS();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <Button onPress={handleRedeem} title="Redeem Code" />
  );
}`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`import OpenIap
import SwiftUI

class RedemptionManager: ObservableObject {
    private let iapStore = OpenIapStore.shared

    init() {
        setupPurchaseListener()
    }

    private func setupPurchaseListener() {
        // Listen for purchases from code redemption
        iapStore.onPurchaseSuccess = { [weak self] purchase in
            Task {
                print("Purchase from code redemption: \\(purchase.productId)")

                // Verify and finish the transaction
                let isValid = await self?.verifyPurchaseOnServer(purchase)
                if isValid == true {
                    try? await self?.iapStore.finishTransaction(purchase, isConsumable: false)
                    print("Redemption completed successfully")
                }
            }
        }
    }

    func redeemCode() async {
        do {
            _ = try await iapStore.presentCodeRedemptionSheetIOS()
        } catch {
            print("Error: \\(error.localizedDescription)")
        }
    }
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import dev.hyo.openiap.OpenIapStore
import dev.hyo.openiap.models.*
import kotlinx.coroutines.*

// KMP iOS target
class RedemptionManager {
    private val iapStore = OpenIapStore.shared
    private var purchaseJob: Job? = null

    fun initialize(scope: CoroutineScope) {
        // Listen for purchases from code redemption
        purchaseJob = scope.launch {
            iapStore.purchaseFlow.collect { purchase ->
                println("Purchase from code redemption: \${purchase.productId}")

                // Verify and finish the transaction
                val isValid = verifyPurchaseOnServer(purchase)
                if (isValid) {
                    iapStore.finishTransaction(purchase, isConsumable = false)
                    println("Redemption completed successfully")
                }
            }
        }
    }

    suspend fun redeemCode() {
        try {
            iapStore.presentCodeRedemptionSheetIOS()
        } catch (e: Exception) {
            println("Error: \${e.message}")
        }
    }

    fun dispose() {
        purchaseJob?.cancel()
    }
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'dart:async';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

class RedemptionManager {
  final FlutterInappPurchase _iap = FlutterInappPurchase.instance;
  StreamSubscription<ProductPurchase?>? _subscription;

  void initialize() {
    // Listen for purchases from code redemption
    _subscription = FlutterInappPurchase.purchaseUpdatedStream.listen(
      (purchase) async {
        if (purchase != null) {
          print('Purchase from code redemption: \${purchase.productId}');

          // Verify and finish the transaction
          final isValid = await _verifyPurchaseOnServer(purchase);
          if (isValid) {
            await _iap.finishTransaction(purchase, isConsumable: false);
            print('Redemption completed successfully');
          }
        }
      },
    );
  }

  Future<void> redeemCode() async {
    try {
      await _iap.presentCodeRedemptionSheetIOS();
    } catch (e) {
      print('Error: $e');
    }
  }

  void dispose() {
    _subscription?.cancel();
  }
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="ios-testing" level="h3">
                  Testing
                </AnchorLink>
                <ul>
                  <li>Offer codes can only be tested on real iOS devices</li>
                  <li>
                    Use TestFlight or App Store Connect to generate test codes
                  </li>
                  <li>Sandbox environment supports offer code testing</li>
                  <li>
                    Create offer codes in App Store Connect under your
                    subscription
                  </li>
                </ul>
              </>
            ),
            android: (
              <>
                <AnchorLink id="android-overview" level="h3">
                  Overview
                </AnchorLink>
                <p>
                  Google Play does not provide a native API to redeem codes
                  within the app. Instead,{' '}
                  <code>openRedeemOfferCodeAndroid</code> opens a deep link to
                  the Play Store where users can enter their codes.
                </p>
                <ul>
                  <li>Opens the Google Play Store app</li>
                  <li>User enters code in the Play Store</li>
                  <li>
                    Purchase updates delivered through{' '}
                    <code>purchaseUpdatedListener</code>
                  </li>
                </ul>

                <AnchorLink id="android-usage" level="h3">
                  Usage
                </AnchorLink>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import { openRedeemOfferCodeAndroid } from 'expo-iap';

// Opens Play Store redemption page
const redeemCode = async () => {
  await openRedeemOfferCodeAndroid();
};

// Or manually with a pre-filled code
import { Linking } from 'react-native';

const redeemWithCode = async (code: string) => {
  const url = \`https://play.google.com/redeem?code=\${code}\`;
  await Linking.openURL(url);
};`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`// Android-only - use presentCodeRedemptionSheetIOS() for iOS`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`import android.content.Intent
import android.net.Uri

// Open Play Store redemption page
fun openRedeemPage(context: Context) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/redeem"))
    context.startActivity(intent)
}

// Open with pre-filled code
fun redeemWithCode(context: Context, code: String) {
    val url = "https://play.google.com/redeem?code=\$code"
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
    context.startActivity(intent)
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:url_launcher/url_launcher.dart';

// Open Play Store redemption page
Future<void> openRedeemPage() async {
  final url = Uri.parse('https://play.google.com/redeem');
  if (await canLaunchUrl(url)) {
    await launchUrl(url);
  }
}

// Open with pre-filled code
Future<void> redeemWithCode(String code) async {
  final url = Uri.parse('https://play.google.com/redeem?code=\$code');
  if (await canLaunchUrl(url)) {
    await launchUrl(url);
  }
}`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="android-testing" level="h3">
                  Testing
                </AnchorLink>
                <ul>
                  <li>Generate promo codes in Google Play Console</li>
                  <li>
                    Promo codes work for one-time products only (not
                    subscriptions)
                  </li>
                  <li>Use license testers for testing without real payments</li>
                  <li>
                    After redemption, purchases are delivered through your
                    purchase listener
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
            <Link to="/docs/apis#present-code-redemption-sheet-ios">
              presentCodeRedemptionSheetIOS API Reference
            </Link>
          </li>
          <li>
            <Link to="/docs/features/purchase">Purchase Flow</Link>
          </li>
          <li>
            <Link to="/docs/events">Events & Listeners</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default OfferCodeRedemption;
