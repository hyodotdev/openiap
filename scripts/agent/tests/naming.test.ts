/**
 * Tests for OpenIAP naming conventions
 * These tests verify that the project follows its own naming rules
 */

import { describe, expect, test } from "bun:test";

// ============================================================================
// Naming Convention Validators
// ============================================================================

/**
 * Check if an iOS function name follows the IOS suffix convention
 */
function isValidIOSFunctionName(name: string, isIOSSpecific: boolean): boolean {
  if (isIOSSpecific) {
    return name.endsWith("IOS");
  }
  // Cross-platform functions should not have IOS suffix
  return !name.endsWith("IOS");
}

/**
 * Check if an Android function name follows the convention
 * - In packages/google: no Android suffix needed (it's Android-only package)
 * - In cross-platform code: Android-specific functions must have Android suffix
 */
function isValidAndroidFunctionName(
  name: string,
  isInGooglePackage: boolean,
  isAndroidSpecific: boolean = false
): boolean {
  if (isInGooglePackage) {
    // In packages/google, functions should NOT have Android suffix
    return !name.endsWith("Android");
  }
  // In cross-platform code, Android-specific functions need Android suffix
  if (isAndroidSpecific) {
    return name.endsWith("Android");
  }
  // Cross-platform functions should not have Android suffix
  return !name.endsWith("Android");
}

/**
 * Check if a cross-platform function has no platform suffix
 */
function isValidCrossPlatformFunctionName(name: string): boolean {
  return !name.endsWith("IOS") && !name.endsWith("Android");
}

/**
 * Check Swift acronym casing rules
 */
function isValidSwiftAcronymCasing(name: string): boolean {
  // Acronyms at the beginning or middle should be Pascal case (Iap)
  // Acronyms at the end should be ALL CAPS (IAP)

  // Check for IAP at end (should be uppercase)
  if (name.endsWith("IAP")) {
    return true;
  }

  // Check for Iap in the middle/beginning (should be Pascal case, not IAP)
  if (name.includes("IAP") && !name.endsWith("IAP")) {
    // IAP should not appear in the middle - should be Iap
    return false;
  }

  // Check for Iap at the end (should be IAP, not Iap)
  if (name.endsWith("Iap")) {
    return false;
  }

  return true;
}

/**
 * Check URL anchor format (should be kebab-case)
 */
function isValidURLAnchor(anchor: string): boolean {
  // Should be lowercase with hyphens
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(anchor);
}

/**
 * Convert function name to URL anchor
 */
