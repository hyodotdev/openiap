# Submit your app to the OpenIAP showcase

Shipped an app with `react-native-iap`, `expo-iap`, `flutter_inapp_purchase`,
`kmp-iap`, `maui-iap`, or `godot-iap`? Add it to the
**[Apps built with OpenIAP](https://www.openiap.dev)** section on the home page.

Each app is one entry in [`showcase-apps.json`](./showcase-apps.json).

Submitting more than one app? Add every app and icon to the same pull request.
Do not open one pull request per app.

## Open a pull request

1. Fork [hyodotdev/openiap](https://github.com/hyodotdev/openiap) and create a branch.
2. Add your app to the end of the `apps` array in `packages/docs/showcase-apps.json`:

   ```json
   {
     "name": "Your App",
     "tagline": "One line about what your app does",
     "logo": "/showcase/your-app.webp",
     "library": "expo-iap",
     "iapkit": true,
     "ios": "https://apps.apple.com/us/app/your-app/id0000000000",
     "android": "https://play.google.com/store/apps/details?id=com.example.yourapp"
   }
   ```

3. Use an official HTTPS app icon URL, or add your icon to `packages/docs/public/showcase/` as a **square 512×512 PNG**
   or a 256×256 `.webp`. Don't pre-round the corners — we apply the same rounded
   mask to every icon so the row stays consistent.
4. Open the PR with the title `docs: add <Your App> to showcase`.

That's it. No build step or code change is needed — the pages render the JSON
directly.

## Ordering

All apps share one ranking: **Google Play's public download floor**, descending.
Apps without a public Play count follow those with a count; ties use the app
name. Apple does not publish download counts, so iOS downloads are not estimated.
The home page highlights the first four apps; Community Resources shows five,
using this same order.

Refresh downloads with:

```bash
cd packages/docs && bun run showcase:downloads
```

`bun run showcase:metrics` also refreshes store review counts, including Apple's
storefronts. Reviews and GitHub stars do not affect the order.
Leave `ratings` and `installs` out of submissions; maintainers refresh them.

## GitHub apps

The same grid includes apps from public dependents of `expo-iap`,
`flutter_inapp_purchase`, and `react-native-iap` with at least 10 stars.
`github.repositories` holds the dependency snapshot; `github.apps` holds reviewed
app names, descriptions, remote icon URLs, and verified store links. SDKs,
tutorials, and duplicate app forks stay in the snapshot without becoming app
cards. Unavailable store pages are omitted.

Use the app's official store icon URL when available, or an icon from its source
repository pinned to a commit. Icons are linked directly rather than downloaded.
Each app has a GitHub link with its star count next to the icon.

The heading's dependent count sums GitHub's publicly visible package estimates;
repositories using multiple packages may count more than once. Counts of 100 or
more are rounded down to hundreds with `+`. The count links to the
`react-native-iap` dependency graph, and its tooltip states the basis and date.

Refresh the snapshot and README count with:

```bash
cd packages/docs && bun run showcase:github
```

The script follows every page for each package and preserves curated app data.
It stops if a curated app is missing from the new snapshot; verify whether its
dependency or star eligibility changed before removing its curated entry.
It writes only after all requests and the README markers validate.
`github.showcasePackages` selects the three libraries used for app discovery.
The retired `openiap-commerce-protocol` and empty `github.com/hyodotdev/openiap`
entries are excluded through `github.excludedPackages`.

## Fields

| Field                  | Required | Notes                                                                                                |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `name`                 | ✅       | App name as it appears on the stores.                                                                |
| `tagline`              | ✅       | One short line. Keep it under ~70 characters so cards stay even.                                     |
| `logo`                 | ✅       | Path under `packages/docs/public` (e.g. `/showcase/your-app.webp`) or a full https URL.              |
| `ratings` / `installs` | —        | Maintainer-managed ordering metrics. Leave these out.                                                |
| `library`              | ✅       | One of `expo-iap`, `react-native-iap`, `flutter_inapp_purchase`, `kmp-iap`, `maui-iap`, `godot-iap`. |
| `iapkit`               | —        | Set to `true` only when the app uses IAPKit. Omit it otherwise.                                      |
| `ios`                  | —        | App Store URL.                                                                                       |
| `android`              | —        | Google Play URL.                                                                                     |
| `web`                  | —        | Website or other store, shown as "Website".                                                          |
| `github`               | —        | Repository URL, shown as a GitHub icon.                                                              |

At least one of `ios`, `android`, `web`, or `github` is required — entries without a link
are skipped at render time.

## Don't want to send a PR?

Reply to [discussion #350](https://github.com/hyodotdev/openiap/discussions/350) or
email **hyo@hyo.dev** with your app name, one-liner, logo, store links, and which
library you use. Also tell us whether you use IAPKit.

## Removal and updates

Submitted apps are listed with the owner's permission. To change or remove an entry, open
a PR, comment on discussion #350, or email hyo@hyo.dev anytime.
