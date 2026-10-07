/**
 * Conformance suite version.
 *
 * Bump when behaviors change:
 *   major — a behavior is added or tightened (previously passing runs may fail)
 *   minor — a capability-gated behavior is added
 *   patch — wording or tooling only; verdicts cannot change
 */
export const SUITE_VERSION = '4.0.0';

/**
 * Publication date of the current suite major. The release that publishes a
 * new major sets this to the publication date; the registry maintenance grace
 * window starts from it. Never the date the bump was authored.
 */
export const SUITE_MAJOR_RELEASE_DATE = '2026-10-07';
