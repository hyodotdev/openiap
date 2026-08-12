import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

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
        <table>
          <thead>
            <tr>
              <th>Artifact</th>
              <th>What it answers</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>CycloneDX SBOM</strong>
              </td>
              <td>
                Exactly which third-party components this version contains, with
                versions, package URLs, and licenses
              </td>
            </tr>
            <tr>
              <td>
                <strong>Provenance attestation</strong>
              </td>
              <td>
                Cryptographic proof that the SBOM was produced by OpenIAP&apos;s
                CI from a specific commit, not written by hand
              </td>
            </tr>
            <tr>
              <td>
                <strong>npm provenance</strong>
              </td>
              <td>
                For npm packages, that the published tarball was built from this
                repository
              </td>
            </tr>
            <tr>
              <td>
                <strong>Immutable release tag</strong>
              </td>
              <td>
                Which source commit produced the release, verified at publish
                time
              </td>
            </tr>
          </tbody>
        </table>
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
        <table>
          <thead>
            <tr>
              <th>Trigger</th>
              <th>What happens automatically</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Every pull request</strong>
              </td>
              <td>
                The SBOM generator&apos;s own tests run. They read the real
                dependency manifests in the repository, so if a build file
                changes shape and the inventory would go stale, CI fails there
                rather than at release time
              </td>
            </tr>
            <tr>
              <td>
                <strong>Merge to main</strong>
              </td>
              <td>
                Same checks, plus release-state audits that keep versions and
                tags consistent
              </td>
            </tr>
            <tr>
              <td>
                <strong>A release is published</strong>
              </td>
              <td>
                The SBOM workflow identifies which component the tag belongs to,
                generates its SBOM at that exact commit, resolves licenses,
                verifies the version/tag/commit all agree, signs a provenance
                attestation, and attaches the file to the release
              </td>
            </tr>
            <tr>
              <td>
                <strong>Weekly</strong>
              </td>
              <td>
                Dependabot opens update pull requests for IAPKit&apos;s
                dependencies, the GitHub Actions used in workflows, and the
                IAPKit container image. OpenSSF Scorecard re-checks the
                repository&apos;s own security posture
              </td>
            </tr>
            <tr>
              <td>
                <strong>A vulnerability is reported</strong>
              </td>
              <td>
                The response path above — accelerated if it is being actively
                exploited
              </td>
            </tr>
          </tbody>
        </table>
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
          <li>
            <strong>Dependabot</strong> — are the dependencies we use current
            and free of known vulnerabilities?
          </li>
          <li>
            <strong>SBOM</strong> — what exactly did each published version
            contain?
          </li>
          <li>
            <strong>OpenSSF Scorecard</strong> — is the process that produced it
            sound? It checks branch protection, workflow token permissions,
            action pinning, and dangerous workflow patterns, and publishes a
            score anyone can verify
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="more" level="h2">
          Further reading
        </AnchorLink>
        <ul>
          <li>
            <a href="/docs/security/sbom">SBOM</a> — download, verify, and
            reproduce a release inventory
          </li>
          <li>
            <a href="/docs/security/compliance">Compliance</a> — CRA readiness,
            OpenChain self-assessment, and the behavioral conformance suite
          </li>
          <li>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/security"
              target="_blank"
              rel="noopener noreferrer"
            >
              security/
            </a>{' '}
            — the maintainer-facing policy documents
          </li>
        </ul>
      </section>
    </div>
  );
}

export default SecurityOverview;
