import { CLIENT_PROTOCOL_VERSION } from './generated-spec.mjs';
import { SUITE_VERSION } from './suite-version.mjs';

/** Reports identify both the suite and the Client Protocol they validate. */
export { SUITE_VERSION };

/** Client Protocol version generated from its publishing manifest. */
export function clientProtocolVersion() {
  return CLIENT_PROTOCOL_VERSION;
}
