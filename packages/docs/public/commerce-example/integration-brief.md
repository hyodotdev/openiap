# Build your part of the OpenIAP ecosystem

Use this brief with an AI in your product repository. Pick the role you sell;
connect the other roles to existing services. An integrated platform can own
several roles. These are product roles, not additional protocol profiles.

| Your product                | You deliver                                                                            | Connect to                                                            |
| --------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Paywalls and experiments    | Presentation, product selection, purchase/result callbacks                             | The app's existing OpenIAP purchase flow; optionally lifecycle events |
| Commerce backend            | Store verification, ownership, access, lifecycle delivery for the profiles you declare | Authenticated app backend, store adapters, downstream receivers       |
| Analytics, attribution, CRM | Durable event ingestion and your own reporting or automation                           | A configured commerce emitter                                         |
| Integrated platform         | The roles above that your product supplies                                             | One app integration with an explicit owner for each state transition  |

## Start with working code

[Download the complete example](https://github.com/hyodotdev/openiap-commerce-protocol-example/archive/refs/heads/main.zip)
and extract it into an empty directory. It contains `client-bridge.mjs`,
`consumer.mjs`, `webhooks.mjs`, the backend, and their executable checks.
The [example repository](https://github.com/hyodotdev/openiap-commerce-protocol-example)
contains the same project and its build history.

Use your favorite package manager: `npm install`, `pnpm install`, `yarn install`,
or `bun install`. This example's runtime is Bun. The contract is
`openiap-commerce-protocol` package 0.1.0, protocol 1.0; it does not require Bun.

- `npm run demo:bridge`: maps Apple/Google OpenIAP purchase fields into the
  installed verification schema; rejects missing or unsupported evidence.
- `npm run demo:consumer`: sends signed lifecycle events to a SQLite inbox over
  HTTP, repeats deliveries, rejects tampering, and reopens persisted storage.
- `npm test` and `npm start`: verify and inspect the fixture commerce backend.

The bridge and consumer can be used separately. These checks prove local
boundaries with fictional inputs, not a mobile checkout or a store adapter.
The [receiver setup guide](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/main/docs/receiver.md)
gives the endpoint, configuration, and limits.

## Task for the AI

Inspect this repository's purchase flow and choose the role from the table.
Install `openiap-commerce-protocol` with this repository's package manager.
Read its `SPEC.md`, generated bindings and schemas, and signature/lifecycle
vectors for the role being implemented. Package 0.1.0 does not ship `DESIGN.md`;
the [role guide](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/main/INTEGRATE.md)
and [whitepaper](https://openiap.dev/commerce-protocol-rationale.pdf) give context.

Implement the selected role using the product's existing framework and design
system. Deliver usable code and a short connection example, not a list of work
for the app team. Follow these boundaries:

1. **Paywall:** accept the app's store-fetched products, return a selected product
   ID to its existing purchase callback, and display pending, canceled, failed,
   and fulfilled results. Let the host select valid store offers. Never infer
   purchase success or access from a click. Wire result callbacks to the host's
   existing purchase lifecycle. Commerce Protocol defines no universal paywall
   UI, targeting, or product catalog API; document this host adapter explicitly.
2. **App connection:** the app uses its OpenIAP library to fetch products and
   request a store purchase. Its purchase callback sends evidence to its
   authenticated backend. Use `client-bridge.mjs` there to map Apple/Google
   purchase fields into a verification input; this does not authenticate the
   evidence. Keep server keys and user selection on that backend. Verify, bind
   under the ownership policy, read current access, fulfill durably, then finish
   the transaction through the client library. Keep store acknowledgement and
   consumption responsibilities explicit for the chosen store and product type.
3. **Commerce:** provide core discovery and implement every operation/obligation
   of each advertised profile and binding. Account lifecycle includes erasure.
   Keep one authoritative ownership and entitlement service for each app/project,
   even when it delegates verification. Use [backend build brief](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/main/BUILD.md) for the backend
   implementation sequence. The fixture backend advertises no complete profiles.
4. **Data:** reuse or port `webhooks.mjs` and `consumer.mjs`. Authenticate exact
   body bytes before parsing, validate, durably deduplicate in the configured
   emitter/project scope, then acknowledge. Keep optional unknown values unknown.
   Receiving events does not qualify a product for the `events` emitter profile.
   Lifecycle events alone are not a revenue ledger: charge, refund, trial, tax,
   currency conversion, attribution, and reporting policies need their own data
   and product-specific rules. Do not count every event as a new purchase.

The current client `verifyPurchaseWithProvider` helper supports IAPKit's own
API. A different provider name or base URL does not turn it into this protocol.
Other providers connect through the app backend's REST or GraphQL calls. The
Apple/Google helper does not support Amazon or Horizon, whose protocol evidence
requires store-specific user identifiers distinct from the app's user ID.

## Deliver and prove the connection

Ship the adapter/endpoint, setup command, supported stores and profiles,
credential configuration, and one app-facing integration example. Agree on
opaque user IDs, issuer/project scope, and versions with connected services.
Protocol compatibility does not perform onboarding, provisioning, ownership
migration, or provider discovery for the app automatically.

For each owned role, run a successful flow and its failure cases. Inspect the
rendered result and actual response, fix the failing behavior, and repeat the
same check. Save the source revision, commands, responses, screenshots, and
limits. Include cancellation, pending purchase, duplicate delivery, expiry,
and account isolation where applicable. An integrated platform must prove each
role it claims; a paywall specialist need not implement a purchase verifier.

Label fixture checks separately from real device/store sandbox checks and full
profile conformance. Never claim the latter from a schema match alone.
