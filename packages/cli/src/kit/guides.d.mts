export const SETUP_FRAMEWORKS: readonly [string, ...string[]];
export function renderSetupSnippet(
  framework: string,
  apiKey: string,
  productId: string,
): string;
export function simulatePurchaseSteps(args: {
  platform: "IOS" | "Android";
  productId: string;
}): string[];
