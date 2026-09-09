import { COMMERCE_PROTOCOL_LINKS } from './config';

export type CommerceStore = 'apple' | 'google' | 'amazon' | 'horizon';

export const COMMERCE_STORE_LABELS: Record<CommerceStore, string> = {
  apple: 'Apple',
  google: 'Google Play',
  amazon: 'Amazon',
  horizon: 'Meta Horizon',
};

export function isCommerceStore(value: string | null): value is CommerceStore {
  return value !== null && value in COMMERCE_STORE_LABELS;
}

export const COMMERCE_IMPLEMENTATIONS = {
  example: {
    name: 'openiap-commerce-protocol-example',
    role: 'Run the flow locally',
    url: COMMERCE_PROTOCOL_LINKS.example,
    source: '/commerce-source/example',
  },
  kit: {
    name: 'IAPKit',
    role: 'See the service implementation',
    url: 'https://github.com/hyodotdev/openiap/tree/main/packages/kit',
    source: '/commerce-source/kit',
  },
} as const;

interface ImplementationReference {
  description: string;
  file: string;
  symbol: string;
  line?: number;
  checkFile: string;
  check: string;
}

interface ImplementationComparison {
  title: string;
  example: ImplementationReference;
  kit: ImplementationReference;
}

export const COMMERCE_IMPLEMENTATION_TOPICS = {
  buy: {
    title: 'Where the store result goes',
    example: {
      description:
        'The purchase mapper converts Apple, Google, Amazon, and Horizon client results into verification input on your backend. Its demo checks the mapping without making a store purchase.',
      file: 'client-bridge.mjs',
      symbol: 'toVerifyPurchaseInput',
      line: 5,
      checkFile: 'client-bridge.mjs',
      check:
        'runBridgeDemo checks all four store mappings and requires a separate store identity for Amazon and Horizon. Run npm run demo:bridge.',
    },
    kit: {
      description:
        'IAPKit receives that store evidence through verifyPurchase. The paywall, store purchase screen, and app login stay with your app; IAPKit does not replace them.',
      file: 'server/api/commerce/handlers.ts',
      symbol: 'verifyPurchase',
      line: 221,
      checkFile: 'server/api/commerce/routes.test.ts',
      check:
        'Route tests cover evidence parsing and errors with mocked store calls; they do not perform a mobile purchase.',
    },
  },
  verify: {
    title: 'Same question: is the evidence valid?',
    example: {
      description:
        'verifyFixture recognizes one fictional purchase. A valid result saves it in SQLite with no user attached. You can watch Alice’s access stay locked after verification.',
      file: 'provider.mjs',
      symbol: 'verifyPurchase',
      line: 202,
      checkFile: 'scenario.mjs',
      check:
        'The Verify step checks isValid and confirms that Alice still has no access. Run npm test.',
    },
    kit: {
      description:
        'The handler sends evidence to the Apple, Google, Meta, or Amazon verifier and returns the same isValid answer. Store-specific work stays behind this call.',
      file: 'server/api/commerce/handlers.ts',
      symbol: 'verifyPurchaseVerdict',
      line: 169,
      checkFile: 'server/api/commerce/routes.test.ts',
      check:
        'The route suite checks unreachable verification and retry behavior using mocked store I/O.',
    },
  },
  storeBind: {
    title: 'Connect the store account to your app account',
    example: {
      description:
        'The app backend checks that the Amazon or Horizon store user is linked to this signed-in session. SQLite then records one owner for the verified evidence.',
      file: 'composition/app-backend.mjs',
      symbol: 'resolveStoreUser',
      line: 60,
      checkFile: 'client-bridge.mjs',
      check:
        'Run npm run demo:bridge to inspect all four evidence shapes. The store identity comes from the host’s authenticated account link.',
    },
    kit: {
      description:
        'IAPKit binds the verified purchase row. Amazon uses the store user, receipt, and environment; Horizon uses the store user and SKU. Only an entitled purchase binds, at most 20 per app account, and a binding never moves; after erasure another app account may claim the same evidence as a first binding.',
      file: 'convex/purchases/mutation.ts',
      symbol: 'bindVerifiedPurchaseAsServer',
      line: 20,
      checkFile: 'convex/purchases/ownership.test.ts',
      check:
        'Checks role enforcement, conflicting accounts, the per-account cap, consumables, project isolation, and erasure during binding.',
    },
  },
  storeAccess: {
    title: 'Ask the store again before granting access',
    example: {
      description:
        'The comparison fixture changes its verification answer from accepted to rejected or unavailable. The same app keeps calling entitlements; it does not parse a store response.',
      file: 'provider.mjs',
      symbol: 'entitlements',
      line: 112,
      checkFile: 'verify-stores.mjs',
      check:
        'Run npm test: verifyStores checks all four fixture shapes, including Amazon/Horizon rejection and outage. The replacement runner compares them with IAPKit.',
    },
    kit: {
      description:
        'IAPKit rechecks every linked Amazon or Horizon purchase from its own rate budget, then rereads ownership after those calls. A rejected product is removed from productIds; an outage fails the read; an exhausted budget answers RATE_LIMITED. These products have no invented subscription records.',
      file: 'convex/purchases/action.ts',
      symbol: 'readBoundPurchaseEntitlements',
      line: 18,
      checkFile: 'convex/purchases/ownership.test.ts',
      check:
        'Checks revoked ownership, upstream failures, bounded reads, and ownership changes during verification.',
    },
  },
  bind: {
    title: 'Same owner after a retry',
    example: {
      description:
        'One SQLite transaction assigns the unowned purchase to Alice and queues the access event. Repeating Alice’s request succeeds; Bob’s conflicting claim returns bound: false.',
      file: 'provider.mjs',
      symbol: 'bindPurchase',
      line: 228,
      checkFile: 'scenario.mjs',
      check:
        'The Bind step repeats Alice’s request and rejects Bob’s claim. Run npm test.',
    },
    kit: {
      description:
        'The protocol handler calls bindUserAsServer. Convex checks the project’s server credential and records ownership without moving a purchase already owned by another user.',
      file: 'convex/subscriptions/mutation.ts',
      symbol: 'bindUserAsServer',
      line: 52,
      checkFile: 'convex/subscriptions/internal.test.ts',
      check:
        'Binding tests cover repeated and conflicting claims against the subscription mutation handlers.',
    },
  },
  access: {
    title: 'Same access rule, different storage',
    example: {
      description:
        'isEntitled reads the subscription state and expiry. SQLite holds the records; entitlements returns only products Alice can use now. Turning renewal off does not end paid access.',
      file: 'provider.mjs',
      symbol: 'isEntitled',
      line: 25,
      checkFile: 'verify.mjs',
      check:
        'The state checks test before, at, and after expiry with a controlled clock. Run npm test.',
    },
    kit: {
      description:
        'isEntitledAt applies the same rule to Convex records. entitlementsV2 reads the current time and returns allowed products without exposing store purchase tokens.',
      file: 'convex/subscriptions/query.ts',
      symbol: 'isEntitledAt',
      line: 71,
      checkFile: 'convex/subscriptions/query.test.ts',
      check:
        'Account-read tests check token omission, server authorization, and time advancing past expiry.',
    },
  },
  status: {
    title: 'Explain why access continues',
    example: {
      description:
        'subscriptionStatus returns an active subscription or a record explaining the inactive state. In the Cancel step, willRenew becomes false while active remains true.',
      file: 'provider.mjs',
      symbol: 'subscriptionStatus',
      line: 270,
      checkFile: 'scenario.mjs',
      check:
        'Cancel and Expire compare the status response with current entitlements. Run npm test.',
    },
    kit: {
      description:
        'subscriptionStatusV2 selects a subscription and applies the same access deadline. The protocol handler turns that record into the shared response shape.',
      file: 'convex/subscriptions/query.ts',
      symbol: 'subscriptionStatusV2',
      line: 317,
      checkFile: 'server/api/commerce/conformance.test.ts',
      check:
        'The contract vectors compare status and access over REST and GraphQL with an in-memory database substitute.',
    },
  },
  events: {
    title: 'Retries keep one inbox entry',
    example: {
      description:
        'A local worker signs and retries events. The included receiver verifies the signature and saves each event once in a separate SQLite inbox. Use it to understand both ends of delivery.',
      file: 'webhooks.mjs',
      symbol: 'deliver / createReceiver',
      line: 36,
      checkFile: 'verify.mjs',
      check:
        'Checks cover signatures, retries, tampering, and reopening the inbox. Run npm test or npm run demo:consumer.',
    },
    kit: {
      description:
        'The delivery worker sends signed events to registered backend HTTPS endpoints and records attempts. Your receiver owns duplicate handling; the example shows how to build that side.',
      file: 'convex/commerce/delivery.ts',
      symbol: 'deliverPendingEventsHandler',
      line: 173,
      checkFile: 'convex/commerce/delivery.test.ts',
      check:
        'Worker tests check signed requests, transport failures, and destination validation with test I/O.',
    },
  },
  erase: {
    title: 'Delete the account in both implementations',
    example: {
      description:
        'Step 7 removes identity from purchases and event records atomically. The app erases delivered copies and remembers the deletion so late signed events cannot restore the user.',
      file: 'provider.mjs',
      symbol: 'eraseUser',
      line: 257,
      checkFile: 'verify-erasure.mjs',
      check:
        'Run bun verify-erasure.mjs. It checks active-account erasure, in-flight delivery, repeated jobs, late events, and restart.',
    },
    kit: {
      description:
        'eraseUser starts a project-scoped job. The worker removes identity from purchases, subscriptions, and events in batches, waiting for claimed deliveries before cleaning those events.',
      file: 'convex/subscriptions/internal.ts',
      symbol: 'drainSubscriptionUserErasurePage',
      line: 1491,
      checkFile: 'convex/subscriptions/mutation.test.ts',
      check:
        'Erasure request tests cover server authorization and repeated requests, including already completed jobs.',
    },
  },
  auth: {
    title: 'Two credentials, with the same boundary',
    example: {
      description:
        'Two fixed demo credentials separate verification from account operations. The request handler checks the role before parsing input. The dashboard preselects Alice; it is not an app login implementation.',
      file: 'provider.mjs',
      symbol: 'fetch: authorization before input',
      line: 281,
      checkFile: 'verify.mjs',
      check:
        'The request checks reject missing credentials and the verification credential on account operations. Run npm test.',
    },
    kit: {
      description:
        'Publishable and secret keys identify the calling project. Convex checks the stored key’s permissions before server operations. Your own backend still authenticates Alice and chooses her user ID.',
      file: 'server/api/commerce/routes.ts',
      symbol: 'commerceAuth / authoritativeServerAuth',
      line: 143,
      checkFile: 'server/api/commerce/routes.test.ts',
      check:
        'Tests exercise missing, invalid, and under-scoped keys before input parsing on both bindings.',
    },
  },
  capabilities: {
    title: 'Different scope, declared explicitly',
    example: {
      description:
        'The descriptor names a fictional fixture store and makes no complete-profile claim. All six REST operations let you study the flow, including account deletion; they do not establish support for real stores or the full protocol.',
      file: 'provider.mjs',
      symbol: 'capabilities',
      line: 151,
      checkFile: 'verify.mjs',
      check:
        'Local checks validate the teaching flow and published vectors. They are not a full provider conformance report.',
    },
    kit: {
      description:
        'IAPKit declares profiles, both API bindings, and support per store. Apple and Google have subscription events; Meta and Amazon do not. Read the descriptor before choosing a store integration.',
      file: 'convex/commerce/capabilities.ts',
      symbol: 'PROVIDER_CAPABILITIES',
      line: 36,
      checkFile: 'convex/commerce/spec.conformance.test.ts',
      check:
        'Capability tests compare the served descriptor, store mappings, and implementation declarations.',
    },
  },
  rest: {
    title: 'The contract stays; the backend can differ',
    example: {
      description:
        'A small Fetch handler looks up each request in the published HTTP manifest, validates it, and calls a JavaScript handler backed by SQLite. It implements all six REST operations.',
      file: 'provider.mjs',
      symbol: 'fetch',
      line: 281,
      checkFile: 'scenario.mjs',
      check:
        'The dashboard calls real local HTTP endpoints, validates their responses, and checks the purchase flow. Run npm test.',
    },
    kit: {
      description:
        'Hono registers the same manifest’s routes and sends validated input to shared handlers backed by Convex and store services. It implements all six operations and also exposes GraphQL.',
      file: 'server/api/commerce/routes.ts',
      symbol: 'HTTP_BINDING route registration',
      line: 196,
      checkFile: 'server/api/commerce/conformance.test.ts',
      check:
        'The portable runner drives real route code with substituted store/database I/O and compares both bindings.',
    },
  },
  graphql: {
    title: 'One optional format, the same operations',
    example: {
      description:
        'This example implements REST only. Follow its handlers to understand the behavior, then use IAPKit’s adapter as a reference if your provider also needs GraphQL.',
      file: 'provider.mjs',
      symbol: 'REST operation handlers',
      line: 200,
      checkFile: 'README.md',
      check:
        'The README scopes the example to six REST operations; its tests do not establish GraphQL support.',
    },
    kit: {
      description:
        'The GraphQL adapter executes the generated schema and calls the same handlers as REST. A format change does not create a second ownership or access implementation.',
      file: 'server/api/commerce/graphql.ts',
      symbol: 'executeCommerceGraphql',
      line: 296,
      checkFile: 'server/api/commerce/conformance.test.ts',
      check:
        'The same operation vectors run over both bindings and check matching outcomes with fixture data.',
    },
  },
  checks: {
    title: 'Read the checks alongside the implementation',
    example: {
      description:
        'verify.mjs replays the purchase flow, expiry boundaries, signatures, retries, and receiver recovery. These checks explain what this small backend demonstrates; it makes no full-profile claim.',
      file: 'verify.mjs',
      symbol: 'verifyLab',
      line: 14,
      checkFile: 'README.md',
      check:
        'Install dependencies, then run npm test in the example repository. Bun runs its HTTP server and SQLite.',
    },
    kit: {
      description:
        'The published conformance runner calls IAPKit’s real REST and GraphQL routes against fixture store/database I/O. Separate worker and mutation tests cover persistence responsibilities.',
      file: 'server/api/commerce/conformance.test.ts',
      symbol: 'IAPKit dual-binding conformance',
      line: 323,
      checkFile: 'convex/commerce/spec.conformance.test.ts',
      check:
        'Run bun run test -- server/api/commerce/conformance.test.ts convex/commerce/spec.conformance.test.ts from packages/kit. These are local contract checks, not live store tests.',
    },
  },
} satisfies Record<string, ImplementationComparison>;

export type CommerceImplementationTopic =
  keyof typeof COMMERCE_IMPLEMENTATION_TOPICS;
