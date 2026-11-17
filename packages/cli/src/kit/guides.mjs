export const SETUP_FRAMEWORKS = [
  "expo",
  "react-native",
  "flutter",
  "kmp",
  "godot",
  "maui",
  "ios",
  "android",
];

const SETUP_COVERAGE =
  "The example covers one purchase: verify with IAPKit, grant on a valid result, then finish the transaction; follow https://openiap.dev/docs/lifecycle for when to finish, restore and duplicate deliveries.";

export function renderSetupGuide(framework, apiKey, productId) {
  return {
    framework,
    snippet: renderSetupSnippet(framework, apiKey, productId),
    coverage: SETUP_COVERAGE,
  };
}

function renderSetupSnippet(framework, apiKey, productId) {
  const apiKeyLiteral = codeStringLiteral(apiKey);
  const productIdLiteral = codeStringLiteral(productId);
  switch (framework) {
    case "expo":
    case "react-native":
      return `import { Platform } from 'react-native';
import {
  finishTransaction,
  verifyPurchaseWithProvider,
  type Purchase,
} from '${framework === "expo" ? "expo-iap" : "react-native-iap"}';

const iapkitPublishableKey = ${apiKeyLiteral};
const expectedProductId = ${productIdLiteral};

export async function verifyAndGrant(purchase: Purchase) {
  const token = purchase.purchaseToken ?? '';
  const result = await verifyPurchaseWithProvider({
    provider: 'iapkit',
    iapkit: {
      apiKey: iapkitPublishableKey,
      includeClientPayload: true,
      ...(Platform.OS === 'ios'
        ? { apple: { jws: token } }
        : { google: { purchaseToken: token } }),
    },
  });

  const verified = result.iapkit;
  const allowedState =
    verified?.state === 'entitled' ||
    (Platform.OS === 'android' &&
      verified?.state === 'pending-acknowledgment');
  if (
    verified?.isValid === true &&
    allowedState &&
    verified.productId === purchase.productId &&
    verified.productId === expectedProductId
  ) {
    grantEntitlement(verified.productId);
    if (verified.clientPayload) applyPublicRules(verified.clientPayload);
    await finishTransaction({ purchase, isConsumable: false });
  }
}`;
    case "flutter":
      return `import 'dart:io';
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

const iapkitPublishableKey = ${apiKeyLiteral};

Future<void> verifyAndGrant(Purchase purchase) async {
  final result =
      await FlutterInappPurchase.instance.verifyPurchaseWithProvider(
    provider: PurchaseVerificationProvider.Iapkit,
    iapkit: RequestVerifyPurchaseWithIapkitProps(
      apiKey: iapkitPublishableKey,
      includeClientPayload: true,
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
    ),
  );

  final verified = result.iapkit;
  final allowedState =
      verified?.state == IapkitPurchaseState.Entitled ||
      (Platform.isAndroid &&
          verified?.state == IapkitPurchaseState.PendingAcknowledgment);
  if (verified?.isValid == true &&
      allowedState &&
      verified?.productId == purchase.productId &&
      verified?.productId == ${productIdLiteral}) {
    grantEntitlement(verified!.productId!);
    if (verified.clientPayload != null) {
      applyPublicRules(verified.clientPayload!);
    }
    await FlutterInappPurchase.instance.finishTransaction(
      purchase: purchase,
      isConsumable: false,
    );
  }
}`;
    case "kmp":
      return `import io.github.hyochan.kmpiap.*

suspend fun verifyAndGrant(purchase: Purchase, isIos: Boolean) {
    val result = kmpIapInstance.verifyPurchaseWithProvider(
        VerifyPurchaseWithProviderProps(
            provider = PurchaseVerificationProvider.Iapkit,
            iapkit = RequestVerifyPurchaseWithIapkitProps(
                apiKey = ${apiKeyLiteral},
                includeClientPayload = true,
                apple = if (isIos) {
                    RequestVerifyPurchaseWithIapkitAppleProps(
                        jws = purchase.purchaseToken.orEmpty(),
                    )
                } else null,
                google = if (!isIos) {
                    RequestVerifyPurchaseWithIapkitGoogleProps(
                        purchaseToken = purchase.purchaseToken.orEmpty(),
                    )
                } else null,
            ),
        ),
    )

    val verified = result.iapkit
    val verifiedProductId = verified?.productId
    val allowedState =
        verified?.state == IapkitPurchaseState.Entitled ||
            (!isIos && verified?.state == IapkitPurchaseState.PendingAcknowledgment)
    if (verified?.isValid == true &&
        allowedState &&
        verifiedProductId != null &&
        verifiedProductId == purchase.productId &&
        verifiedProductId == ${productIdLiteral}) {
        grantEntitlement(verifiedProductId)
        verified.clientPayload?.let(::applyPublicRules)
        kmpIapInstance.finishTransaction(purchase = purchase, isConsumable = false)
    }
}`;
    case "godot":
      return `const Types = preload("res://addons/godot-iap/types.gd")

func verify_and_grant(purchase: Variant) -> void:
    var token = purchase.get("purchaseToken", "")
    var iapkit = {
        "apiKey": ${apiKeyLiteral},
        "includeClientPayload": true,
    }
    if OS.get_name() == "iOS":
        iapkit["apple"] = { "jws": token }
    else:
        iapkit["google"] = { "purchaseToken": token }

    var result = await GodotIapPlugin.verify_purchase_with_provider({
        "provider": "iapkit",
        "iapkit": iapkit,
    })
    var verified = result.iapkit
    var allowed_state = (
        verified != null
        and (
            verified.state == Types.IapkitPurchaseState.ENTITLED
            or (
                OS.get_name() != "iOS"
                and verified.state == Types.IapkitPurchaseState.PENDING_ACKNOWLEDGMENT
            )
        )
    )
    if (
        verified != null
        and verified.is_valid
        and allowed_state
        and verified.product_id == purchase.get("productId", "")
        and verified.product_id == ${productIdLiteral}
    ):
        grant_entitlement(verified.product_id)
        if verified.client_payload != null:
            apply_public_rules(verified.client_payload)
        await GodotIapPlugin.finish_transaction_dict(purchase, false)`;
    case "maui":
      return `using OpenIap;
using OpenIap.Maui;

const string IapkitPublishableKey = ${apiKeyLiteral};
const string ExpectedProductId = ${productIdLiteral};

async Task VerifyAndGrantAsync(Purchase purchase)
{
    var token = purchase.PurchaseToken ?? "";
    var isApple = purchase.Store == IapStore.Apple;
    var result = await OpenIapClient.Mutation.VerifyPurchaseWithProviderAsync(
        new VerifyPurchaseWithProviderProps
        {
            Provider = PurchaseVerificationProvider.Iapkit,
            Iapkit = new RequestVerifyPurchaseWithIapkitProps
            {
                ApiKey = IapkitPublishableKey,
                IncludeClientPayload = true,
                Apple = isApple
                    ? new RequestVerifyPurchaseWithIapkitAppleProps { Jws = token }
                    : null,
                Google = isApple
                    ? null
                    : new RequestVerifyPurchaseWithIapkitGoogleProps { PurchaseToken = token },
            },
        });

    var verified = result.Iapkit;
    var verifiedProductId = verified?.ProductId;
    var allowedState =
        verified?.State == IapkitPurchaseState.Entitled ||
        (!isApple && verified?.State == IapkitPurchaseState.PendingAcknowledgment);
    if (verified is { IsValid: true } &&
        allowedState &&
        verifiedProductId is not null &&
        verifiedProductId == purchase.ProductId &&
        verifiedProductId == ExpectedProductId)
    {
        GrantEntitlement(verifiedProductId);
        if (verified.ClientPayload is { } payload) ApplyPublicRules(payload);
        await OpenIapClient.Mutation.FinishTransactionAsync(
            new PurchaseInput(purchase),
            isConsumable: false);
    }
}`;
    case "ios":
      return `import OpenIAP

let iapkitApiKey = ${apiKeyLiteral}
let productId = ${productIdLiteral}
let iapStore = OpenIapStore()

try await iapStore.initConnection()
try await iapStore.fetchProducts(skus: [productId], type: .inApp)

if let purchase = try await iapStore.requestPurchase(sku: productId, type: .inApp),
   let jws = purchase.purchaseToken {
    let verification = try await iapStore.verifyPurchaseWithProvider(
        VerifyPurchaseWithProviderProps(
            iapkit: RequestVerifyPurchaseWithIapkitProps(
                apiKey: iapkitApiKey,
                apple: RequestVerifyPurchaseWithIapkitAppleProps(jws: jws),
                google: nil,
                includeClientPayload: true
            ),
            provider: .iapkit
        )
    )
    if verification?.isValid == true,
       verification?.state == .entitled,
       verification?.productId == purchase.productId,
       verification?.productId == productId {
        grantEntitlement(purchase.productId)
        if let payload = verification?.clientPayload {
            applyPublicRules(payload)
        }
        try await iapStore.finishTransaction(purchase: purchase, isConsumable: false)
    }
}`;
    case "android":
      return `import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.IapkitPurchaseState
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.PurchaseVerificationProvider
import dev.hyo.openiap.RequestPurchaseAndroidProps
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.RequestPurchasePropsByPlatforms
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitGoogleProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps
import dev.hyo.openiap.VerifyPurchaseWithProviderProps
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private val openIap by lazy { OpenIapModule(this) }
    private val iapkitApiKey = ${apiKeyLiteral}
    private val productId = ${productIdLiteral}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openIap.setActivity(this)
        openIap.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { purchase ->
            lifecycleScope.launch {
                val token = purchase.purchaseToken ?: return@launch
                val verification = openIap.verifyPurchaseWithProvider(
                    VerifyPurchaseWithProviderProps(
                        iapkit = RequestVerifyPurchaseWithIapkitProps(
                            apiKey = iapkitApiKey,
                            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                                purchaseToken = token
                            ),
                            includeClientPayload = true
                        ),
                        provider = PurchaseVerificationProvider.Iapkit
                    )
                ).iapkit
                val verifiedProductId = verification?.productId
                val allowedState =
                    verification?.state == IapkitPurchaseState.Entitled ||
                        verification?.state == IapkitPurchaseState.PendingAcknowledgment
                if (verification?.isValid == true &&
                    allowedState &&
                    verifiedProductId != null &&
                    verifiedProductId == purchase.productId &&
                    verifiedProductId == productId) {
                    grantEntitlement(verifiedProductId)
                    verification.clientPayload?.let(::applyPublicRules)
                    openIap.finishTransaction(purchase, false)
                }
            }
        })

        lifecycleScope.launch {
            openIap.initConnection(null)
            openIap.fetchProducts(
                ProductRequest(skus = listOf(productId), type = ProductQueryType.InApp)
            )
        }
    }

    fun buyPremium() {
        lifecycleScope.launch {
            openIap.setActivity(this@MainActivity)
            openIap.requestPurchase(
                RequestPurchaseProps(
                    request = RequestPurchaseProps.Request.Purchase(
                        RequestPurchasePropsByPlatforms(
                            google = RequestPurchaseAndroidProps(skus = listOf(productId))
                        )
                    ),
                    type = ProductQueryType.InApp
                )
            )
        }
    }
}`;
  }
}

function codeStringLiteral(value) {
  return JSON.stringify(value);
}

export function simulatePurchaseSteps(args) {
  if (args.platform === "IOS") {
    return [
      "Open the host app's Xcode scheme.",
      "Set Run > Options > StoreKit Configuration to a .storekit file containing the product.",
      `Run on Simulator and trigger the in-app purchase for ${args.productId}.`,
      "On purchase complete, kit's verifyReceipt route ingests the JWS; the matching ASN v2 TEST notification can be triggered from App Store Connect → App Store Server Notifications → Send Test Notification.",
    ];
  }
  return [
    "Open Google Play Console → Setup → License testing.",
    "Add your tester Google account.",
    `Sideload the host app and trigger the in-app purchase for ${args.productId} signed-in as the tester.`,
    "Pub/Sub will deliver an RTDN to /v1/webhooks/{apiKey} once the configured topic + subscription are wired.",
  ];
}
