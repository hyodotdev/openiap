import AnchorLink from '../../components/AnchorLink';
import { useScrollToHash } from '../../hooks/useScrollToHash';
import { GQL_RELEASE } from '../../lib/versioning';

const GOOGLE_MAVEN_BADGE =
  'https://img.shields.io/maven-central/v/io.github.hyochan.openiap/openiap-google';
const GOOGLE_MAVEN_ARTIFACT =
  'https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google';
const APPLE_SWIFT_BADGE =
  'https://img.shields.io/github/v/tag/hyodotdev/openiap-apple?label=Swift%20Package&logo=swift&color=orange';
const APPLE_SWIFT_URL = 'https://github.com/hyodotdev/openiap-apple';
const APPLE_COCOAPODS_BADGE =
  'https://img.shields.io/cocoapods/v/openiap?color=E35A5F&label=CocoaPods&logo=cocoapods';
const APPLE_COCOAPODS_URL = 'https://cocoapods.org/pods/openiap';
const GQL_RELEASES_URL = 'https://github.com/hyodotdev/openiap/releases';

function Versions() {
  useScrollToHash();
  const latestGqlRelease = GQL_RELEASE ?? {
    tag: '—',
    pageUrl: GQL_RELEASES_URL,
  };

  return (
    <div className="doc-page">
      <h1>Versions &amp; Release Channels</h1>
      <p className="lead">
        Quickly scan the latest OpenIAP ecosystem versions using the badges and
        release links below. This page updates in lockstep with each library
        release train.
      </p>

      <section>
        <AnchorLink id="openiap-google" level="h2">
          OpenIAP Google Library
        </AnchorLink>
        <p>
          The Google Play Billing implementation ships through Maven Central.
          Use the badge below to monitor the currently published artifact.
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <a
            href={GOOGLE_MAVEN_ARTIFACT}
            target="_blank"
            rel="noopener noreferrer"
            title="View io.github.hyochan.openiap:openiap-google on Maven Central"
            className="badge-link"
          >
            <img
              src={GOOGLE_MAVEN_BADGE}
              alt="Maven Central status for openiap-google"
              style={{ height: '28px' }}
            />
          </a>
          <code style={{ fontSize: '0.85rem' }}>
            io.github.hyochan.openiap:openiap-google
          </code>
        </div>
        <ul>
          <li>
            Latest stable release badge reflects Maven Central publication.
          </li>
          <li>
            Releases follow the core OpenIAP spec cadence; check the tag notes
            on GitHub for API surface changes.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="openiap-apple" level="h2">
          OpenIAP Apple Library
        </AnchorLink>
        <p>
          StoreKit 2 support is distributed via Swift Package Manager and
          CocoaPods. Both channels are updated in lockstep.
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            margin: '1rem 0',
          }}
        >
          <a
            href={APPLE_SWIFT_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="OpenIAP Apple Swift Package"
          >
            <img
              src={APPLE_SWIFT_BADGE}
              alt="Swift Package"
              style={{ height: '28px' }}
            />
          </a>
          <a
            href={APPLE_COCOAPODS_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="OpenIAP CocoaPods"
          >
            <img
              src={APPLE_COCOAPODS_BADGE}
              alt="CocoaPods version for openiap"
              style={{ height: '28px' }}
            />
          </a>
        </div>
        <ul>
          <li>
            SPM packages are tagged with the same semantic versions as docs.
          </li>
          <li>CocoaPods specs are pushed immediately after SPM releases.</li>
        </ul>
      </section>

      <section>
        <AnchorLink id="openiap-gql" level="h2">
          OpenIAP GraphQL Schema (GQL)
        </AnchorLink>
        <p>
          The GraphQL schema powers API docs and SDK generators. Review the
          latest schema exports from the releases tab.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <a
            href={latestGqlRelease.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Latest tag: {latestGqlRelease.tag}
          </a>
          <a
            href={GQL_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '0.4rem 1rem',
              borderRadius: '9999px',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            View all releases
          </a>
        </div>
        <ul>
          <li>
            Each release bundles TypeScript, Swift, Kotlin, and Dart bindings.
          </li>
          <li>
            Downloads mirror the assets linked from the documentation Types page
            for the same tag.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Versions;
