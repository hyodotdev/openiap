// IAPKit talks to the main docs site via a configurable URL. Defaults
// to https://openiap.dev so local dev works without extra env setup;
// override with VITE_KIT_DOCS_URL if you fork or run docs on a custom domain.
const rawDocsUrl = import.meta.env.VITE_KIT_DOCS_URL as string | undefined;
export const DOCS_URL =
  typeof rawDocsUrl === "string" && rawDocsUrl.length > 0
    ? rawDocsUrl
    : "https://openiap.dev";

export const MIXPANEL_TOKEN = import.meta.env.VITE_KIT_MIXPANEL_TOKEN as
  | string
  | undefined;
