import { Hono } from "hono";
import { html, raw } from "hono/html";

import { api } from "@/convex";
import { client } from "../../convex";

// Hosted paywall renderer: GET /v1/paywalls/{apiKey}/{slug} returns
// either the JSON config (when `Accept: application/json`) or a
// self-contained HTML page suitable for a WebView. The HTML page
// posts a `purchase` message via `window.ReactNativeWebView.postMessage`
// (RN/Expo) or `window.parent.postMessage` (web/Flutter/Godot WebView)
// when the user taps the CTA, so the host SDK can dispatch the actual
// `requestPurchase` call against the appropriate productId.

const paywalls = new Hono();

paywalls.post("/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  let body: {
    slug?: string;
    title?: string;
    layout?: "Single" | "Compare" | "Carousel";
    productIds?: string[];
    headline?: string;
    subheadline?: string;
    cta?: string;
    legalCopy?: string;
    features?: string[];
    logoUrl?: string;
    backgroundImageUrl?: string;
    productImages?: Array<{ productId: string; imageUrl: string }>;
    customCss?: string;
    customHtml?: string;
    theme?: {
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
    };
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
      400,
    );
  }
  if (
    !body.slug ||
    !body.title ||
    !body.layout ||
    !body.productIds?.length ||
    !body.headline ||
    !body.cta
  ) {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message:
              "slug, title, layout, productIds, headline, cta are required",
          },
        ],
      },
      400,
    );
  }
  try {
    const result = await client.mutation(api.paywalls.mutation.upsertPaywall, {
      apiKey,
      slug: body.slug,
      title: body.title,
      layout: body.layout,
      productIds: body.productIds,
      headline: body.headline,
      subheadline: body.subheadline,
      cta: body.cta,
      legalCopy: body.legalCopy,
      // Forward every extended paywall field — without this, an
      // upsert from MCP / SDK was silently clearing
      // features / logoUrl / backgroundImageUrl / productImages /
      // customCss / customHtml on the existing row because the
      // mutation patches optional args directly.
      features: body.features,
      logoUrl: body.logoUrl,
      backgroundImageUrl: body.backgroundImageUrl,
      productImages: body.productImages,
      customCss: body.customCss,
      customHtml: body.customHtml,
      theme: body.theme,
    });
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        errors: [
          {
            code: "PAYWALL_UPSERT_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      },
      400,
    );
  }
});

// Live preview endpoint: takes an unsaved paywall config + apiKey,
// returns the same HTML the GET route does, without writing to the
// DB. The dashboard form posts here on every (debounced) keystroke
// so the operator sees the rendered paywall update in real time. No
// per-call auth beyond the apiKey because the GET route has the
// same exposure model — once the apiKey is leaked, the entire
// hosted-paywall surface is reachable anyway.
paywalls.post("/preview/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  let body: {
    title?: string;
    layout?: "Single" | "Compare" | "Carousel";
    productIds?: string[];
    headline?: string;
    subheadline?: string;
    cta?: string;
    legalCopy?: string;
    features?: string[];
    logoUrl?: string;
    backgroundImageUrl?: string;
    productImages?: Array<{ productId: string; imageUrl: string }>;
    customCss?: string;
    customHtml?: string;
    theme?: {
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
    };
  };
  try {
    body = await c.req.json();
  } catch {
    return c.text("Invalid JSON body", 400);
  }
  const allProducts = await client.query(api.products.query.listProducts, {
    apiKey,
  });
  const productMap = new Map(allProducts.map((p) => [p.productId, p]));
  const enrichedProducts = (body.productIds ?? []).flatMap((id) => {
    const product = productMap.get(id);
    return product
      ? [{ ...product, productId: id }]
      : [
          {
            productId: id,
            title: id,
            type: "Subscription" as const,
            description: undefined,
            priceAmountMicros: undefined,
            currency: undefined,
            offers: undefined,
            platform: "IOS" as const,
            state: "Active" as const,
            storeRef: undefined,
            subscriptionGroupId: undefined,
            subscriptionGroupName: undefined,
            updatedAt: 0,
          },
        ];
  });
  return c.html(
    renderPaywallHtml(
      {
        title: body.title ?? "Paywall preview",
        layout: body.layout ?? "Single",
        productIds: body.productIds ?? [],
        headline: body.headline ?? "Unlock the full experience",
        subheadline: body.subheadline,
        cta: body.cta ?? "Continue",
        legalCopy: body.legalCopy,
        features: body.features,
        logoUrl: body.logoUrl,
        backgroundImageUrl: body.backgroundImageUrl,
        productImages: body.productImages,
        customCss: body.customCss,
        customHtml: body.customHtml,
        theme: body.theme,
      },
      enrichedProducts,
    ),
  );
});

