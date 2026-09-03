import AnchorLink from '../../components/AnchorLink';
import Callout from '../../components/Callout';
import DataTable from '../../components/DataTable';
import type { DataTableColumn } from '../../components/DataTable';
import ExternalRedirect from '../../components/ExternalRedirect';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';
import commerceEventSchema from 'openiap-commerce-protocol/generated/schemas/commerce-event.schema.json';

const KNOWN_COMMERCE_EVENT_TYPES =
  commerceEventSchema.properties.eventType.examples;

const SPEC_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/commerce-protocol/SPEC.md#94-webhook-contract';
const GRAPHQL_CONTRACT_URL =
  'https://github.com/hyodotdev/openiap/tree/main/specs/commerce-protocol/schema';
const SIGNATURE_VECTORS_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/commerce-protocol/vectors/signatures.json';
const LEGACY_IAPKIT_HASHES = new Set([
  '#outbound',
  '#setup',
  '#processing',
  '#app-refresh',
]);

interface HeaderRow {
  header: string;
  value: string;
  authority: string;
}

const HEADER_ROWS: HeaderRow[] = [
  {
    header: 'openiap-signature',
    value: 'v1=<hex>, optionally repeated during rotation',
    authority: 'Verified against the exact body bytes',
  },
  {
    header: 'openiap-timestamp',
    value: 'Unix seconds at signing',
    authority: 'Part of the signed input',
  },
  {
    header: 'openiap-event-id',
    value: 'The eventId value',
    authority: 'Convenience only; trust the signed body',
  },
  {
    header: 'openiap-delivery-id',
    value: 'One delivery-attempt chain',
    authority: 'Operational correlation only',
  },
];

const HEADER_COLUMNS: DataTableColumn<HeaderRow>[] = [
  { header: 'Header', cell: (row) => <code>{row.header}</code> },
  { header: 'Value', cell: (row) => row.value },
  { header: 'Role', cell: (row) => row.authority },
];

interface ResponseRow {
  response: string;
  behavior: string;
}

const RESPONSE_ROWS: ResponseRow[] = [
  { response: '2xx', behavior: 'Delivered' },
  { response: '408, 429, 5xx', behavior: 'Retry' },
  { response: '3xx', behavior: 'Permanent failure; do not follow' },
  { response: 'Other 4xx', behavior: 'Permanent failure; do not retry' },
  { response: 'Timeout or connection error', behavior: 'Retry' },
];

const RESPONSE_COLUMNS: DataTableColumn<ResponseRow>[] = [
  { header: 'Consumer response', cell: (row) => <code>{row.response}</code> },
  { header: 'Emitter behavior', cell: (row) => row.behavior },
];

