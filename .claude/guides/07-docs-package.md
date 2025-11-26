# Documentation Package Guide

Location: `packages/docs/`

## Tech Stack

- React 18 + TypeScript + Vite
- react-helmet-async (SEO)
- Vercel (deployment)

## SEO

Every page needs SEO component:

```tsx
<SEO
  title="Page Title"
  description="Description"
  path="/page-path"
  keywords="keyword1, keyword2"
/>
```

Include both old and new terms for searchability:

```tsx
keywords =
  "verifyPurchase, validateReceipt, purchase verification, receipt validation";
```

## Sitemap

Update `public/sitemap.xml` when adding pages.

## Development

```bash
bun run dev        # Dev server
bun run build      # Build
bun run lint       # Lint
bun run typecheck  # Type check
```

## Deployment

Automatic via Vercel on push to main.
