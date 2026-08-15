import type { ReactNode } from 'react';
import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import DataTable from '../../../components/DataTable';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

interface Artifact {
  name: string;
  answers: string;
}

const RELEASE_ARTIFACTS: Artifact[] = [
  {
    name: 'CycloneDX SBOM',
    answers:
      'Which direct runtime components and dependency contracts this version declares, including first-party OpenIAP native contracts, with versions or constraints, package URLs, suppliers, and licenses where available',
  },
  {
    name: 'Provenance attestation',
    answers:
      "Cryptographic proof that the SBOM was produced by OpenIAP's CI from a specific commit, not written by hand",
  },
  {
    name: 'npm provenance',
    answers:
      'For npm packages, that the published tarball was built from this repository',
  },
  {
    name: 'Release tag and commit',
    answers:
      'Which full source commit the release tag points to, verified at publication and again during later checks',
  },
];

interface Trigger {
  when: string;
  what: string;
}

const AUTOMATION: Trigger[] = [
  {
    when: 'Every pull request',
    what: 'The SBOM parser and workflow fault tests run alongside release-state audits, so an unsupported dependency shape or an undispatched release lane fails before merge',
  },
  {
    when: 'Merge to main',
    what: 'A change to the SBOM workflow or generator scans the newest stable release of every component and dispatches any missing inventory',
  },
  {
    when: 'A release is published',
    what: 'The release workflow dispatches SBOM generation for its tag. The SBOM job verifies the identity, attests the inventory, attaches it, then downloads and verifies the published asset again',
  },
  {
    when: 'Daily',
    what: 'The missing-SBOM safety net runs. Dependabot and OpenSSF Scorecard also re-check the dependency and repository posture on their schedules',
  },
  {
    when: 'A vulnerability is reported',
    what: 'The response path above — accelerated if it is being actively exploited',
  },
];

interface Layer {
  name: string;
  question: ReactNode;
}

const POSTURE_LAYERS: Layer[] = [
  {
    name: 'Dependabot',
    question:
      'which dependencies does GitHub report as outdated or vulnerable in the monitored and submitted graphs?',
  },
  {
    name: 'SBOM',
    question: 'what dependency contract did each published version declare?',
  },
  {
    name: 'OpenSSF Scorecard',
    question:
      'is the process that produced it sound? It checks branch protection, workflow token permissions, action pinning, and dangerous workflow patterns, and publishes a score anyone can verify',
  },
];

interface FurtherReading {
  href: string;
  label: string;
  note: string;
  external?: boolean;
}

const FURTHER_READING: FurtherReading[] = [
  {
    href: '/docs/security/sbom',
    label: 'SBOM',
    note: 'download, verify, and reproduce a release inventory',
  },
  {
    href: '/docs/security/compliance',
    label: 'Compliance',
    note: 'CRA readiness, OpenChain self-assessment, and the behavioral conformance suite',
  },
  {
    href: 'https://github.com/hyodotdev/openiap/tree/main/security',
    label: 'security/',
    note: 'the maintainer-facing policy documents',
    external: true,
  },
];

