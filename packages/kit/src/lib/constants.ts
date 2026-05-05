// Shared kit-side runtime constants. Single source of truth for
// values that surface in multiple UI locations (footer, dashboard
// topbar, marketing copy) so a URL / project change is a one-line
// edit instead of a grep-and-replace risk.

// Deep-link straight to `packages/kit/` inside the openiap monorepo
// so visitors land on the kit-specific tree (README, server, convex,
// src) rather than the broader IAP-SDK monorepo root that includes
// every platform library.
export const KIT_REPO_URL =
  "https://github.com/hyodotdev/openiap/tree/main/packages/kit";
