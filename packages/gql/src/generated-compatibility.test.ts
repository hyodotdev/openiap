import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function generated(name: string): string {
  return readFileSync(new URL(`./generated/${name}`, import.meta.url), "utf8");
}

describe("generated compatibility", () => {
  it("preserves the published MAUI 1.x string signatures", () => {
    const csharp = generated("Types.cs");

    for (const method of [
      "DeepLinkToSubscriptions",
      "FinishTransaction",
      "RestorePurchases",
    ]) {
      expect(csharp).toContain(`Task<string> ${method}Async(`);
      expect(csharp).not.toContain(`Task<VoidResult> ${method}Async(`);
    }
  });

  it("keeps new user-choice details optional outside Kotlin", () => {
    expect(generated("types.ts")).toContain(
      "productDetailsAndroid?: (DeveloperProvidedBillingProductAndroid[] | null);",
    );
    expect(generated("types.dart")).toContain(
      "final List<DeveloperProvidedBillingProductAndroid>? productDetailsAndroid;",
    );
    expect(generated("Types.swift")).toContain(
      "public var productDetailsAndroid: [DeveloperProvidedBillingProductAndroid]? = nil",
    );
    expect(generated("Types.cs")).toContain(
      "public IReadOnlyList<DeveloperProvidedBillingProductAndroid>? ProductDetailsAndroid { get; init; }",
    );
  });

  it("keeps additive Kotlin fields out of published data-class constructors", () => {
    const kotlin = generated("Types.kt");
    const userChoice = kotlin.slice(
      kotlin.indexOf("public data class UserChoiceBillingDetails("),
      kotlin.indexOf("public data class ValidTimeWindowAndroid("),
    );
    const purchaseError = kotlin.slice(
      kotlin.indexOf("public data class PurchaseError("),
      kotlin.indexOf("public data class PurchaseIOS("),
    );
    const iapkitResult = kotlin.slice(
      kotlin.indexOf("public data class RequestVerifyPurchaseWithIapkitResult("),
      kotlin.indexOf("public data class SubscriptionCommitmentInfoIOS("),
    );
    const iapkitProps = kotlin.slice(
      kotlin.indexOf("public data class RequestVerifyPurchaseWithIapkitProps("),
      kotlin.indexOf("public data class SubscriptionProductReplacementParamsAndroid("),
    );
    const withoutDocComments = (value: string) =>
      value.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");
    const iapkitResultPrimary = withoutDocComments(
      iapkitResult.slice(0, iapkitResult.indexOf(") {") + 3),
    );
    const iapkitPropsPrimary = withoutDocComments(
      iapkitProps.slice(0, iapkitProps.indexOf(") {") + 3),
    );

    expect(userChoice).toContain("val externalTransactionToken: String,");
    expect(userChoice).toContain("val products: List<String>");
    expect(userChoice).toContain(
      "var productDetailsAndroid: List<DeveloperProvidedBillingProductAndroid>? = null",
    );
    expect(purchaseError).toContain(
      "var subResponseCodeAndroid: SubResponseCodeAndroid? = null",
    );
    expect(userChoice).toContain("private set");
    expect(purchaseError).toContain("private set");
    expect(iapkitResultPrimary).toContain(
      "public data class RequestVerifyPurchaseWithIapkitResult( val isValid: Boolean, val state: IapkitPurchaseState, val store: IapStore ) {",
    );
    expect(iapkitResult).toContain(
      "var clientPayload: IapkitProductClientPayload? = null",
    );
    expect(iapkitResult).toContain("var productId: String? = null");
    expect(iapkitResultPrimary).not.toContain("clientPayload");
    expect(iapkitResultPrimary).not.toContain("productId");
    expect(iapkitPropsPrimary).toContain(
      "public data class RequestVerifyPurchaseWithIapkitProps( val amazon: RequestVerifyPurchaseWithIapkitAmazonProps? = null, val apiKey: String? = null, val apple: RequestVerifyPurchaseWithIapkitAppleProps? = null, val baseUrl: String? = null, val google: RequestVerifyPurchaseWithIapkitGoogleProps? = null ) {",
    );
    expect(iapkitProps).toContain(
      "var includeClientPayload: Boolean? = null",
    );
    expect(iapkitResult).toContain("private set");
    expect(iapkitProps).toContain("private set");
    expect(iapkitPropsPrimary).not.toContain("includeClientPayload");
  });
});
