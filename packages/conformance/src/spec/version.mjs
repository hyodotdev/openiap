import { SPEC_VERSION } from './generated-spec.mjs';
import { SUITE_VERSION } from './suite-version.mjs';

/**
 * A report states the suite version and the OpenIAP spec version it validates.
 * "Conformant" without both attached is the unverifiable claim this suite
 * exists to replace.
 */
export { SUITE_VERSION };

/** Spec version this suite validates, generated from the repo-root SSOT. */
export function specVersion() {
  return SPEC_VERSION;
}