function SecurityOverview() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Supply Chain Security"
        description="How OpenIAP secures what it ships — current-release SBOMs, build provenance, release integrity, and vulnerability reporting."
        path="/docs/security/overview"
        keywords="OpenIAP security, SBOM, supply chain security, provenance, attestation, vulnerability disclosure"
      />
      <h1>Supply Chain Security</h1>
      <p>
        If you ship an app built on OpenIAP, its dependencies become part of
        your product. This section covers what OpenIAP publishes so you can
        answer questions about that — for a security review, a customer
        questionnaire, or a regulator.
      </p>

      <section>
        <AnchorLink id="what-you-get" level="h2">
          What current release workflows publish
        </AnchorLink>
        <DataTable
          rows={RELEASE_ARTIFACTS}
          rowKey={(row) => row.name}
          columns={[
            { header: 'Artifact', cell: (row) => <strong>{row.name}</strong> },
            { header: 'What it answers', cell: (row) => row.answers },
          ]}
        />
        <p>
          See <a href="/docs/security/sbom">SBOM</a> for how to download and
          verify one.
        </p>
      </section>

      <section>
        <AnchorLink id="dependency-posture" level="h2">
          Dependency posture
        </AnchorLink>
        <p>
          The published JavaScript package manifests declare{' '}
          <strong>no npm runtime dependencies</strong>. React, React Native, and
          Expo are peer dependencies your application owns and versions. The
          Expo and React Native release SBOMs separately include the native
          CocoaPods and Maven contracts resolved by those packages;
          <code>openiap-conformance</code> has no such native layer.
        </p>
        <p>
          The Apple SDK has no external package dependencies either — it builds
          on StoreKit, which ships with the OS. The native Android, Kotlin
          Multiplatform, .NET MAUI, and Flutter SDKs do depend on platform
          libraries (Play Billing, AndroidX, Kotlin coroutines, and so on);
          their release SBOMs enumerate the published direct dependency
          contracts.
        </p>
        <Callout kind="tip" title="Why this matters for your review">
          The npm manifests do not add an npm runtime dependency tree, while
          native framework contracts still need review. The aggregate release
          SBOM makes that boundary visible instead of treating package-manager
          metadata as the whole shipped artifact.
        </Callout>
      </section>

      <section>
        <AnchorLink id="reporting" level="h2">
          Reporting a vulnerability
        </AnchorLink>
        <p>
          Report privately — do not open a public issue. Email{' '}
          <a href="mailto:hyo@hyo.dev">hyo@hyo.dev</a> with the subject prefix{' '}
          <code>[SECURITY]</code>, or use GitHub&apos;s private vulnerability
          reporting on the repository.
        </p>
        <p>
          If the issue is <strong>being exploited in the wild</strong>, mark it{' '}
          <code>[SECURITY][ACTIVE]</code>. That triggers an accelerated path: an
          initial assessment within 24 hours, an updated assessment within 72
          hours, and a final assessment within 14 days after a fix or mitigation
          is available. This is OpenIAP&apos;s internal service level; legal
          reporting duties depend on the affected party&apos;s role and the
          event.
        </p>
        <p>
          Receipt validation, purchase verification, and entitlement handling
          are the highest-sensitivity areas. The full policy, including what
          does and does not count as a vulnerability, is in{' '}
          <a
            href="https://github.com/hyodotdev/openiap/blob/main/SECURITY.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            SECURITY.md
          </a>
          .
        </p>
      </section>

      <section>
        <AnchorLink id="process" level="h2">
          When each thing runs
        </AnchorLink>
        <p>
          The repeatable CI, release, inventory, and scheduled scan controls are
          automated. Vulnerability reports still require maintainer triage,
          remediation, and communication.
        </p>
        <DataTable
          rows={AUTOMATION}
          rowKey={(row) => row.when}
          columns={[
            { header: 'Trigger', cell: (row) => <strong>{row.when}</strong> },
            { header: 'What happens automatically', cell: (row) => row.what },
          ]}
        />
        <p>
          The important design choice: SBOMs are generated{' '}
          <strong>after a release is published</strong>, not on every commit. A
          release tag is the only moment an inventory is meaningful. Every
          release lane must dispatch the shared SBOM workflow, and CI checks
          that wiring.
        </p>
      </section>

      <section>
        <AnchorLink id="monitoring" level="h2">
          How dependencies are monitored
        </AnchorLink>
        <p>
          OpenIAP submits all six Bun lock graphs as exact dependency snapshots
          for repository vulnerability monitoring. React Native&apos;s Yarn
          graph remains covered by GitHub&apos;s native lockfile support and the
          independent OSV scan. Its CocoaPods toolchain has a committed Bundler
          lock, a pinned Ruby CI runtime, OSV coverage, and Dependabot updates.
          Other Dependabot version-update pull requests stay focused on IAPKit,
          GitHub Actions, and the IAPKit container image.
        </p>
        <p>
          Native SDK platform dependencies are pinned deliberately — several
          carry inline notes explaining why a newer version is not yet
          compatible with the supported toolchain range. They are reviewed as
          part of platform upgrade work rather than bumped automatically, and
          each published release&apos;s SBOM records its published direct
          dependency contract. A toolchain resolver export can add transitive
          entries when needed.
        </p>
        <Callout kind="warning" title="Why the SBOM is not redundant here">
          GitHub does not parse Bun lockfiles natively. OpenIAP submits their
          exact resolved graphs after validation, while release SBOMs remain the
          component-specific record of what a published version declares.
          Neither view replaces the other.
        </Callout>
      </section>

      <section>
        <AnchorLink id="repo-posture" level="h2">
          Repository posture
        </AnchorLink>
        <p>
          Three layers cover different things, and none substitutes for another:
        </p>
        <ul>
          {POSTURE_LAYERS.map((layer) => (
            <li key={layer.name}>
              <strong>{layer.name}</strong> — {layer.question}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <AnchorLink id="more" level="h2">
          Further reading
        </AnchorLink>
        <ul>
          {FURTHER_READING.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                {...(item.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {item.label}
              </a>{' '}
              — {item.note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default SecurityOverview;
