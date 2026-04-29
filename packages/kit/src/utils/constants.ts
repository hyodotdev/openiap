// App info
export const APP_NAME = "IAPKit";
export const APP_URL = "https://openiap-kit.com";
export const APP_DESCRIPTION = "Next-generation IAP integration solution";

// Contact
export const SUPPORT_EMAIL = "hyo@hyo.dev";
export const CONTACT_EMAIL = "hyo@hyo.dev";

if (!SUPPORT_EMAIL || !CONTACT_EMAIL) {
  throw new Error("SUPPORT_EMAIL and CONTACT_EMAIL must be set");
}

// Social links
export const SOCIAL_LINKS = {
  twitter: "https://twitter.com/openiap-kit",
  github: "https://github.com/openiap-kit",
  discord: "https://discord.gg/5AQd8BbxWT",
};
