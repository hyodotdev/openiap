import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import DataTable from '../../components/DataTable';
import SEO from '../../components/SEO';
import { COMMERCE_ROLES } from '../../lib/commerceEcosystem';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function CommerceEcosystemGuide(): React.JSX.Element {
  useScrollToHash();
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol: Build Your Part"
        path="/commerce-protocol/ecosystem"
        description="Build a paywall, commerce service, event consumer, or integrated platform around OpenIAP. Connect through defined boundaries and prove the role you supply."
      />
      <h1>Build your part</h1>
      <p>
        A paywall business can provide the experience. An analytics business can
        consume events. An integrated platform can supply both and the commerce
        backend. The app uses OpenIAP to purchase from the store in each
        arrangement.
      </p>
      <p className="commerce-actions">
        <a
          className="btn btn-primary"
          href="/commerce-example/integration-brief.md"
          download
        >
          Give your AI the integration brief ↓
        </a>
        <a
          className="btn btn-secondary"
          href={COMMERCE_PROTOCOL_LINKS.exampleSource}
          download
        >
          Download the working example ↓
        </a>
      </p>
      <p>
        The <a href={COMMERCE_PROTOCOL_LINKS.example}>example repository</a>{' '}
        includes a quick start, the client request mapper, and a standalone
        event receiver. Start there to inspect working code for your role.
      </p>
      <section>
        <AnchorLink id="roles" level="h2">
          Product roles and connection contracts
        </AnchorLink>
        <DataTable
          rows={[...COMMERCE_ROLES]}
          rowKey={(row) => row.id}
          columns={[
            { header: 'Role', cell: (row) => row.title },
            { header: 'Owns', cell: (row) => row.owns },
            { header: 'Connects through', cell: (row) => row.contract },
          ]}
        />
        <p>
          These are business roles, not new protocol profiles. Paywall layouts,
          targeting, product catalogs, attribution, and financial reporting
          remain product-specific APIs. The commerce data contract standardizes
          verification, ownership, access, and lifecycle delivery.
        </p>
      </section>
      <section>
        <AnchorLink id="experience" level="h2">
          Paywall specialist: keep the existing purchase runtime
        </AnchorLink>
        <p>
          Return a product selection to the host app’s purchase callback. The
          app fetches current store products and calls OpenIAP’s purchase API.
          Your service does not need to become the purchase verifier or account
          authority.
        </p>
        <p>
          <Link to="/commerce-protocol/getting-started#purchase-flow">
            See the purchase, backend, and lifecycle sequence diagrams →
          </Link>
        </p>
        <p>
          Define the product IDs and purchase/result callbacks with the app.
          That small host adapter belongs to the paywall integration; Commerce
          Protocol 1.0 does not define a universal paywall UI API. If your
          product uses lifecycle data, connect its backend with the{' '}
          <Link to="/commerce-protocol/getting-started#receive-events">
            ready receiver
          </Link>
          .
        </p>
      </section>
      <section>
        <AnchorLink id="client-boundary" level="h2">
          The client-to-provider connection
        </AnchorLink>
        <p>
          The current client helper <code>verifyPurchaseWithProvider</code>{' '}
          supports IAPKit’s own API. Changing its provider name or base URL is
          not a generic Commerce Protocol integration. For another provider, the
          app’s authenticated backend calls the protocol’s REST or GraphQL
          operations.
        </p>
        <p>
          The example’s <code>client-bridge.mjs</code> runs on the app backend,
          maps Apple and Google OpenIAP purchase fields into the installed
          protocol’s verification inputs and validates them. It also rejects
          missing evidence and unsupported stores. Run{' '}
          <code>npm run demo:bridge</code> in the downloaded example; it checks
          the request boundary, not a live store purchase.
        </p>
        <p>
          Apple sends its JWS; Google sends its purchase token. Amazon and
          Horizon require additional store user identifiers and need an explicit
          store adapter. Keep the application’s authenticated user identity
          separate from those store identities.
        </p>
        <p>
          Only the app backend selects <code>userId</code> and holds server-role
          credentials. Verification is not an access grant: bind under the
          ownership policy, read current entitlements, and fulfill durably
          before finishing the store transaction.
        </p>
      </section>
      <section>
        <AnchorLink id="composition" level="h2">
          Compose services without splitting authority
        </AnchorLink>
        <p>
          Choose one authoritative ownership and entitlement service for an
          app/project. A commerce service can delegate store verification
          internally while serving the complete profiles it declares. Separate
          businesses must agree on opaque user IDs, issuer/project scope,
          credentials, supported stores, and the selected protocol/profile
          versions.
        </p>
        <p>
          An event-only consumer implements receiver rules, not the{' '}
          <code>events</code> emitter profile. A provider implements core
          discovery and each advertised profile completely; account lifecycle
          includes erasure. Moving from a specialist to an integrated platform
          changes service ownership and configuration, while the store purchase
          flow and commerce payload meanings stay the same.
        </p>
        <p>
          These technical roles describe interoperability. Joint development,
          support commitments, and promotion depend on separately agreed
          contributions. The open contract does not include free hosting; IAPKit
          and other providers set their own service terms.
        </p>
        <p>
          <Link to="/commerce-protocol/profiles">Profile obligations</Link> ·{' '}
          <Link to="/commerce-protocol/conformance">Conformance runner</Link> ·{' '}
          <Link to="/commerce-protocol/versioning">
            Versioning and provider switching
          </Link>
        </p>
      </section>
      <section>
        <AnchorLink id="acceptance" level="h2">
          What a business delivers to an app team
        </AnchorLink>
        <p>
          Ship the host adapter or backend endpoint, supported-store
          configuration, executable checks, and a short connection example. The
          app team configures endpoints and credentials, installs the
          integration, and verifies the flow. It should not have to reimplement
          your service from the spec.
        </p>
        <ul>
          <li>
            Experience: product selection → OpenIAP purchase callback; show
            pending, canceled, failed, and fulfilled results.
          </li>
          <li>
            Commerce: published capabilities plus passing checks for every
            claimed profile/binding; store sandbox and account-isolation
            evidence separately.
          </li>
          <li>
            Data: signed event → durable inbox; prove retries, duplicates,
            malformed input, and unknown optional fields.
          </li>
          <li>
            Integrated platform: all the above for the roles it supplies, with
            one accountable owner for each state transition.
          </li>
        </ul>
        <p>
          The local example proves request mapping, a fixture purchase-to-access
          flow, and event ingestion. It does not certify a paywall UI, real
          store adapter, revenue model, or arbitrary platform as compatible.
        </p>
      </section>
    </div>
  );
}
export default CommerceEcosystemGuide;
