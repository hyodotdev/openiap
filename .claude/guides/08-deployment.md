# Deployment Guide

## Package Deployment

| Package | Registry        | How                                                       |
| ------- | --------------- | --------------------------------------------------------- |
| apple   | CocoaPods + SPM | GitHub Actions "Apple Release"                            |
| google  | Maven Central   | GitHub Actions "Google Release"                           |
| docs    | Vercel          | Auto on push                                              |
| gql     | npm + GitHub    | `npm run deploy`                                          |
| kit     | Fly.io          | `deploy-kit.yml` auto on push to main (`packages/kit/**`) |

## Apple Release

1. Actions → "Apple Release" → Run workflow
2. Enter version (e.g., `1.2.24`)
3. Creates tag `apple-v1.2.24`, publishes to CocoaPods

## Google Release

1. Actions → "Google Release" → Run workflow
2. Enter version (e.g., `1.2.14`)
3. Creates tag `google-v1.2.14`, publishes to Maven Central

## GQL Release

```bash
npm run deploy 1.2.0
```

## Kit Deploy

Auto-deploys on push to `main` when `packages/kit/**` changes. Workflow: `.github/workflows/deploy-kit.yml`. Required secrets:

- `KIT_FLY_API_TOKEN` — Fly deploy token (real secret)
- `KIT_CONVEX_DEPLOY_KEY` — Convex prod deploy key (real secret, optional)
- `VITE_KIT_CONVEX_URL` / `VITE_KIT_SENTRY_DSN` / `VITE_KIT_MIXPANEL_TOKEN` — public-by-design (baked into SPA bundle, listed as secrets only for build-time injection)

Manual fallback: `cd packages/kit && bun run deploy:prod` (sources `.env.production`, refuses to deploy if URL looks like dev). Kit is **not** in the `packages/gql` type-sync chain — it has its own Convex schema.

## Version Coordination

For breaking changes:

1. Update `packages/gql` schema
2. Run `bun run generate && bun run sync`
3. Update apple, google packages
4. Deploy: gql → apple → google → docs
