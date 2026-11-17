export const SETUP_FRAMEWORKS: readonly [string, ...string[]];
export function renderSetupGuide(
  framework: string,
  apiKey: string,
  productId: string,
): { framework: string; snippet: string; coverage: string };
export function simulatePurchaseSteps(args: {
  platform: "IOS" | "Android";
  productId: string;
}): string[];