function functionNameToAnchor(name: string): string {
  // Convert camelCase/PascalCase to kebab-case
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

// ============================================================================
// Tests
// ============================================================================

describe("iOS Function Naming", () => {
  test("iOS-specific functions should end with IOS", () => {
    const iosSpecificFunctions = [
      "clearTransactionIOS",
      "getStorefrontIOS",
      "syncIOS",
      "presentCodeRedemptionSheetIOS",
      "showManageSubscriptionsIOS",
      "isEligibleForIntroOfferIOS",
    ];

    for (const name of iosSpecificFunctions) {
      expect(isValidIOSFunctionName(name, true)).toBe(true);
    }
  });

  test("iOS-specific functions without IOS suffix should fail", () => {
    expect(isValidIOSFunctionName("clearTransaction", true)).toBe(false);
    expect(isValidIOSFunctionName("getStorefront", true)).toBe(false);
    expect(isValidIOSFunctionName("sync", true)).toBe(false);
  });

  test("cross-platform functions should not have IOS suffix", () => {
    const crossPlatformFunctions = [
      "fetchProducts",
      "requestPurchase",
      "getAvailablePurchases",
      "finishTransaction",
      "verifyPurchase",
    ];

    for (const name of crossPlatformFunctions) {
      expect(isValidIOSFunctionName(name, false)).toBe(true);
    }
  });
});

describe("Android Function Naming", () => {
  test("functions in packages/google should NOT have Android suffix", () => {
    const googlePackageFunctions = [
      "acknowledgePurchase",
      "consumePurchase",
      "getPackageName",
      "buildModule",
    ];

    for (const name of googlePackageFunctions) {
      expect(isValidAndroidFunctionName(name, true)).toBe(true);
    }
  });

  test("functions with Android suffix in packages/google should fail", () => {
    expect(isValidAndroidFunctionName("acknowledgePurchaseAndroid", true)).toBe(
      false
    );
    expect(isValidAndroidFunctionName("consumePurchaseAndroid", true)).toBe(
      false
    );
    expect(isValidAndroidFunctionName("buildModuleAndroid", true)).toBe(false);
  });

  test("Android-specific functions in cross-platform code should have Android suffix", () => {
    // These are Android-specific functions used in expo-iap/react-native-iap
    const androidSpecificFunctions = [
      "acknowledgePurchaseAndroid",
      "consumePurchaseAndroid",
      "getPackageNameAndroid",
    ];

    for (const name of androidSpecificFunctions) {
      // isInGooglePackage=false, isAndroidSpecific=true
      expect(isValidAndroidFunctionName(name, false, true)).toBe(true);
    }
  });

  test("Android-specific functions without suffix in cross-platform code should fail", () => {
    // Missing Android suffix for Android-specific functions in cross-platform code
    expect(isValidAndroidFunctionName("acknowledgePurchase", false, true)).toBe(false);
    expect(isValidAndroidFunctionName("consumePurchase", false, true)).toBe(false);
  });
});

describe("Cross-Platform Function Naming", () => {
  test("cross-platform functions should have no platform suffix", () => {
    const crossPlatformFunctions = [
      "fetchProducts",
      "requestPurchase",
      "getAvailablePurchases",
      "finishTransaction",
      "verifyPurchase",
      "initConnection",
      "endConnection",
    ];

    for (const name of crossPlatformFunctions) {
      expect(isValidCrossPlatformFunctionName(name)).toBe(true);
    }
  });

  test("functions with platform suffixes should fail cross-platform check", () => {
    expect(isValidCrossPlatformFunctionName("fetchProductsIOS")).toBe(false);
    expect(isValidCrossPlatformFunctionName("fetchProductsAndroid")).toBe(false);
  });
});

describe("Swift Acronym Casing", () => {
  test("acronyms at the end should be ALL CAPS", () => {
    expect(isValidSwiftAcronymCasing("OpenIAP")).toBe(true);
    expect(isValidSwiftAcronymCasing("ProductIAP")).toBe(true);
  });

  test("acronyms at the beginning should be Pascal case", () => {
    expect(isValidSwiftAcronymCasing("IapManager")).toBe(true);
    expect(isValidSwiftAcronymCasing("IapPurchase")).toBe(true);
  });

  test("IAP in the middle should fail (should be Iap)", () => {
    expect(isValidSwiftAcronymCasing("OpenIAPManager")).toBe(false);
    expect(isValidSwiftAcronymCasing("MyIAPService")).toBe(false);
  });

  test("Iap at the end should fail (should be IAP)", () => {
    expect(isValidSwiftAcronymCasing("OpenIap")).toBe(false);
    expect(isValidSwiftAcronymCasing("ProductIap")).toBe(false);
  });
});

describe("URL Anchor Format", () => {
  test("valid kebab-case anchors", () => {
    expect(isValidURLAnchor("fetch-products")).toBe(true);
    expect(isValidURLAnchor("get-app-transaction-ios")).toBe(true);
    expect(isValidURLAnchor("init-connection")).toBe(true);
  });

  test("invalid anchor formats", () => {
    expect(isValidURLAnchor("fetchProducts")).toBe(false); // camelCase
    expect(isValidURLAnchor("Fetch-Products")).toBe(false); // PascalCase
    expect(isValidURLAnchor("fetch_products")).toBe(false); // snake_case
  });

  test("function name to anchor conversion", () => {
    expect(functionNameToAnchor("fetchProducts")).toBe("fetch-products");
    expect(functionNameToAnchor("getAppTransactionIOS")).toBe(
      "get-app-transaction-ios"
    );
    expect(functionNameToAnchor("initConnection")).toBe("init-connection");
  });
});

describe("Action Prefix Rules", () => {
  const prefixRules: Record<string, string[]> = {
    get: ["getStorefrontIOS", "getPackageName", "getPromotedProductIOS"],
    fetch: ["fetchProducts"],
    request: ["requestPurchase"],
    clear: ["clearTransactionIOS", "clearProductsIOS"],
    is: ["isEligibleForIntroOfferIOS"],
    has: ["hasActiveSubscriptions"],
    show: ["showManageSubscriptionsIOS"],
    present: ["presentCodeRedemptionSheetIOS"],
    begin: ["beginRefundRequestIOS"],
    finish: ["finishTransaction"],
    end: ["endConnection"],
    init: ["initConnection"],
    verify: ["verifyPurchase"],
  };

  for (const [prefix, functions] of Object.entries(prefixRules)) {
    test(`functions starting with "${prefix}" follow convention`, () => {
      for (const name of functions) {
        const lowerName = name.toLowerCase();
        expect(lowerName.startsWith(prefix)).toBe(true);
      }
    });
  }
});
