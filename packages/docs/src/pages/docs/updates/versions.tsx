import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { OPENIAP_PROTOCOLS, OPENIAP_VERSIONS } from '../../../lib/versioning';

const GOOGLE_MAVEN_BADGE =
  'https://img.shields.io/maven-central/v/io.github.hyochan.openiap/openiap-google';
const GOOGLE_MAVEN_ARTIFACT =
  'https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google';
// The Apple package ships on the repository's plain semantic tags, alongside
// prefixed tags for every other package, so the badge has to filter to this
// major or shields.io picks up an unrelated release. Deriving the major from
// openiap-versions.json keeps it correct across the next major bump.
const APPLE_TAG_MAJOR = OPENIAP_VERSIONS.apple.split('.')[0];
const APPLE_SWIFT_BADGE = `https://img.shields.io/github/v/tag/hyodotdev/openiap?filter=${APPLE_TAG_MAJOR}.*&label=Swift%20Package&logo=swift&color=orange`;
const APPLE_SWIFT_URL =
  'https://github.com/hyodotdev/openiap/tree/main/packages/apple';
const APPLE_COCOAPODS_BADGE =
  'https://img.shields.io/cocoapods/v/openiap?color=E35A5F&label=CocoaPods&logo=cocoapods';
const APPLE_COCOAPODS_URL = 'https://cocoapods.org/pods/openiap';
const NPM_PACKAGES = [
  [
    '@hyodotdev/openiap-client-protocol',
    'Client API, and the TypeScript, Swift, Kotlin, Dart, GDScript, and C# types generated from it',
  ],
  [
    '@hyodotdev/openiap-commerce-protocol',
    'Server operations, events, and conformance',
  ],
  [
    '@hyodotdev/openiap',
    'AI implementation briefs and local configuration checks',
  ],
] as const;

function Versions() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Versions"
        description="OpenIAP ecosystem versions - latest releases for openiap-apple, openiap-google, and the OpenIAP client specification (@hyodotdev/openiap-client-protocol)."
        path="/docs/updates/versions"
      />
      <h1>Versions &amp; Release Channels</h1>
      <p className="lead">
        Quickly scan the latest OpenIAP ecosystem versions using the badges and
        release links below. This page updates in lockstep with each library
        release train.
      </p>

      <section>
        <AnchorLink id="client-protocol" level="h2">
          Client Protocol
        </AnchorLink>
        <p>
          The Client Protocol is the purchase API an app calls. It is defined
          once as a GraphQL contract and published as{' '}
          <code>{OPENIAP_PROTOCOLS.client.package}</code>, currently{' '}
          <strong>v{OPENIAP_PROTOCOLS.client.version}</strong>. Every type an
          SDK exposes is generated from it.
        </p>
        <p>
          <code>openiap-apple</code>, <code>openiap-google</code>, and the six
          framework libraries <strong>implement</strong> this protocol. None of
          them defines it, and none may extend the contract locally &mdash; a
          new API starts as a schema change in the protocol.
        </p>

        <AnchorLink id="commerce-protocol" level="h2">
          Commerce Protocol
        </AnchorLink>
        <p>
          The Commerce Protocol is the server-side contract: purchase
          verification, entitlements, and lifecycle events exchanged between
          backends. It ships as{' '}
          <code>{OPENIAP_PROTOCOLS.commerce.package}</code>, currently{' '}
          <strong>v{OPENIAP_PROTOCOLS.commerce.version}</strong>. See the{' '}
          <Link to="/commerce-protocol">Commerce Protocol</Link> section for the
          specification itself.
        </p>
        <p>
          Any backend may implement it. IAPKit is one such implementation: it
          serves every profile and both bindings, and declares which
          capabilities it supports per store in its capability descriptor, so
          the gaps are published rather than implied.
        </p>
        <Callout kind="note" title="Two versions, two meanings">
          These are the versions of the protocol packages themselves. The
          version an SDK reports separately &mdash; <code>openiap-apple</code>{' '}
          and <code>openiap-google</code> below &mdash; is that native library's
          own release, not a protocol version.
        </Callout>
      </section>

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
        <AnchorLink id="openiap-npm" level="h2">
          OpenIAP npm packages
        </AnchorLink>
        <p>
          These packages version independently of the native SDKs. Each badge
          reads the published npm latest tag.
        </p>
        <ul>
          {NPM_PACKAGES.map(([name, description]) => (
            <li key={name}>
              <a
                href={`https://www.npmjs.com/package/${name}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flexWrap: 'wrap', gap: '0.5rem' }}
              >
                <code>{name}</code>{' '}
                <img
                  src={`https://img.shields.io/npm/v/${name}/latest`}
                  alt={`${name} npm version`}
                  style={{ verticalAlign: 'middle' }}
                />
              </a>{' '}
              — {description}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default Versions;
