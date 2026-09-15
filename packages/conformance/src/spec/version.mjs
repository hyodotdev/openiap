import { CLIENT_PROTOCOL_VERSION } from './generated-spec.mjs';
import { SUITE_VERSION } from './suite-version.mjs';

/**
 * A report states the suite version and the Client Protocol version it
 * validates. "Conformant" without both attached is the unverifiable claim this
 * suite exists to replace.
 */
export { SUITE_VERSION };

/** Client Protocol version this suite validates, generated from the repo-root SSOT. */
export function clientProtocolVersion() {
  return CLIENT_PROTOCOL_VERSION;
}
