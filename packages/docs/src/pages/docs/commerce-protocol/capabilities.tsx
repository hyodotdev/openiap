import capabilitiesExample from 'openiap-commerce-protocol/examples/provider-capabilities.json';
import AnchorLink from '../../../components/AnchorLink';
import SEO from '../../../components/SEO';

const SPEC_URL =
  'https://github.com/hyodotdev/openiap/blob/main/specs/commerce-protocol/SPEC.md';

const DESCRIPTOR_EXCERPT = JSON.stringify(
  {
    specVersion: capabilitiesExample.specVersion,
    profiles: capabilitiesExample.profiles,
    bindings: capabilitiesExample.bindings,
    stores: {
      google: { serverNotifications: { provider: true, implementation: true } },
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
        path="/docs/commerce-protocol/capabilities"
        keywords="OpenIAP Commerce Protocol capabilities, provider descriptor"
      />
      <h1>Capabilities</h1>
      <p>
        Every provider answers <code>providerCapabilities</code> with a
        self-describing document — no credential, no commerce data, no central
        registry. A consumer reads it to learn the protocol version, the
        profiles and bindings served, and what each store integration can
        actually observe.
      </p>
      <section>
        <AnchorLink id="descriptor" level="h2">
          The descriptor
        </AnchorLink>
        <pre>
          <code>{DESCRIPTOR_EXCERPT}</code>
        </pre>
        <p>
          Each store capability carries two deliberate booleans —{' '}
          <code>provider</code> (what the store offers) and{' '}
          <code>implementation</code> (what this backend consumes) — because
          collapsing them hides whose gap a missing signal is. Declaring a
          profile or binding is a conformance claim: partial support must not be
          declared. See{' '}
          <a
            href={`${SPEC_URL}#10-provider-capabilities`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SPEC.md §10
          </a>
          .
        </p>
      </section>
    </div>
  );
}

export default CommerceCapabilities;