function Webhooks() {
  useScrollToHash();

  if (LEGACY_IAPKIT_HASHES.has(window.location.hash)) {
    return <ExternalRedirect to="https://kit.openiap.dev/docs/webhooks" />;
  }

  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Webhook Contract"
        description="The vendor-neutral OpenIAP Commerce Protocol contract for signed, retrying server-to-server event delivery."
        path="/docs/webhooks"
        keywords="OpenIAP Commerce Protocol webhook, signed commerce events, HMAC webhook, idempotent webhook consumer"
      />
      <h1>Webhook Contract</h1>
      <p>
        The Commerce Protocol standardizes how a conforming backend delivers one
        normalized commerce event to a consumer-controlled HTTPS endpoint. It
        defines the portable boundary, not a dashboard, credential store, or
        vendor-specific setup flow.
      </p>
      <pre>
        <code>Store → conforming backend → consumer HTTPS endpoint</code>
      </pre>
      <Callout kind="important">
        This contract is server-to-server. It defines no backend-to-app event
        stream, SSE endpoint, WebSocket, push relay, or long-poll feed. Device
        push belongs to the developer&apos;s authenticated backend.
      </Callout>

      <section>
        <AnchorLink id="request" level="h2">
          Request
        </AnchorLink>
        <p>
          The emitter sends <code>POST</code> to a public HTTPS URL supplied
          directly by the consumer. The content type is{' '}
          <code>application/json</code>, and the body is one Commerce Protocol
          event document.
        </p>
        <DataTable
          columns={HEADER_COLUMNS}
          rows={HEADER_ROWS}
          rowKey={(row) => row.header}
        />
        <p>
          Headers help route and inspect a delivery, but the signed body is the
          authority. Read <code>eventId</code> from the parsed body rather than
          trusting the convenience header.
        </p>
      </section>

      <section>
        <AnchorLink id="event-vocabulary" level="h2">
          Event vocabulary
        </AnchorLink>
        <p>Known event types named by Protocol 1.0 are:</p>
        <pre>
          <code>{KNOWN_COMMERCE_EVENT_TYPES.join(', ')}</code>
        </pre>
        <p>
          The schema value space is open: a later MINOR version may add another
          type. Read the event schema for the normative fields and apply only
          event types your consumer understands.
        </p>
      </section>

      <section>
        <AnchorLink id="signature" level="h2">
          Verify the signature before parsing
        </AnchorLink>
        <pre>
          <code>{`signature = "v1=" + lowercase_hex(
  HMAC_SHA256(secret, timestamp + "." + exactBodyBytes)
)`}</code>
        </pre>
        <ol>
          <li>
            Read the raw request bytes. Re-serializing JSON changes the signed
            input.
          </li>
          <li>
            Accept only when <code>|now - timestamp| &lt;= 300</code> seconds;
            otherwise reject it.
          </li>
          <li>
            Split <code>openiap-signature</code> on commas and accept any valid{' '}
            <code>v1=</code> value. Rotation may supply two signatures.
          </li>
          <li>Compare signatures in constant time.</li>
          <li>
            Parse the verified body, then atomically deduplicate on its{' '}
            <code>eventId</code> before side effects.
          </li>
        </ol>
        <Callout kind="warning">
          Never log the signing secret, raw receipts, credentials, or personal
          data. Treat every optional provider extension as untrusted input.
        </Callout>
      </section>

      <section>
        <AnchorLink id="delivery" level="h2">
          Delivery is duplicate-capable and unordered
        </AnchorLink>
        <p>
          An emitter retries transient failures with exponential backoff and
          eventually stops and dead-letters an unaccepted delivery. A consumer
          may receive zero, one, or several copies, so it acknowledges before
          slow downstream work and remains idempotent on the stable{' '}
          <code>eventId</code>.
        </p>
        <DataTable
          className="webhook-response-table"
          columns={RESPONSE_COLUMNS}
          rows={RESPONSE_ROWS}
          rowKey={(row) => row.response}
        />
        <p>
          Retries and independent queues can reorder events. Consumers use{' '}
          <code>occurredAt</code> to prevent an older snapshot from overwriting
          newer state, while still processing independent idempotent effects.
        </p>
      </section>

      <section>
        <AnchorLink id="destination-safety" level="h2">
          Destination safety
        </AnchorLink>
        <p>
          Emitters accept public HTTPS destinations only. They reject embedded
          credentials and loopback, private, link-local, or unique-local
          addresses; validate every resolved address; and do not follow
          redirects. They connect only to a validated public address, by pinning
          it or verifying the connected peer before sending bytes.
        </p>
      </section>

      <section>
        <AnchorLink id="resources" level="h2">
          Normative resources
        </AnchorLink>
        <ul>
          <li>
            <a href={SPEC_URL} target="_blank" rel="noreferrer">
              Webhook contract
            </a>{' '}
            — request, signature, response, delivery, and destination rules
          </li>
          <li>
            <a href={GRAPHQL_CONTRACT_URL} target="_blank" rel="noreferrer">
              GraphQL contract
            </a>{' '}
            — the human-readable wire structure and validation directives
          </li>
          <li>
            <a href={SIGNATURE_VECTORS_URL} target="_blank" rel="noreferrer">
              Signature vectors
            </a>{' '}
            — reproducible valid and rejected cases
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Webhooks;
