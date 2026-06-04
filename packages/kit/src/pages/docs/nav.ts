// Single source of truth for docs navigation. Each entry is a
// section with optional children; the router + sidebar both read from
// here, so adding a page is one object in this tree plus the matching
// route component.

export interface DocsNavEntry {
  /** URL slug under `/docs` (empty string = index/introduction). */
  slug: string;
  /** Short label for the sidebar. */
  title: string;
  /** One-line description for sub-section hover / landing tiles. */
  summary?: string;
  /** Child entries — nested once; deeper nesting would be a smell. */
  children?: DocsNavEntry[];
}

export const DOCS_NAV: DocsNavEntry[] = [
  {
    slug: "",
    title: "Introduction",
    summary: "What IAPKit is and when to use it.",
  },
  {
    slug: "quickstart",
    title: "Quickstart",
    summary: "From sign-up to a green /purchase/verify in five minutes.",
  },
  {
    slug: "projects",
    title: "Projects & API keys",
    summary: "Managing projects, issuing keys, scoping access.",
  },
  {
    slug: "verification",
    title: "Store setup",
    summary: "Per-store configuration for managed receipt validation.",
    children: [
      {
        slug: "verification/apple",
        title: "Apple App Store",
        summary: "Bundle ID, Apple ID, Issuer/Key ID, .p8 upload.",
      },
      {
        slug: "verification/google",
        title: "Google Play",
        summary: "Package name, service account JSON, permissions.",
      },
      {
        slug: "verification/horizon",
        title: "Meta Horizon",
        summary: "App ID + App Secret for Quest entitlement checks.",
      },
    ],
  },
  {
    slug: "api",
    title: "API reference",
    summary: "POST /v1/purchase/verify — request shapes, responses, errors.",
  },
  {
    slug: "analytics",
    title: "Analytics",
    summary: "Revenue / MRR / churn dashboard — requires webhook integration.",
  },
  {
    slug: "operations",
    title: "Operations",
    summary: "Rate limits, correlation IDs, /health, structured logs.",
  },
  {
    slug: "ai-assistants",
    title: "AI assistants",
    summary: "llms.txt, MCP, and ChatGPT connector setup.",
    children: [
      {
        slug: "ai-assistants/chatgpt-plugin",
        title: "ChatGPT plugin",
        summary: "Connect ChatGPT to IAPKit through the /mcp endpoint.",
      },
    ],
  },
  {
    slug: "release-notes",
    title: "Release notes",
    summary: "Every release that touched this deployment, newest first.",
  },
];

/** Flatten the tree so the router can enumerate all renderable pages. */
export function flattenDocsNav(
  entries: DocsNavEntry[] = DOCS_NAV,
): DocsNavEntry[] {
  const flat: DocsNavEntry[] = [];
  for (const entry of entries) {
    flat.push(entry);
    if (entry.children) {
      flat.push(...flattenDocsNav(entry.children));
    }
  }
  return flat;
}
