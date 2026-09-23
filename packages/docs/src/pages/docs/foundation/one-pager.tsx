import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import DataTable from '../../../components/DataTable';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { LIBRARIES } from '../../../lib/images';
import { CURRENT_SPONSORS, FUNDING_LINKS } from '../../../lib/sponsors';
import {
  GOOGLE_PLAY_BILLING,
  OPENIAP_PROTOCOLS,
} from '../../../lib/versioning';

interface Component {
  name: string;
  description: ReactNode;
}

const COMPONENTS: Component[] = [
  {
    name: 'Code generation',
    description:
      'Typed bindings for TypeScript, Swift, Kotlin, Dart, GDScript and C# from the Client Protocol schema',
  },
  {
    name: 'Native implementations',
    description: `openiap-apple (StoreKit 2) and openiap-google (Play Billing ${GOOGLE_PLAY_BILLING.version}, Amazon Appstore, Meta Horizon)`,
  },
  {
    name: 'Conformance',
    description: (
      <>
        A versioned behavioral contract. Expo, React Native, Android, Apple and
        IAPKit each cover documented subsets; Flutter, KMP, MAUI and Godot do
        not have adapters yet. See{' '}
        <Link to="/docs/security/compliance#conformance">
          behavioral conformance
        </Link>
        .
      </>
    ),
  },
];

interface Sdk {
  ecosystem: string;
  name: string;
  url: string;
}

const SDKS: Sdk[] = [
  ...LIBRARIES.map((library) => ({
    ecosystem: library.frameworkName,
    name: library.displayName,
    url: library.url,
  })),
  {
    ecosystem: 'Native iOS and macOS',
    name: 'openiap-apple (StoreKit 2)',
    url: 'https://github.com/hyodotdev/openiap/tree/main/packages/apple',
  },
  {
    ecosystem: 'Native Android',
    name: 'openiap-google (Play Billing, Amazon Appstore, Meta Horizon)',
    url: 'https://github.com/hyodotdev/openiap/tree/main/packages/google',
  },
];

function StoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function OnePager() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="About OpenIAP"
        description="OpenIAP — a neutral interoperability layer for in-app purchase APIs and verification across all platforms and frameworks."
        path="/docs/foundation/about"
        keywords="OpenIAP, in-app purchase standard, cross-platform IAP, purchase verification, open source"
      />
      <h1>
        OpenIAP: Neutral Interoperability Layer for In-App Purchase APIs and
        Verification
      </h1>

      <section>
        <AnchorLink id="problem" level="h2">
          The Problem
        </AnchorLink>
        <p>
          Every framework — React Native, Expo, Flutter, Kotlin Multiplatform,
          .NET MAUI, Godot, native iOS and Android — implements in-app purchases
          on its own: its own types, error model, verification flow and edge
          cases.
        </p>
        <p>
          And the stores keep multiplying.{' '}
          <StoreLink href="https://developer.meta.com/horizon/">
            Meta Horizon OS
          </StoreLink>
          ,{' '}
          <StoreLink href="https://developer.amazon.com/apps-and-games/vega">
            Vega OS
          </StoreLink>
          ,{' '}
          <StoreLink href="https://consumer.huawei.com/en/harmonyos/">
            HarmonyOS
          </StoreLink>{' '}
          and{' '}
          <StoreLink href="https://developer.amazon.com/apps-and-games">
            Amazon Fire OS
          </StoreLink>{' '}
          each have their own billing API, as do{' '}
          <StoreLink href="https://galaxystore.samsung.com/">
            Galaxy Store
          </StoreLink>
          ,{' '}
          <StoreLink href="https://consumer.huawei.com/en/mobileservices/appgallery/">
            Huawei AppGallery
          </StoreLink>{' '}
          and alternative marketplaces such as{' '}
          <StoreLink href="https://onside.io/">Onside</StoreLink>, while{' '}
          <StoreLink href="https://play.google.com/console">
            Google Play
          </StoreLink>{' '}
          and the{' '}
          <StoreLink href="https://developer.apple.com/app-store/">
            App Store
          </StoreLink>{' '}
          change theirs with every major release. The result:
        </p>
        <ul>
          <li>
            <strong>Duplicated effort</strong> across ecosystems, with each SDK
            maintaining its own interpretation of store APIs
          </li>
          <li>
            <strong>Inconsistent behavior</strong> causing revenue leakage,
            failed transactions, and poor user experiences
          </li>
          <li>
            <strong>Security gaps</strong> where receipt validation and fraud
            prevention are left as afterthoughts
          </li>
          <li>
            <strong>High maintenance burden</strong> as Apple, Google, and an
            expanding set of stores frequently change their billing APIs
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="what-is-openiap" level="h2">
          What OpenIAP Is
        </AnchorLink>
        <p>
          OpenIAP is an open standard for in-app purchases: two specifications,
          and the SDKs and tests that hold implementations to them.
        </p>
        <ul>
          {Object.values(OPENIAP_PROTOCOLS).map((protocol) => (
            <li key={protocol.name}>
              <strong>
                <Link to={protocol.to}>{protocol.name}</Link>
              </strong>{' '}
              {protocol.version} — {protocol.blurb}
            </li>
          ))}
        </ul>

        <AnchorLink id="core-components" level="h3">
          Around the specifications
        </AnchorLink>
        <DataTable
          rows={COMPONENTS}
          rowKey={(row) => row.name}
          columns={[
            {
              header: 'Component',
              cell: (row) => <strong>{row.name}</strong>,
            },
            { header: 'Description', cell: (row) => row.description },
          ]}
        />
      </section>

      <section>
        <AnchorLink id="vendor-neutral" level="h2">
          What Neutral Means Here
        </AnchorLink>
        <ul>
          <li>Everything is open source: MIT, and Apache-2.0 for kmp-iap.</li>
          <li>
            Neither protocol routes a purchase through a service the project
            runs: an app, its backend and the store talk to each other directly.
          </li>
          <li>
            IAPKit, the maintainer&apos;s hosted verification service, is held
            to the same schema and conformance checks as any other
            implementation.
          </li>
        </ul>
        <p>
          <Link to="/docs/foundation/governance">Governance</Link> describes how
          decisions are made today and how that opens up as maintainers and
          sponsors join.
        </p>
      </section>

      <section>
        <AnchorLink id="who-uses-it" level="h2">
          Official SDKs
        </AnchorLink>
        <p>
          Apps built on them are listed in the{' '}
          <Link to="/showcase">showcase</Link>.
        </p>
        <DataTable
          rows={SDKS}
          rowKey={(row) => row.name}
          columns={[
            {
              header: 'Ecosystem',
              cell: (row) => <strong>{row.ecosystem}</strong>,
            },
            {
              header: 'SDK',
              cell: (row) => <StoreLink href={row.url}>{row.name}</StoreLink>,
            },
          ]}
        />

        <AnchorLink id="traction" level="h3">
          Adoption
        </AnchorLink>
        <ul>
          <li>
            <strong>Downloads</strong>: react-native-iap 14M+ and expo-iap 4M+
            on npm (September 2026)
          </li>
          <li>
            <strong>Sponsors</strong>:{' '}
            {CURRENT_SPONSORS.map(
              (sponsor) => `${sponsor.name} (${sponsor.tier})`
            ).join(', ')}
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="roadmap" level="h2">
          What We&apos;re Building Next
        </AnchorLink>
        <p>
          The roadmap, with each item&apos;s status, is on{' '}
          <Link to="/docs/foundation/roadmap-budget#roadmap">
            Roadmap &amp; Budget
          </Link>
          .
        </p>
      </section>

      <section>
        <AnchorLink id="why-now" level="h2">
          Why Now
        </AnchorLink>
        <ul>
          <li>
            <strong>Regulation</strong>: the EU Digital Markets Act and Epic v.
            Apple opened alternative payment paths that apps may now offer next
            to store billing.
          </li>
          <li>
            <strong>Platform API churn</strong>: Apple (StoreKit 2) and Google
            (Billing 8 and 9) have both made breaking changes in recent years.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="contact" level="h2">
          Contact
        </AnchorLink>
        <ul>
          <li>
            <strong>Project Lead</strong>: Hyo (
            <StoreLink href="https://hyo.dev">hyo.dev</StoreLink>) —{' '}
            <a href={FUNDING_LINKS.companyContactUrl}>
              contact the project lead
            </a>
          </li>
          <li>
            <strong>GitHub</strong>:{' '}
            <StoreLink href="https://github.com/hyodotdev/openiap">
              github.com/hyodotdev/openiap
            </StoreLink>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default OnePager;
