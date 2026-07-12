import { describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const projectRoot = path.resolve(import.meta.dir, "../../..");
const quickReference = fs.readFileSync(
  path.join(projectRoot, "packages/docs/public/llms.txt"),
  "utf-8",
);
const fullReference = fs.readFileSync(
  path.join(projectRoot, "packages/docs/public/llms-full.txt"),
  "utf-8",
);
const compiledContext = fs.readFileSync(
  path.join(projectRoot, "knowledge/_claude-context/context.md"),
  "utf-8",
);

describe("generated LLM references", () => {
  test("uses the current product request and error-code shapes", () => {
    expect(quickReference).toContain(
      "skus: ['com.app.premium', 'com.app.pro']",
    );
    expect(quickReference).not.toContain("products: [");
    expect(quickReference).toContain("ErrorCode.UserCancelled");
    expect(quickReference).toContain("| user-cancelled |");
    expect(quickReference).toContain("| duplicate-purchase |");
    expect(quickReference).toContain("code: ErrorCode;");
    expect(quickReference).toContain(
      "subResponseCodeAndroid?: SubResponseCodeAndroid | null;",
    );
    expect(quickReference).toContain(
      "type PurchaseState = 'pending' | 'purchased' | 'unknown';",
    );
    expect(quickReference).not.toContain("'restored'");
  });

  test("uses canonical platform keys and excludes legacy API references", () => {
    expect(fullReference).toContain(
      "request: { apple: { sku: 'premium' }, google: { skus: ['premium'] } }",
    );
    for (const generatedReference of [fullReference, compiledContext]) {
      expect(generatedReference).not.toContain(
        "request: { ios: { sku: 'premium' }, android: { skus: ['premium'] } }",
      );
      expect(generatedReference).not.toContain(
        "# react-native-iap API Reference (Legacy)",
      );
      expect(generatedReference).not.toContain("# expo-iap API Reference");
      expect(generatedReference).not.toContain("E_USER_CANCELLED");
      expect(generatedReference).not.toContain("fetchProducts(['");
      expect(generatedReference).not.toContain("requestPurchase({ sku:");
    }
    expect(fullReference).toContain("type: ProductQueryType.InApp");
    expect(fullReference).toContain("iap.purchaseUpdatedListener.listen");
    expect(fullReference).toContain(
      "iap.finishTransaction(purchase: purchase, isConsumable: true)",
    );
    expect(fullReference).toContain(
      "await GodotIapPlugin.fetch_products(request)",
    );
    expect(fullReference).toContain("val products = iap.fetchProducts {");
  });

  test("documents every Android production source set", () => {
    expect(compiledContext).toContain(
      "main/java/dev/hyo/openiap/     # Shared code + generated Types.kt",
    );
    expect(compiledContext).toContain(
      "play/java/dev/hyo/openiap/     # Google Play Billing",
    );
    expect(compiledContext).toContain(
      "horizon/java/dev/hyo/openiap/  # Meta Horizon Billing",
    );
    expect(compiledContext).toContain(
      "amazon/java/dev/hyo/openiap/   # Amazon Appstore",
    );
    expect(compiledContext).toContain(
      "play/java/dev/hyo/openiap/       # Google Play Billing implementation",
    );
    expect(compiledContext).toContain(
      "horizon/java/dev/hyo/openiap/    # Meta Horizon implementation",
    );
    expect(compiledContext).toContain(
      "amazon/java/dev/hyo/openiap/     # Amazon Appstore implementation",
    );
    expect(compiledContext).not.toContain("Amazon Appstore / Vega OS");
    expect(compiledContext).not.toContain("Amazon Appstore, and Vega OS");
    expect(compiledContext).not.toContain("Models.kt");
  });

  test("documents the generated fetch-products contract", () => {
    expect(compiledContext).toContain(
      "public func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult",
    );
    expect(compiledContext).toContain(
      "suspend fun fetchProducts(params: ProductRequest): FetchProductsResult",
    );
    expect(compiledContext).not.toContain(
      "fetchProducts(_ productIds: [String]) async throws -> [ProductIOS]",
    );
    expect(compiledContext).not.toContain(
      "fetchProducts(productIds: List<String>): List<ProductAndroid>",
    );
  });
});
