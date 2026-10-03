// Compatibility entry point for Android provider report consumers.
import { providerProfile } from "./provider-profile.mjs";
export { requiredProviderBehaviors } from "./provider-profile.mjs";
export const ANDROID_PROVIDER_PROFILE = providerProfile("android");
