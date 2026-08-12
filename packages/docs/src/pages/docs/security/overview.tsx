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
      'Exactly which third-party components this version contains, with versions, package URLs, suppliers, and licenses',
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
    name: 'Immutable release tag',
    answers:
      'Which source commit produced the release, verified at publish time',
  },
];

interface Trigger {
  when: string;
  what: string;
}

const AUTOMATION: Trigger[] = [
  {
    when: 'Every pull request',
    what: "The SBOM generator's own tests run. They read the real dependency manifests in the repository, so if a build file changes shape and the inventory would go stale, CI fails there rather than at release time",
  },
  {
    when: 'Merge to main',
    what: 'Same checks, plus release-state audits that keep versions and tags consistent',
  },
  {
    when: 'A release is published',
    what: 'The SBOM workflow identifies which component the tag belongs to, generates its SBOM at that exact commit, resolves licenses and suppliers, verifies the version/tag/commit all agree, signs a provenance attestation, and attaches the file to the release',
  },
  {
    when: 'Weekly',
    what: "Dependabot opens update pull requests for IAPKit's dependencies, the GitHub Actions used in workflows, and the IAPKit container image. OpenSSF Scorecard re-checks the repository's own security posture",
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
      'are the dependencies we use current and free of known vulnerabilities?',
  },
  {
    name: 'SBOM',
    question: 'what exactly did each published version contain?',
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
        description="How OpenIAP secures what it ships — per-release SBOMs, build provenance, release integrity, and vulnerability reporting."
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
          What every release publishes
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
          The published JavaScript SDKs declare{' '}
          <strong>no runtime dependencies</strong>. Installing{' '}
          <code>react-native-iap</code>, <code>expo-iap</code>, or{' '}
          <code>openiap-conformance</code> adds no third-party runtime code to
          your app. React, React Native, and Expo are peer dependencies your
          application already owns and versions.
        </p>
        <p>
          The Apple SDK has no external package dependencies either — it builds
          on StoreKit, which ships with the OS. The native Android, Kotlin
          Multiplatform, .NET MAUI, and Flutter SDKs do depend on platform
          libraries (Play Billing, AndroidX, Kotlin coroutines, and so on);
          those are enumerated in each release&apos;s SBOM.
        </p>
        <Callout kind="tip" title="Why this matters for your review">
          A dependency that does not exist cannot be vulnerable. For the
          JavaScript SDKs, the honest answer to &quot;what is OpenIAP&apos;s
          transitive dependency risk?&quot; is: none at runtime — and the SBOM
          is the evidence, not the claim.
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
          hours, and a final assessment within 14 days — the windows the EU
          Cyber Resilience Act sets for reporting.
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
          All of it is automated. Nothing in this section requires a maintainer
          to remember a step.
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
          release tag is the only moment an inventory is meaningful, and it
          means the existing release workflows did not have to change — a new
          SDK added later is covered by the same path automatically.
        </p>
      </section>

      <section>
        <AnchorLink id="monitoring" level="h2">
          How dependencies are monitored
        </AnchorLink>
        <p>
          Dependabot watches IAPKit&apos;s dependency tree, the GitHub Actions
          used in release workflows, and the IAPKit container image. The
          published SDKs have no runtime dependency tree to watch.
        </p>
        <p>
          Native SDK platform dependencies are pinned deliberately — several
          carry inline notes explaining why a newer version is not yet
          compatible with the supported toolchain range. They are reviewed as
          part of platform upgrade work rather than bumped automatically, and
          each release&apos;s SBOM records exactly what shipped.
        </p>
        <Callout kind="warning" title="Why the SBOM is not redundant here">
          GitHub&apos;s dependency graph does not parse this repository&apos;s
          lockfiles — Bun lockfiles are not a supported format, and Gradle
          builds are not resolved from source. Its generated inventory for this
          repository is empty. Dependabot&apos;s version updates still work,
          because they read manifests directly, but the platform cannot derive a
          component inventory on its own. The SBOMs published here are that
          inventory.
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
