/**
 * Ordered GraphQL schema inputs shared by both generation pipelines.
 *
 * This is the canonical production inventory. Every repository-owned
 * generation path imports it directly; schema-files.test.mjs prevents missing
 * or duplicate SDL inputs.
 */
export const SCHEMA_FILE_NAMES = Object.freeze([
  'schema.graphql',
  'type.graphql',
  'type-ios.graphql',
  'type-android.graphql',
  'api.graphql',
  'api-ios.graphql',
  'api-android.graphql',
  'error.graphql',
  'event.graphql',
  'webhook.graphql',
]);
