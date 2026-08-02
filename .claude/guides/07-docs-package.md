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

Production deployment is manual and stable-only. Run it from a clean,
up-to-date `main` checkout at the repository root:

```bash
npm run deploy
```

Merging to `main` does not publish docs — there is no docs deploy workflow, so
this local command is the only path to production.

A routine docs deployment stops there. Do not create a Docs GitHub Release for
it; that step belongs to a spec release, as documented in
`.claude/commands/release.md`. Branch guards, version ownership, deploy
verification, and the full deployment contract live in
`knowledge/internal/06-git-deployment.md`; do not duplicate them here.
