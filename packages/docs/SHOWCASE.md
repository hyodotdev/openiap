# Submit your app to the OpenIAP showcase

Shipped an app with `react-native-iap`, `expo-iap`, `flutter_inapp_purchase`,
`kmp-iap`, `maui-iap`, or `godot-iap`? Add it to the
**[Apps built with OpenIAP](https://www.openiap.dev)** section on the home page.

Submit with your AI assistant through the private review queue, or contribute
an entry to [`showcase-apps.json`](./showcase-apps.json).

## Submit with AI

On [the showcase](https://www.openiap.dev/showcase#submit), expand
**Copy a prompt for your AI** and paste it into your assistant. It can use your
current app project or an app link to find the description, icon, store links,
category, and OpenIAP libraries. It asks for missing details and confirms your
contact email, ownership, and listing consent before submitting.

The MCP URL is `https://www.openiap.dev/mcp`. Some assistants require you to add
the server or restart first; no IAPKit API key is required. Keep the receipt ID
to ask your assistant for the review status.

The server exposes `openiap_showcase_options`, `openiap_showcase_submit_app`,
and `openiap_showcase_submission_status`.

Submissions and contact email stay private. The maintainer reviews them at
`/showcase/admin`; only approved app details appear on `/showcase`. No GitHub
issue or pull request is created. The contact email is never published.

## Open a pull request

1. Fork [hyodotdev/openiap](https://github.com/hyodotdev/openiap) and create a branch.
2. Add your app to the end of the `apps` array in `packages/docs/showcase-apps.json`:

   ```json
   {
     "name": "Your App",
     "tagline": "One line about what your app does",
     "category": "Work & productivity",
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

Submitting multiple apps by PR? Include them in the same pull request.

That's it. No build step or code change is needed — the pages render the JSON
directly.

## Search and categories

On `/showcase`, search by app name, description, library, or GitHub repository.
Combine the search with a category and library filter. Results keep the same
download order as the full catalog.

Set `category` to the app's main purpose. Reuse an existing category from
`showcase-apps.json`; the category choices come directly from those entries.
Both submitted apps and curated GitHub apps use this field.

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
When `SHOWCASE_DATABASE_URL` is set, the refresh command also updates approved
queue entries using the same Play metric. MCP submissions fetch that metric at approval. If Play does not
provide a count, they join the apps with unknown downloads.

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
| `category`             | ✅       | App purpose, using an existing category in the catalog.                                              |
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

Submitted apps are listed with the owner's permission. To change or remove an
entry, email hyo@hyo.dev anytime. Catalog entries can also be updated with a PR.

## Configure the private review queue

The docs site's Vercel functions own the queue and public catalog reads.
Flat `api/` adapters load the bundled `server/endpoints` implementation from
`server/generated/`. The docs build creates these bundles for Vercel's Node runtime.
`packages/mcp-server` owns the showcase MCP tools and their shared schema. This
endpoint is separate from `kit.openiap.dev/mcp`: it uses no IAPKit keys, accounts,
or customer database.

Before enabling the endpoint in a reviewed deployment:

1. Create a dedicated Neon PostgreSQL database for showcase submissions. Use a
   separate development database or branch for local tests and Vercel previews.
2. Before deployment, apply `server/showcase.sql` to that database manually
   with `bun run --cwd packages/docs showcase:database`. Set
   `SHOWCASE_DATABASE_URL` for that step. Do not point it at IAPKit customer storage.
3. Create a GitHub OAuth app with callback URL
   `https://www.openiap.dev/api/auth/callback/github`. For local Vercel development,
   use a separate OAuth app and `http://localhost:3000/api/auth/callback/github`.
4. Set the server-only environment variables from `.env.showcase.example` in
   Vercel. `SHOWCASE_ADMIN_GITHUB_ID` is the maintainer's stable numeric GitHub ID,
   not a username. Obtain it with `gh api users/<maintainer> --jq .id`.
5. Exercise submission and approval on the isolated preview database. In
   production, sign in at `/showcase/admin` and verify MCP options and the public
   catalog through reads only. Public results may take up to a minute to refresh
   from the CDN.

`SHOWCASE_ORIGIN` must match the canonical domain serving the functions. The
production site redirects `openiap.dev` to `www.openiap.dev`; use the latter for
the OAuth callback and MCP configuration. Unknown origins are rejected.
Missing configuration returns 503; the curated catalog remains readable.

Local checks:

```bash
bun run --cwd packages/docs test:showcase
bun run --cwd packages/mcp-server test
bun run --cwd packages/docs build
```

The queue tests use an isolated in-memory PostgreSQL engine and exercise actual
SQL queries. They never connect to a hosted database. Before running `vercel dev`
from the repository root, build the function bundles:

```bash
bun packages/docs/scripts/build-showcase-api.mjs
vercel dev
```

Rebuild the bundles after changing server code. Use the isolated development
database and OAuth app for these checks.

Only the configured GitHub account may review. Review POSTs require the same
origin and a custom header, and one pending submission can receive only one
decision. Public tool results expose no private listing or approval action.
Anonymous MCP traffic has persistent client and global quotas; add Vercel
Firewall controls if abuse grows. Expired IP hashes are removed after seven days.
Rejected submissions can be corrected and resubmitted. Only approved public app data is cached, for 60 seconds, to reduce database
reads. Private review and receipt responses always use `no-store`.
