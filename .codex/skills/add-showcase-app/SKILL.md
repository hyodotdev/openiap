---
name: add-showcase-app
description: Add one or more apps to the OpenIAP "Who uses OpenIAP?" showcase — record OpenIAP library and IAPKit usage, normalize icons, refresh ordering metrics, and verify the docs build. Use when someone submits apps through discussion #350, a showcase pull request, X, or email, or when the user asks to add or update apps on openiap.dev/showcase.
---

# Add Showcase App

Turn app submissions into rendered cards on the home page and `/showcase`.

Everything lives in `packages/docs`:

| Path                                   | Role                                      |
| -------------------------------------- | ----------------------------------------- |
| `showcase-apps.json`                   | The list (SSOT for what renders)          |
| `public/showcase/<slug>.webp`          | Masked 256×256 app icon                   |
| `scripts/refresh-showcase-metrics.mjs` | Fills `ratings` / `installs` for ordering |
| `src/lib/showcase.ts`                  | Sorting + featured slice                  |
| `src/components/ShowcaseCards.tsx`     | Card markup                               |
| `SHOWCASE.md`                          | Public submission guide                   |

## 1. Collect the submission

Required from the submitter:

- **App name** and a one-line description (keep the tagline under ~70 chars so
  cards stay even)
- **App icon** — square, 512×512 PNG (a store icon URL works too)
- **Store links** — App Store and/or Google Play; a website link is optional
- **Library** — one of `expo-iap`, `react-native-iap`, `flutter_inapp_purchase`,
  `kmp-iap`, `maui-iap`, `godot-iap`
- **IAPKit usage** — whether the app uses IAPKit for receipt validation

When one submitter sends multiple apps, include every app in one pull request.
Do not split the apps into separate pull requests.

Only list an app when the submitter asked for it. A comment on
[discussion #350](https://github.com/hyodotdev/openiap/discussions/350), a
showcase PR, an email, or a public reply to the announcement all count as
permission; a mention of the library somewhere else does not.

If the icon is missing, pull it from the stores rather than asking again:

```bash
# App Store artwork + metadata
curl -s "https://itunes.apple.com/lookup?id=<TRACK_ID>" | python3 -m json.tool | grep artworkUrl512

# Google Play icon
curl -s "https://play.google.com/store/apps/details?id=<PACKAGE>" \
  | grep -o 'https://play-lh.googleusercontent.com/[A-Za-z0-9_=-]\{20,\}' | head -1
```

## 2. Add the icon

Icons are stored pre-masked so store artwork with baked-in rounded corners and
plain square artwork render identically. Append `=s512` to a Play icon URL for
the full-size original.

```bash
cd packages/docs && python3 - <<'PY'
import urllib.request, io
from PIL import Image, ImageDraw

SLUG = "your-app"          # kebab-case, matches the logo path in the JSON
URL  = "https://..."       # 512px source icon

SIZE, SS, RATIO = 256, 4, 0.2237   # 0.2237 ≈ the Apple icon corner radius
mask = Image.new("L", (SIZE*SS, SIZE*SS), 0)
ImageDraw.Draw(mask).rounded_rectangle(
    (0, 0, SIZE*SS-1, SIZE*SS-1), radius=int(SIZE*SS*RATIO), fill=255
)
mask = mask.resize((SIZE, SIZE), Image.LANCZOS)

req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
raw = urllib.request.urlopen(req, timeout=30).read()
img = Image.open(io.BytesIO(raw)).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
out.paste(img, (0, 0), mask)
out.save(f"public/showcase/{SLUG}.webp", "WEBP", quality=90, method=6)
print("saved", SLUG)
PY
```

`sips` cannot write WebP on macOS — use the Pillow snippet above.

## 3. Append the entry

Add to the end of the `apps` array in `packages/docs/showcase-apps.json`.
Ordering is computed at render time, so position in the file does not matter.

```json
{
  "name": "Your App",
  "tagline": "One line about what the app does",
  "logo": "/showcase/your-app.webp",
  "library": "expo-iap",
  "iapkit": true,
  "ios": "https://apps.apple.com/us/app/your-app/id0000000000",
  "android": "https://play.google.com/store/apps/details?id=com.example.yourapp"
}
```

`ios`, `android`, and `web` are each optional, but an entry with none of them is
dropped at render time. Set `iapkit` to `true` only when the submitter confirms
IAPKit usage; omit it otherwise. Leave `ratings` and `installs` out — step 4
writes them.

## 4. Refresh the ordering metrics

```bash
cd packages/docs && bun run showcase:metrics
```

The script fills every entry:

- `ratings` — App Store `userRatingCount` **summed across every storefront**
  plus the Google Play review count. **Primary sort key, descending.**
- `installs` — the Play install floor (`"1K+"` → `1000`). **Fallback** when
  review counts tie, which is common for new apps.

Apple reports ratings per storefront and publishes no global total, so a US-only
lookup reads zero for an app reviewed mainly in Korea or Japan. The sweep covers
~170 storefronts and takes about a minute; Apple throttles bursts, so the script
retries failures in later rounds and **keeps the previous numbers rather than
writing a partial sweep**. If output says `kept existing ratings`, rerun it.

Neither store publishes download totals: Apple exposes no install data in any
public API, and Play reports only a coarse bucket. Do not add a `downloads`
field or invent numbers — review count is the one verifiable signal both stores
share. If a submitter reports their own install figures, keep them out of the
JSON.

The scraper depends on Play's HTML, whose class names are obfuscated and change.
If `ratings` comes back unexpectedly `0` for an app that clearly has reviews,
re-check the regexes in `scripts/refresh-showcase-metrics.mjs` rather than
hand-editing the JSON.

## 5. Verify

```bash
cd packages/docs && bun run typecheck && bun run build
```

Then confirm the card renders and the icon actually loads — a broken `logo` path
fails silently as a missing image, not a build error. The home page shows the
top `FEATURED_SHOWCASE_LIMIT` (5) apps plus the submit card and a "See all"
link; `/showcase` lists everything.

## 6. Close the loop

- Reply to the submission thread (discussion #350, PR, or email) confirming
  the app is listed, and note that updates or removal are available anytime.
- Public GitHub replies must be in English — see
  `knowledge/internal/06-git-deployment.md`.
- Commit with a lowercase subject after the tag, e.g.
  `docs: add recallai to showcase`. Do not commit, push, or open a PR unless the
  user already authorized it.
