export const COMMERCE_ROLES = [
  {
    id: 'experience',
    title: 'Experience',
    examples: 'Paywalls · offers · experiments',
    owns: 'Presentation, targeting, and product selection',
    input:
      'Product IDs, store-fetched product details, and app-authorized access',
    output: 'A selected product for the app to purchase with OpenIAP',
    contract: 'Client purchase API; provider-specific presentation API',
    rule: 'Use the app’s purchase callback and store-returned product details. A paywall impression or button click cannot grant access.',
    start: '/commerce-protocol/ecosystem#experience',
  },
  {
    id: 'commerce',
    title: 'Commerce services',
    examples: 'Verification · identity binding · access',
    owns: 'Store evidence validation, purchase ownership, and current entitlement state',
    input: 'Store evidence; the app backend’s authenticated user identity',
    output:
      'Verification results, tokenless access reads, and supported lifecycle events',
    contract: 'Core + complete declared profiles and bindings',
    rule: 'Declare only implemented profiles. Keep account authority, time-based access, erasure, and event delivery obligations intact when delegating work.',
    start: '/commerce-protocol/implementation',
  },
  {
    id: 'data',
    title: 'Data & automation',
    examples: 'Analytics · attribution · CRM',
    owns: 'Event ingestion and its own business models and workflows',
    input: 'Authenticated normalized events from a configured emitter',
    output:
      'Reports, audiences, experiments, or actions in the consumer’s product',
    contract:
      'Webhook receiver rules; no emitter-profile claim merely for receiving',
    rule: 'Authenticate the raw body, deduplicate within the emitter’s identity scope, and preserve unknown values. Lifecycle events alone are not a revenue ledger.',
    start: '/commerce-protocol/getting-started#receive-events',
  },
] as const;

export const COMMERCE_BUSINESSES = [
  { name: 'Paywall specialist', roles: ['experience'] },
  { name: 'Commerce provider', roles: ['commerce'] },
  { name: 'Analytics platform', roles: ['data'] },
  { name: 'Integrated platform', roles: ['experience', 'commerce', 'data'] },
] as const;
