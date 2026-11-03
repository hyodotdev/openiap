// Top-level paths the signed-in app routes before `:orgSlug`
// (src/pages/auth/index.tsx and src/pages/site-routes.tsx). An organization
// with one of these slugs could never open its overview page.
export const RESERVED_ORG_SLUGS: ReadonlySet<string> = new Set([
  "docs",
  "onboarding",
  "profile",
  "faq",
  "pricing",
  "blog",
  "about",
  "contact",
  "terms-of-service",
  "privacy-policy",
  "termsofservice",
  "privacyandpolicy",
]);
