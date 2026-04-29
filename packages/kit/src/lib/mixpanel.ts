import mixpanel from "mixpanel-browser";
import { MIXPANEL_TOKEN } from "../config/env";

const MIXPANEL_API_HOST = "https://api-eu.mixpanel.com";

type Primitive = string | number | boolean | null | undefined;
type EventProperties = Record<string, Primitive | Primitive[]>;

/**
 * Canonical event names tracked by the SPA. Keeping them in one enum
 * (a) prevents typo drift on Mixpanel's server side, and (b) gives
 * the retention funnels / cohort reports a stable set to build on.
 * New events should be added here with a short comment explaining
 * which retention question they help answer.
 */
export const MixpanelEvent = {
  // Lifecycle ---------------------------------------------------------
  /** First time we see a user after sign-up — drives Day 0 retention. */
  SignupCompleted: "signup_completed",
  /** Every successful sign-in, new or returning. */
  SignedIn: "signed_in",
  /** Sign-out. Useful to compute session length. */
  SignedOut: "signed_out",

  // Activation --------------------------------------------------------
  /** User created their first org (or any subsequent one). */
  OrganizationCreated: "organization_created",
  /** Project creation — the activation event for the dashboard. */
  ProjectCreated: "project_created",
  /** API key created — proxy for "ready to integrate". */
  ApiKeyCreated: "api_key_created",

  // Engagement --------------------------------------------------------
  //
  // Generic page-view coverage is delegated to mixpanel-browser's
  // `track_pageview: "url-with-path"` autocapture setting — SPA route
  // transitions are picked up by the library without us firing a
  // redundant custom event. Only the page-specific signals below
  // exist so we can build retention cohorts on meaningful destinations
  // (Purchases dashboard = "are they watching their own data?",
  // DocsLayout = integration intent) without drowning in every
  // intermediate click.
  /** Customer opened the Purchases dashboard for a project — proxy for
   *  "are they watching their own data?". Fires once per projectId
   *  mount; SPA sub-navigation is captured by autocapture pageviews. */
  ViewedPurchases: "viewed_purchases",
  /** Customer opened the docs shell. Intent signal — did they try to
   *  integrate before churning? */
  ViewedDocs: "viewed_docs",

  // Server-side milestones (fired from Convex actions, not the SPA) ---
  /** A project saw its FIRST valid receipt validation from the API.
   *  Activation milestone for the SaaS. Emitted from
   *  `convex/analytics/action.ts:trackFirstReceiptVerified` when
   *  `purchaseStats.valid` transitions 0 → 1. */
  FirstReceiptVerified: "first_receipt_verified",
} as const;

export type MixpanelEventName =
  (typeof MixpanelEvent)[keyof typeof MixpanelEvent];

let initialized = false;

const isBrowser = typeof window !== "undefined";

// Hostnames whitelisted for Mixpanel init. Forks self-hosting IAPKit
// must NOT pipe their users' events into the OpenIAP-managed Mixpanel
// project — otherwise their analytics, costs, and PII land on someone
// else's dashboard. If a fork wants its own analytics, it should swap
// in its own VITE_KIT_MIXPANEL_TOKEN AND extend this list.
const ALLOWED_HOSTS = new Set(["kit.openiap.dev", "localhost", "127.0.0.1"]);

function initMixpanel() {
  if (!isBrowser) {
    return false;
  }

  if (initialized) {
    return true;
  }

  if (!MIXPANEL_TOKEN) {
    return false;
  }

  // Origin guard — no-op on unrecognized hosts so forks don't ship
  // events to the official Mixpanel project.
  if (!ALLOWED_HOSTS.has(window.location.hostname)) {
    return false;
  }

  mixpanel.init(MIXPANEL_TOKEN, {
    api_host: MIXPANEL_API_HOST,
    // Persist the distinct_id in localStorage so a returning user on
    // the same browser threads into the same cohort even without being
    // signed in — key for the "active users" / D1/D7 retention boards.
    persistence: "localStorage",
    // Auto-track clicks / form submissions / pageviews. Mixpanel's
    // default retention boards (Active Users Today / By City / etc.)
    // read from these implicit events, so turning this off would
    // empty every chart on the board.
    autocapture: true,
    // Session replay — we're on a paid plan that exposes it; capture
    // 100% while the product is small so we can watch real flows and
    // diagnose churn signals.
    record_sessions_percent: 100,
    // Surface auto-pageviews (no-op with autocapture already on, but
    // keeps the intent explicit if someone tunes autocapture later).
    track_pageview: "url-with-path",
  });
  initialized = true;

  return true;
}

/**
 * Identify the signed-in user for Mixpanel + set their profile
 * properties. Calling this with the same `userId` is idempotent — it
 * just refreshes the profile traits.
 */
export function identifyUser(userId: string, traits?: EventProperties) {
  if (!initMixpanel()) {
    return;
  }

  mixpanel.identify(userId);

  if (traits) {
    mixpanel.people.set(traits);
  }
}

/** Wipe the local Mixpanel state on sign-out. */
export function resetUser() {
  if (!isBrowser || !initialized) {
    return;
  }

  mixpanel.reset();
}

/**
 * Track a product event. Safe to call before `identifyUser` — Mixpanel
 * attaches the pre-identify distinct_id and merges on identify.
 * No-op when Mixpanel wasn't initialized (missing token, SSR, etc.).
 */
export function trackEvent(
  name: MixpanelEventName,
  properties?: EventProperties,
) {
  if (!initMixpanel()) {
    return;
  }

  mixpanel.track(name, properties);
}

/**
 * Persist user profile properties (plan, org count, last login, ...).
 * Separate from `identifyUser` so callers can update individual
 * properties as they change without re-asserting the full profile.
 */
export function setUserProperties(properties: EventProperties) {
  if (!initMixpanel()) {
    return;
  }

  mixpanel.people.set(properties);
}
