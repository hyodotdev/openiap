# Submit your app to the OpenIAP showcase

Shipped an app with `react-native-iap`, `expo-iap`, `flutter_inapp_purchase`,
`kmp-iap`, `maui-iap`, or `godot-iap`? Add it to the
**[Who uses OpenIAP?](https://www.openiap.dev)** section on the home page.

It's one entry in [`showcase-apps.json`](./showcase-apps.json).

## Open a pull request

1. Fork [hyodotdev/openiap](https://github.com/hyodotdev/openiap) and create a branch.
2. Add your app to the end of the `apps` array in `packages/docs/showcase-apps.json`:

   ```json
   {
     "name": "Your App",
     "tagline": "One line about what your app does",
     "logo": "/showcase/your-app.webp",
     "library": "expo-iap",
     "ios": "https://apps.apple.com/us/app/your-app/id0000000000",
     "android": "https://play.google.com/store/apps/details?id=com.example.yourapp"
   }
   ```

3. Add your icon to `packages/docs/public/showcase/` as a **square 512×512 PNG**
   or a 256×256 `.webp`. Don't pre-round the corners — we apply the same rounded
   mask to every icon so the row stays consistent.
4. Open the PR with the title `docs: add <Your App> to showcase`.

That's it. No build step or code change is needed — the pages render the JSON
directly.

## Ordering

Apps are ordered by **combined App Store + Google Play review count**,
descending, with the Google Play install count as a tiebreaker. Neither store
publishes download totals — Apple exposes no install data publicly and Play
reports only a bucket like "1K+" — so review count is the one verifiable signal
both stores share.

App Store review counts are **summed across every storefront**, not just the US
one: Apple reports `userRatingCount` per country and publishes no global total,
so an app reviewed mainly in Korea or Japan would otherwise read as zero.

Maintainers refresh the numbers with:

```bash
cd packages/docs && bun run showcase:metrics
```

Leave `ratings` and `installs` out of your PR — the script fills them in.

## Fields

| Field     | Required | Notes                                                                                  |
| --------- | -------- | -------------------------------------------------------------------------------------- |
| `name`    | ✅       | App name as it appears on the stores.                                                   |
| `tagline` | ✅       | One short line. Keep it under ~70 characters so cards stay even.                         |
| `logo`    | ✅       | Path under `packages/docs/public` (e.g. `/showcase/your-app.webp`) or a full https URL.  |
| `ratings` / `installs` | — | Maintainer-managed ordering metrics. Leave these out.                       |
| `library` | ✅       | One of `expo-iap`, `react-native-iap`, `flutter_inapp_purchase`, `kmp-iap`, `maui-iap`, `godot-iap`. |
| `ios`     | —        | App Store URL.                                                                          |
| `android` | —        | Google Play URL.                                                                        |
| `web`     | —        | Website or other store, shown as "Website".                                             |

At least one of `ios`, `android`, or `web` is required — entries without a link
are skipped at render time.

## Don't want to send a PR?

Comment on [issue #280](https://github.com/hyodotdev/openiap/issues/280) or
email **hyo@hyo.dev** with your app name, one-liner, logo, store links, and which
library you use — we'll add it for you.

## Removal and updates

Your app is listed only with your permission. To change or remove an entry, open
a PR, comment on issue #280, or email hyo@hyo.dev anytime.
