import { Hono } from "hono";
import { html } from "hono/html";

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
  return c.html(renderPaywallHtml(paywall));
});

function renderPaywallHtml(paywall: {
  title: string;
  productIds: string[];
  headline: string;
  subheadline?: string;
  cta: string;
  legalCopy?: string;
  layout: "Single" | "Compare" | "Carousel";
  theme?: {
    primaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
  };
}) {
  const primary = paywall.theme?.primaryColor ?? "#0A84FF";
  const bg = paywall.theme?.backgroundColor ?? "#0B1020";
  const accent = paywall.theme?.accentColor ?? "#FFD60A";
  // Single product layout intentionally renders the first id; Compare /
  // Carousel render every productId. A maintainer-friendly upgrade path
  // is to ship richer layouts behind the same `productIds` list and keep
  // the host SDK contract (the `purchase` message) unchanged.
  const ids =
    paywall.layout === "Single"
      ? paywall.productIds.slice(0, 1)
      : paywall.productIds;
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
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 24px;
            font-family:
              -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: ${bg};
            color: #f5f5f7;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          h1 {
            font-size: 28px;
            margin: 0;
            line-height: 1.2;
          }
          .subheadline {
            font-size: 16px;
            opacity: 0.85;
            margin: 0;
          }
          .products {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .product {
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .product .pid {
            font-weight: 600;
          }
          .product .hint {
            font-size: 12px;
            opacity: 0.7;
          }
          button.cta {
            border: 0;
            border-radius: 12px;
            padding: 16px;
            font-size: 17px;
            font-weight: 600;
            background: ${primary};
            color: white;
          }
          button.cta:active {
            background: ${accent};
          }
          .legal {
            font-size: 11px;
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <h1>${paywall.headline}</h1>
        ${paywall.subheadline
          ? html`<p class="subheadline">${paywall.subheadline}</p>`
          : ""}
        <div class="products">
          ${ids.map(
            (productId) =>
              html`<div class="product" data-product-id="${productId}">
                <span class="pid">${productId}</span>
                <span class="hint">Tap continue to purchase</span>
              </div>`,
          )}
        </div>
        <button class="cta" id="cta">${paywall.cta}</button>
        ${paywall.legalCopy
          ? html`<p class="legal">${paywall.legalCopy}</p>`
          : ""}
        <script>
          (function () {
            var ids = ${html`${JSON.stringify(ids)}`};
            var cta = document.getElementById("cta");
            var selected = ids[0];
            var products = document.querySelectorAll(".product");
            products.forEach(function (el) {
              el.addEventListener("click", function () {
                selected = el.getAttribute("data-product-id");
                products.forEach(function (p) {
                  p.style.borderColor = "rgba(255,255,255,0.18)";
                });
                el.style.borderColor = "${primary}";
              });
            });
            cta.addEventListener("click", function () {
              var msg = JSON.stringify({
                openiap: "purchase",
                productId: selected,
              });
              if (
                window.ReactNativeWebView &&
                window.ReactNativeWebView.postMessage
              ) {
                window.ReactNativeWebView.postMessage(msg);
                return;
              }
              if (
                window.flutter_inappwebview &&
                window.flutter_inappwebview.callHandler
              ) {
                window.flutter_inappwebview.callHandler("openiap", {
                  openiap: "purchase",
                  productId: selected,
                });
                return;
              }
              window.parent.postMessage(msg, "*");
            });
          })();
        </script>
      </body>
    </html>`;
}

export { paywalls as paywallsRoutes };
