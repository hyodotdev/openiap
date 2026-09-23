import { COMMERCE_PROTOCOL_LINKS } from '../../lib/config';
import AnchorLink from '../../components/AnchorLink';
import SEO from '../../components/SEO';

const SPEC_URL = COMMERCE_PROTOCOL_LINKS.spec;

function CommerceVersioning() {
  return (
    <div className="doc-page">
      <SEO
        title="Commerce Protocol Versioning"
        description="MAJOR.MINOR rules for the protocol, its profiles, and its bindings — and what consumers pin on."
        path="/commerce-protocol/versioning"
        keywords="OpenIAP Commerce Protocol versioning"
      />
      <h1>Versioning</h1>
      <p>
        Versions tell you whether two services still understand the same
        contract after an update. A <strong>minor</strong> update adds
        compatible information. A <strong>major</strong> update can require
        changes to your integration.
      </p>
      <p>
        For example, adding an optional field to an open response can be minor:
        older callers ignore it. Renaming a field is normally major because
        those callers would no longer find the answer they expect. Before the
        npm package reaches <code>1.0.0</code>, a wire member can be renamed
        without moving the protocol major; each such rename is listed with its
        migration note.
      </p>
      <p>
        The protocol, each profile, and each binding version independently as
        MAJOR.MINOR, and callers pin on the major. The protocol version is
        separate from the npm package version. Open value spaces and open
        objects are what make MINOR additions safe: a consumer tolerates what it
        does not recognise instead of failing.
      </p>
      <section>
        <AnchorLink id="impact" level="h2">
          What changes what
        </AnchorLink>
        <p>
          <a
            href={`${SPEC_URL}#12-versioning`}
            target="_blank"
            rel="noopener noreferrer"
          >
            SPEC.md §12
          </a>{' '}
          has the full MAJOR/MINOR decision table and the list of renames made
          before <code>1.0.0</code>. The REST path&apos;s <code>v1</code>{' '}
          segment is the protocol major, so two majors can be served side by
          side during a migration.
        </p>
      </section>
    </div>
  );
}

export default CommerceVersioning;
