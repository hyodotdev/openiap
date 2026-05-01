/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as analytics_action from "../analytics/action.js";
import type * as apiKeys_helpers from "../apiKeys/helpers.js";
import type * as apiKeys_internal from "../apiKeys/internal.js";
import type * as apiKeys_mutation from "../apiKeys/mutation.js";
import type * as apiKeys_query from "../apiKeys/query.js";
import type * as auth from "../auth.js";
import type * as certificates_apple_root_certificates from "../certificates/apple_root_certificates.js";
import type * as crons from "../crons.js";
import type * as files_action from "../files/action.js";
import type * as files_internal from "../files/internal.js";
import type * as files_mutation from "../files/mutation.js";
import type * as files_query from "../files/query.js";
import type * as files_validation from "../files/validation.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as organizations_internal from "../organizations/internal.js";
import type * as organizations_mutation from "../organizations/mutation.js";
import type * as organizations_query from "../organizations/query.js";
import type * as paywalls_mutation from "../paywalls/mutation.js";
import type * as paywalls_query from "../paywalls/query.js";
import type * as plans from "../plans.js";
import type * as products_asc from "../products/asc.js";
import type * as products_jwt from "../products/jwt.js";
import type * as products_mutation from "../products/mutation.js";
import type * as products_play from "../products/play.js";
import type * as products_query from "../products/query.js";
import type * as products_sync from "../products/sync.js";
import type * as projects_helpers from "../projects/helpers.js";
import type * as projects_internal from "../projects/internal.js";
import type * as projects_mutation from "../projects/mutation.js";
import type * as projects_query from "../projects/query.js";
import type * as projects_setupStatus from "../projects/setupStatus.js";
import type * as purchases_action from "../purchases/action.js";
import type * as purchases_android from "../purchases/android.js";
import type * as purchases_cleanup from "../purchases/cleanup.js";
import type * as purchases_errors from "../purchases/errors.js";
import type * as purchases_horizon from "../purchases/horizon.js";
import type * as purchases_internal from "../purchases/internal.js";
import type * as purchases_ios from "../purchases/ios.js";
import type * as purchases_mutation from "../purchases/mutation.js";
import type * as purchases_purchaseState from "../purchases/purchaseState.js";
import type * as purchases_query from "../purchases/query.js";
import type * as purchases_retry from "../purchases/retry.js";
import type * as purchases_shared from "../purchases/shared.js";
import type * as purchases_stats from "../purchases/stats.js";
import type * as subscriptions_horizon from "../subscriptions/horizon.js";
import type * as subscriptions_horizonInternal from "../subscriptions/horizonInternal.js";
import type * as subscriptions_internal from "../subscriptions/internal.js";
import type * as subscriptions_mutation from "../subscriptions/mutation.js";
import type * as subscriptions_query from "../subscriptions/query.js";
import type * as subscriptions_stateMachine from "../subscriptions/stateMachine.js";
import type * as userProfiles_action from "../userProfiles/action.js";
import type * as userProfiles_internal from "../userProfiles/internal.js";
import type * as userProfiles_mutation from "../userProfiles/mutation.js";
import type * as userProfiles_query from "../userProfiles/query.js";
import type * as users_internal from "../users/internal.js";
import type * as users_query from "../users/query.js";
import type * as utils_errors from "../utils/errors.js";
import type * as utils_helpers from "../utils/helpers.js";
import type * as utils_validation from "../utils/validation.js";
import type * as webhooks_apple from "../webhooks/apple.js";
import type * as webhooks_google from "../webhooks/google.js";
import type * as webhooks_internal from "../webhooks/internal.js";
import type * as webhooks_query from "../webhooks/query.js";
import type * as webhooks_shared from "../webhooks/shared.js";
import type * as webhooks_validators from "../webhooks/validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  "analytics/action": typeof analytics_action;
  "apiKeys/helpers": typeof apiKeys_helpers;
  "apiKeys/internal": typeof apiKeys_internal;
  "apiKeys/mutation": typeof apiKeys_mutation;
  "apiKeys/query": typeof apiKeys_query;
  auth: typeof auth;
  "certificates/apple_root_certificates": typeof certificates_apple_root_certificates;
  crons: typeof crons;
  "files/action": typeof files_action;
  "files/internal": typeof files_internal;
  "files/mutation": typeof files_mutation;
  "files/query": typeof files_query;
  "files/validation": typeof files_validation;
  http: typeof http;
  migrations: typeof migrations;
  "organizations/internal": typeof organizations_internal;
  "organizations/mutation": typeof organizations_mutation;
  "organizations/query": typeof organizations_query;
  "paywalls/mutation": typeof paywalls_mutation;
  "paywalls/query": typeof paywalls_query;
  plans: typeof plans;
  "products/asc": typeof products_asc;
  "products/jwt": typeof products_jwt;
  "products/mutation": typeof products_mutation;
  "products/play": typeof products_play;
  "products/query": typeof products_query;
  "products/sync": typeof products_sync;
  "projects/helpers": typeof projects_helpers;
  "projects/internal": typeof projects_internal;
  "projects/mutation": typeof projects_mutation;
  "projects/query": typeof projects_query;
  "projects/setupStatus": typeof projects_setupStatus;
  "purchases/action": typeof purchases_action;
  "purchases/android": typeof purchases_android;
  "purchases/cleanup": typeof purchases_cleanup;
  "purchases/errors": typeof purchases_errors;
  "purchases/horizon": typeof purchases_horizon;
  "purchases/internal": typeof purchases_internal;
  "purchases/ios": typeof purchases_ios;
  "purchases/mutation": typeof purchases_mutation;
  "purchases/purchaseState": typeof purchases_purchaseState;
  "purchases/query": typeof purchases_query;
  "purchases/retry": typeof purchases_retry;
  "purchases/shared": typeof purchases_shared;
  "purchases/stats": typeof purchases_stats;
  "subscriptions/horizon": typeof subscriptions_horizon;
  "subscriptions/horizonInternal": typeof subscriptions_horizonInternal;
  "subscriptions/internal": typeof subscriptions_internal;
  "subscriptions/mutation": typeof subscriptions_mutation;
  "subscriptions/query": typeof subscriptions_query;
  "subscriptions/stateMachine": typeof subscriptions_stateMachine;
  "userProfiles/action": typeof userProfiles_action;
  "userProfiles/internal": typeof userProfiles_internal;
  "userProfiles/mutation": typeof userProfiles_mutation;
  "userProfiles/query": typeof userProfiles_query;
  "users/internal": typeof users_internal;
  "users/query": typeof users_query;
  "utils/errors": typeof utils_errors;
  "utils/helpers": typeof utils_helpers;
  "utils/validation": typeof utils_validation;
  "webhooks/apple": typeof webhooks_apple;
  "webhooks/google": typeof webhooks_google;
  "webhooks/internal": typeof webhooks_internal;
  "webhooks/query": typeof webhooks_query;
  "webhooks/shared": typeof webhooks_shared;
  "webhooks/validators": typeof webhooks_validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