paywalls.delete("/:apiKey/:slug", async (c) => {
  const apiKey = c.req.param("apiKey");
  const slug = c.req.param("slug");
  const result = await client.mutation(api.paywalls.mutation.deletePaywall, {
    apiKey,
    slug,
  });
  return c.json(result);
});

paywalls.get("/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const list = await client.query(api.paywalls.query.listPaywalls, { apiKey });
  return c.json({ paywalls: list });
});

paywalls.get("/:apiKey/:slug", async (c) => {
  const apiKey = c.req.param("apiKey");
  const slug = c.req.param("slug");
  const paywall = await client.query(api.paywalls.query.getPaywall, {
    apiKey,
    slug,
  });
  if (!paywall) {
    return c.json(
      { errors: [{ code: "NOT_FOUND", message: "Paywall not found" }] },
      404,
    );
  }
  const accept = c.req.header("accept") ?? "";
  if (accept.includes("application/json")) {
    return c.json(paywall);
  }
  // Pull product info so the rendered HTML can show real price /
  // billing period / intro offer instead of just the bare productId.
  // Rendered server-side so the WebView sees a fully formed paywall
  // on first paint with no extra round-trip.
  const allProducts = await client.query(api.products.query.listProducts, {
    apiKey,
  });
  const productMap = new Map(allProducts.map((p) => [p.productId, p]));
  // Same productId can exist for both iOS and Android — listProducts
  // returns both rows. Either is fine for paywall display (price/title
  // are typically identical); pick whichever the Map landed on last.
  const enrichedProducts = paywall.productIds.flatMap((id) => {
    const product = productMap.get(id);
    return product
      ? [{ ...product, productId: id }]
      : [
          {
            productId: id,
            title: id,
            type: "Subscription" as const,
            description: undefined,
            priceAmountMicros: undefined,
            currency: undefined,
            offers: undefined,
            // Properties the renderer doesn't read but are part of listProducts
            // shape — keep TS happy without widening the call site.
            platform: "IOS" as const,
            state: "Active" as const,
            storeRef: undefined,
            subscriptionGroupId: undefined,
            subscriptionGroupName: undefined,
            updatedAt: 0,
          },
        ];
  });
  return c.html(renderPaywallHtml(paywall, enrichedProducts));
});

type PaywallProduct = {
  productId: string;
  title: string;
  type: "Subscription" | "NonConsumable" | "Consumable";
  description?: string;
  priceAmountMicros?: number;
  currency?: string;
  offers?: Array<{
    id: string;
    kind:
      | "BasePlan"
      | "FreeTrial"
      | "IntroPayUpFront"
      | "IntroPayAsYouGo"
      | "PromotionalOffer";
    duration?: string;
    numberOfPeriods?: number;
    priceAmountMicros?: number;
    currency?: string;
  }>;
};

function formatPrice(
  micros: number | undefined,
  currency: string | undefined,
): string {
  if (!micros || !currency) return "";
  return `${currency} ${(micros / 1_000_000).toFixed(2)}`;
}

function periodLabel(iso: string | undefined): string {
  switch (iso) {
    case "P3D":
      return "3 days";
    case "P1W":
      return "week";
    case "P2W":
      return "2 weeks";
    case "P1M":
      return "month";
    case "P2M":
      return "2 months";
    case "P3M":
      return "3 months";
    case "P6M":
      return "6 months";
    case "P1Y":
      return "year";
    default:
      return iso ?? "";
  }
}

// Build the headline trial / intro string (e.g. "7-day free trial",
// "USD 0.99 for first month") so the paywall card calls out the most
// compelling part of the offer instead of burying it.
function topOfferLabel(product: PaywallProduct): string | null {
  const offers = product.offers ?? [];
  const free = offers.find((o) => o.kind === "FreeTrial");
  if (free) return `${periodLabel(free.duration)} free trial`;
  const upfront = offers.find((o) => o.kind === "IntroPayUpFront");
  if (upfront && upfront.priceAmountMicros && upfront.currency) {
    return `${formatPrice(upfront.priceAmountMicros, upfront.currency)} for first ${periodLabel(upfront.duration)}`;
  }
  const asYouGo = offers.find((o) => o.kind === "IntroPayAsYouGo");
  if (asYouGo && asYouGo.priceAmountMicros && asYouGo.currency) {
    return `${formatPrice(asYouGo.priceAmountMicros, asYouGo.currency)}/${periodLabel(asYouGo.duration)} for ${asYouGo.numberOfPeriods ?? 1} cycles`;
  }
  return null;
}

