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
  });
});
