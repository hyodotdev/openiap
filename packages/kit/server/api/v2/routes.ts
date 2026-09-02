import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";

import { subscriptionsRoutesV2 } from "./subscriptions";

const app = new Hono();

app.get("", (c) =>
  c.json({
    name: "IAPKit API",
    version: "2",
    accountReads: "secret-key-only",
  }),
);

app.route("/subscriptions", subscriptionsRoutesV2);

app.get(
  "/openapi",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "IAPKit Server API",
        version: "2.0.0",
        description:
          "Server-to-server account reads and privacy operations. Secret admin keys must never be shipped in an app.",
      },
      servers: [
        { url: "https://kit.openiap.dev/v2", description: "Production" },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: "http",
            scheme: "bearer",
            description: "IAPKit secret admin key (openiap-kit_sk_...).",
          },
        },
      },
      security: [{ apiKey: [] }],
    },
  }),
);

export { app as apiRoutesV2 };
