# Deployment Guide

## Package Deployment

| Package | Registry        | How                             |
| ------- | --------------- | ------------------------------- |
| apple   | CocoaPods + SPM | GitHub Actions "Apple Release"  |
| google  | Maven Central   | GitHub Actions "Google Release" |
| docs    | Vercel          | Auto on push                    |
| gql     | npm + GitHub    | `npm run deploy`                |

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

## Version Coordination

For breaking changes:

1. Update `packages/gql` schema
2. Run `bun run generate && bun run sync`
3. Update apple, google packages
4. Deploy: gql → apple → google → docs
