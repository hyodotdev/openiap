import CommerceImplementationComparison from '../../components/CommerceImplementationComparison';
import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import capabilitiesExample from '@hyodotdev/openiap-commerce-protocol/examples/provider-capabilities.json';
import AnchorLink from '../../components/AnchorLink';
import SEO from '../../components/SEO';

const SPEC_URL = COMMERCE_PROTOCOL_LINKS.spec;

const DESCRIPTOR_EXCERPT = JSON.stringify(
  {
    specVersion: capabilitiesExample.specVersion,
    profiles: capabilitiesExample.profiles,
    bindings: capabilitiesExample.bindings,
    stores: {
      google: {
        serverNotifications:
          capabilitiesExample.stores.google.serverNotifications,
      },
    },
  },
  null,
  2
);

function CommerceCapabilities() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Capabilities"
        description="The machine-readable capability descriptor: protocol version, profiles, bindings, and honest per-store support."
        path="/commerce-protocol/capabilities"
        keywords="OpenIAP Commerce Protocol capabilities, provider descriptor"
      />
      <h1>Capabilities</h1>
      <p>
        <strong>
          Capabilities are a provider’s list of supported features.
        </strong>{' '}
        Read it before connecting so your app does not ask a service to do
        something it cannot do.
      </p>
      <p>For Alice’s subscription, check three things:</p>
      <ol>
        <li>
          <strong>Responsibilities:</strong> can it verify the purchase,
          associate it with Alice, and return her access? These are its
          profiles.
        </li>
        <li>
          <strong>API format:</strong> can your backend call it using REST or
          GraphQL? These formats are called bindings.
        </li>
        <li>
          <strong>Store integration:</strong> does this implementation support
          the store and signals your product needs?
        </li>
      </ol>
      <p>
        The public <code>providerCapabilities</code> request returns this
        information without a credential or customer data. Your AI can check it
        before building the connection.
      </p>
      <CommerceImplementationComparison topic="capabilities" />
      <section>
        <AnchorLink id="descriptor" level="h2">
          Read a capability response
        </AnchorLink>
        <details>
          <summary>JSON example and exact fields</summary>
          <pre>
            <code>{DESCRIPTOR_EXCERPT}</code>
          </pre>
          <p>
            This is an excerpt from the package's{' '}
            <a href={COMMERCE_PROTOCOL_LINKS.capabilitiesExample}>
              complete example
            </a>
            , not a response to copy unchanged. Include every required field and
            replace its profiles, event types, and store support with what your
            own implementation demonstrates. Validate the result against
            <code> ProviderCapabilities</code> in the installed schema bundle.
          </p>
          <p>
            Each store capability carries two deliberate booleans —{' '}
            <code>provider</code> (what the store offers) and{' '}
            <code>implementation</code> (what this backend consumes) — because
            collapsing them hides whose gap a missing signal is. Declaring a
            profile or binding is a conformance claim: partial support must not
            be declared. See{' '}
            <a
              href={`${SPEC_URL}#10-provider-capabilities`}
              target="_blank"
              rel="noopener noreferrer"
            >
              SPEC.md §10
            </a>
            .
          </p>
        </details>
      </section>
    </div>
  );
}

export default CommerceCapabilities;