// Pick the recurring base-plan period for subscriptions so we can
// render "USD 9.99 / month" rather than a bare "USD 9.99". Falls back
// to the row's own `billingPeriod` when offers[] is empty (e.g.
// product was synced from ASC where the period lives on the sub
// itself, not on a base plan row).
function basePeriod(product: PaywallProduct): string | undefined {
  return (
    product.offers?.find((o) => o.kind === "BasePlan")?.duration ?? undefined
  );
}

// Render the full-HTML-override variant: operator owns <body>, kit
// only contributes <head> chrome + a `window.openiap` helper that
// (a) exposes paywall + product metadata as JSON and (b) ships the
// same WebView bridge dispatch the default template uses for its
// CTA button. Keeps the SDK contract identical regardless of which
// template the operator picked.
function renderCustomHtmlPaywall(
  paywall: {
    title: string;
    headline: string;
    cta: string;
    customHtml?: string;
    customCss?: string;
    theme?: {
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
    };
    [k: string]: unknown;
  },
  products: PaywallProduct[],
) {
  const bridgePayload = {
    paywall: {
      title: paywall.title,
      headline: paywall.headline,
      cta: paywall.cta,
      theme: paywall.theme,
    },
    products: products.map((p) => ({
      productId: p.productId,
      title: p.title,
      description: p.description,
      priceAmountMicros: p.priceAmountMicros,
      currency: p.currency,
      offers: p.offers,
    })),
  };
  return html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <title>${paywall.title}</title>
        ${paywall.customCss
          ? html`<style>
              ${raw(paywall.customCss)}
            </style>`
          : ""}
        <script>
          (function () {
            var data = ${raw(JSON.stringify(bridgePayload))};
            window.openiap = {
              paywall: data.paywall,
              products: data.products,
              purchase: function (productId) {
                var msg = JSON.stringify({
                  openiap: "purchase",
                  productId: productId,
                });
                if (
                  window.ReactNativeWebView &&
                  window.ReactNativeWebView.postMessage
                ) {
                  window.ReactNativeWebView.postMessage(msg);
                  return true;
                }
                if (
                  window.flutter_inappwebview &&
                  window.flutter_inappwebview.callHandler
                ) {
                  window.flutter_inappwebview.callHandler("openiap", {
                    openiap: "purchase",
                    productId: productId,
                  });
                  return true;
                }
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage(msg, "*");
                  return true;
                }
                console.warn(
                  "[openiap] no host bridge available — running standalone preview. Would purchase:",
                  productId,
                );
                return false;
              },
            };
          })();
        </script>
      </head>
      <body>
        ${raw(paywall.customHtml ?? "")}
      </body>
    </html>`;
}

function renderPaywallHtml(
  paywall: {
    title: string;
    productIds: string[];
    headline: string;
    subheadline?: string;
    cta: string;
    legalCopy?: string;
    features?: string[];
    logoUrl?: string;
    backgroundImageUrl?: string;
    productImages?: Array<{ productId: string; imageUrl: string }>;
    customCss?: string;
    customHtml?: string;
    layout: "Single" | "Compare" | "Carousel";
    theme?: {
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
    };
  },
  products: PaywallProduct[],
) {
  // Operator-authored full-page mode. Skip the kit's default body
  // markup; render only a minimal shell that exposes the bridge
  // helper + product/paywall data on `window.openiap`. The operator's
  // HTML can use any framework via UMD (React, Vue, vanilla) and only
  // needs to call `openiap.purchase(productId)` to trigger the SDK.
  if (paywall.customHtml && paywall.customHtml.trim()) {
    return renderCustomHtmlPaywall(paywall, products);
  }
  const imageMap = new Map(
    (paywall.productImages ?? []).map((p) => [p.productId, p.imageUrl]),
  );
  // Defense-in-depth sanitization for operator-supplied CSS:
  //   1) Strip HTML / script tags so the value can't break out of
  //      the <style> block.
  //   2) Strip CSS-specific script vectors that some browsers used
  //      to evaluate as JS — `expression()` (legacy IE/Edge),
  //      `-moz-binding` (Firefox XBL bindings), `behavior:` (IE),
  //      and `url(...)` payloads pointing at `javascript:` /
  //      `vbscript:` / `data:text/...` schemes.
  //   3) Strip @import — operators can host fonts via direct CSS
  //      properties without pulling third-party stylesheets in.
  // The `customHtml` feature is the explicit hatch for full
  // interactivity (with `window.openiap` injection + a documented
  // contract); customCss is meant for styling overrides only.
  const safeCss = (paywall.customCss ?? "")
    .replace(
      /<\/?\s*(?:style|script|html|body|head|iframe|object|embed|link|meta|svg)[^>]*>/gi,
      "",
    )
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/-moz-binding\s*:[^;]*;?/gi, "")
    .replace(/behavior\s*:[^;]*;?/gi, "")
    .replace(
      /url\s*\(\s*(['"]?)\s*(?:javascript|vbscript|data:text\/(?:html|javascript))[^)]*\)/gi,
      "url()",
    )
    .replace(/@import\b[^;]*;?/gi, "");
  // Defaults match the OpenIAP brand chrome (warm tan primary,
  // terracotta accent, zinc dark background) so an unconfigured
  // paywall feels like part of the kit rather than the iOS-blue
  // generic look. Operators override per-paywall via the theme form.
  const primary = paywall.theme?.primaryColor ?? "#a47465";
  const bg = paywall.theme?.backgroundColor ?? "#18181b";
  const accent = paywall.theme?.accentColor ?? "#dc6843";
  // Single → first product (form already enforces this, but guard
  // against pre-existing rows that picked Single + multiple ids).
  // Compare/Carousel → all products. Carousel scrolls horizontally;
  // Compare stacks (or grids on wider screens).
  const visible = paywall.layout === "Single" ? products.slice(0, 1) : products;
  const productsJson = JSON.stringify(
    visible.map((p) => ({ productId: p.productId, title: p.title })),
  );
  return html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <title>${paywall.title}</title>
        <style>
          :root {
            color-scheme: dark;
            --primary: ${primary};
            --accent: ${accent};
            --bg: ${bg};
          }
          * {
            box-sizing: border-box;
          }
          html,
          body {
            margin: 0;
            padding: 0;
          }
          body {
            font-family:
              -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg);
            background-image:
              ${paywall.backgroundImageUrl
                  ? html`linear-gradient( 180deg, color-mix(in oklab, var(--bg)
                    50%, transparent) 0%, color-mix(in oklab, var(--bg) 90%,
                    transparent) 60%, var(--bg) 100% ),
                    url("${paywall.backgroundImageUrl}"),`
                  : ""}
                radial-gradient(
                  circle at 20% -10%,
                  color-mix(in oklab, var(--primary) 40%, transparent),
                  transparent 50%
                ),
              radial-gradient(
                circle at 90% 10%,
                color-mix(in oklab, var(--accent) 25%, transparent),
                transparent 55%
              );
            background-size: cover;
            background-position: center top;
            background-repeat: no-repeat;
            color: #f5f5f7;
            min-height: 100vh;
            display: grid;
            /* 3 rows match the 3 children below: hero / .middle / footer.
               .middle is the 1fr row so it absorbs spare height and
               pushes footer (the CTA) to the bottom. .middle uses
               justify-content flex-start so the product cards anchor
               to the top of that band, leaving empty space between
               cards and CTA — not above CTA. */
            grid-template-rows: auto 1fr auto;
            padding: 28px 20px 20px;
            gap: 20px;
          }
          .logo {
            width: 56px;
            height: 56px;
            border-radius: 14px;
            object-fit: cover;
            margin-bottom: 14px;
            box-shadow: 0 6px 20px -10px rgba(0, 0, 0, 0.6);
          }
          .features {
            list-style: none;
            margin: 16px 0 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .features li {
            position: relative;
            padding-left: 22px;
            font-size: 14px;
            line-height: 1.45;
            opacity: 0.92;
          }
          .features li::before {
            content: "";
            position: absolute;
            left: 0;
            top: 5px;
            width: 14px;
            height: 14px;
            border-radius: 999px;
            background: color-mix(in oklab, var(--primary) 30%, transparent);
            mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path fill='black' d='M6.5 11.2 3.6 8.3l1.1-1.1 1.8 1.8 4.8-4.8 1.1 1.1z'/></svg>")
              center / 12px no-repeat;
            -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path fill='black' d='M6.5 11.2 3.6 8.3l1.1-1.1 1.8 1.8 4.8-4.8 1.1 1.1z'/></svg>")
              center / 12px no-repeat;
            background-color: var(--primary);
          }
          .middle {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 16px;
            min-height: 0;
          }
          .hero h1 {
            font-size: 30px;
            line-height: 1.15;
            margin: 0 0 8px;
            letter-spacing: -0.02em;
          }
          .hero p {
            margin: 0;
            font-size: 15px;
            opacity: 0.78;
          }
          .products.layout-Carousel {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            margin: 0 -20px;
            padding: 4px 20px;
          }
          .products.layout-Carousel .product {
            min-width: 78%;
            scroll-snap-align: center;
          }
          .products.layout-Compare,
          .products.layout-Single {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
          }
          @media (min-width: 520px) {
            .products.layout-Compare {
              grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            }
          }
          .product {
            position: relative;
            border: 1.5px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            padding: 0;
            background: rgba(255, 255, 255, 0.04);
            display: flex;
            flex-direction: column;
            cursor: pointer;
            overflow: hidden;
            transition:
              border-color 0.15s ease,
              background 0.15s ease,
              transform 0.05s ease;
          }
          .product .body {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .product .image {
            display: block;
            width: 100%;
            aspect-ratio: 16 / 9;
            object-fit: cover;
            background: linear-gradient(
              135deg,
              color-mix(in oklab, var(--primary) 35%, var(--bg)),
              color-mix(in oklab, var(--accent) 30%, var(--bg))
            );
          }
          .product[aria-checked="true"] {
            border-color: var(--primary);
            background: color-mix(in oklab, var(--primary) 10%, transparent);
            box-shadow: 0 0 0 4px
              color-mix(in oklab, var(--primary) 22%, transparent);
          }
          .product:active {
            transform: scale(0.99);
          }
          .product .title {
            font-size: 16px;
            font-weight: 600;
            line-height: 1.2;
          }
          .product .desc {
            font-size: 12px;
            opacity: 0.7;
            line-height: 1.4;
          }
          .product .price {
            margin-top: 4px;
            display: flex;
            align-items: baseline;
            gap: 6px;
          }
          .product .price .amount {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.01em;
          }
          .product .price .per {
            font-size: 13px;
            opacity: 0.7;
          }
          .badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 4px;
          }
          .badge {
            font-size: 11px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 999px;
            background: color-mix(in oklab, var(--accent) 18%, transparent);
            color: var(--accent);
          }
          .badge.free {
            background: rgba(52, 199, 89, 0.15);
            color: #34c759;
          }
          .ribbon {
            position: absolute;
            top: -10px;
            right: 12px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            padding: 4px 8px;
            border-radius: 999px;
            background: var(--primary);
            color: white;
          }
          .footer {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          button.cta {
            border: 0;
            border-radius: 14px;
            padding: 16px;
            font-size: 17px;
            font-weight: 700;
            color: white;
            background: linear-gradient(
              135deg,
              var(--primary),
              color-mix(in oklab, var(--primary) 70%, var(--accent))
            );
            box-shadow: 0 6px 20px -8px
              color-mix(in oklab, var(--primary) 80%, black);
            cursor: pointer;
          }
          button.cta:active {
            transform: scale(0.99);
          }
          .legal {
            font-size: 11px;
            opacity: 0.6;
            text-align: center;
            line-height: 1.5;
          }
          .preview-toast {
            position: fixed;
            left: 50%;
            bottom: 24px;
            transform: translate(-50%, 12px);
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #f5f5f7;
            padding: 10px 14px;
            border-radius: 10px;
            font-size: 13px;
            opacity: 0;
            pointer-events: none;
            transition:
              opacity 0.2s ease,
              transform 0.2s ease;
            z-index: 99;
          }
          .preview-toast.show {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        </style>
        ${safeCss
          ? html`<style data-source="custom">
              ${raw(safeCss)}
            </style>`
          : ""}
      </head>
      <body>
        <header class="hero">
          ${paywall.logoUrl
            ? html`<img class="logo" src="${paywall.logoUrl}" alt="" />`
            : ""}
          <h1>${paywall.headline}</h1>
          ${paywall.subheadline ? html`<p>${paywall.subheadline}</p>` : ""}
          ${paywall.features && paywall.features.length > 0
            ? html`<ul class="features">
                ${paywall.features.map((feature) => html`<li>${feature}</li>`)}
              </ul>`
            : ""}
        </header>

        <div class="middle">
          <main
            class="products layout-${paywall.layout}"
            role="radiogroup"
            aria-label="Choose a plan"
          >
            ${visible.map((product, i) => {
              const period = basePeriod(product);
              const offerLabel = topOfferLabel(product);
              const priceText = formatPrice(
                product.priceAmountMicros,
                product.currency,
              );
              const isLast = i === visible.length - 1;
              const showBest = visible.length > 1 && isLast;
              const imageUrl = imageMap.get(product.productId);
              return html`<div
                class="product"
                role="radio"
                tabindex="0"
                data-product-id="${product.productId}"
                aria-checked="${i === 0 ? "true" : "false"}"
              >
                ${showBest ? html`<div class="ribbon">Best value</div>` : ""}
                ${imageUrl
                  ? html`<img class="image" src="${imageUrl}" alt="" />`
                  : html`<div class="image" aria-hidden="true"></div>`}
                <div class="body">
                  <span class="title">${product.title}</span>
                  ${product.description
                    ? html`<span class="desc">${product.description}</span>`
                    : ""}
                  ${priceText
                    ? html`<div class="price">
                        <span class="amount">${priceText}</span>
                        ${period
                          ? html`<span class="per"
                              >/ ${periodLabel(period)}</span
                            >`
                          : ""}
                      </div>`
                    : html`<div class="price">
                        <span class="per">Price set in store</span>
                      </div>`}
                  ${offerLabel
                    ? html`<div class="badges">
                        <span
                          class="badge ${offerLabel.includes("free")
                            ? "free"
                            : ""}"
                          >${offerLabel}</span
                        >
                      </div>`
                    : ""}
                </div>
              </div>`;
            })}
          </main>
        </div>

        <footer class="footer">
          <button class="cta" id="cta">${paywall.cta}</button>
          ${paywall.legalCopy
            ? html`<p class="legal">${paywall.legalCopy}</p>`
            : ""}
        </footer>

        <div class="preview-toast" id="preview-toast" role="status"></div>

        <script>
          (function () {
            var products = ${html`${productsJson}`};
            var cta = document.getElementById("cta");
            var toast = document.getElementById("preview-toast");
            var cards = Array.prototype.slice.call(
              document.querySelectorAll(".product"),
            );
            var selected =
              (cards[0] && cards[0].getAttribute("data-product-id")) || null;

            cards.forEach(function (el) {
              function pick() {
                selected = el.getAttribute("data-product-id");
                cards.forEach(function (c) {
                  c.setAttribute("aria-checked", c === el ? "true" : "false");
                });
              }
              el.addEventListener("click", pick);
              el.addEventListener("keydown", function (e) {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  pick();
                }
              });
            });

            function showToast(text) {
              toast.textContent = text;
              toast.classList.add("show");
              clearTimeout(toast._t);
              toast._t = setTimeout(function () {
                toast.classList.remove("show");
              }, 2400);
            }

            cta.addEventListener("click", function () {
              if (!selected) return;
              var payload = { openiap: "purchase", productId: selected };
              var msg = JSON.stringify(payload);
              var posted = false;
              try {
                if (
                  window.ReactNativeWebView &&
                  window.ReactNativeWebView.postMessage
                ) {
                  window.ReactNativeWebView.postMessage(msg);
                  posted = true;
                } else if (
                  window.flutter_inappwebview &&
                  window.flutter_inappwebview.callHandler
                ) {
                  window.flutter_inappwebview.callHandler("openiap", payload);
                  posted = true;
                } else if (window.parent && window.parent !== window) {
                  window.parent.postMessage(msg, "*");
                  posted = true;
                }
              } catch (err) {
                /* posting can throw in sandboxed iframes; fall through */
              }
              if (posted) {
                showToast("Sent purchase: " + selected);
              } else {
                // Standalone browser preview — there is no host SDK
                // to dispatch the actual purchase. Show the operator
                // exactly what would have been sent so they know the
                // bridge wiring works on their side once embedded.
                showToast(
                  "Preview only · no host bridge. Would purchase: " + selected,
                );
              }
            });
          })();
        </script>
      </body>
    </html>`;
}

export { paywalls as paywallsRoutes };
