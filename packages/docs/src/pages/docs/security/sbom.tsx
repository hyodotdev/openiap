import type { ReactNode } from 'react';
import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import DataTable from '../../../components/DataTable';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

interface Standard {
  concern: string;
  standard: ReactNode;
}

const STANDARDS: Standard[] = [
  {
    concern: 'Document format',
    standard: (
      <ExternalLink href="https://cyclonedx.org/specification/overview/">
        CycloneDX 1.6
      </ExternalLink>
    ),
  },
  {
    concern: 'Component identity',
    standard: (
      <ExternalLink href="https://github.com/package-url/purl-spec">
        Package URL (purl)
      </ExternalLink>
    ),
  },
  {
    concern: 'License identity',
    standard: (
      <ExternalLink href="https://spdx.org/licenses/">
        SPDX identifiers
      </ExternalLink>
    ),
  },
  {
    concern: 'Required data fields',
    standard: (
      <ExternalLink href="https://www.ntia.gov/report/2021/minimum-elements-software-bill-materials-sbom">
        NTIA minimum elements
      </ExternalLink>
    ),
  },
  {
    concern: 'Vulnerability analysis',
    standard: (
      <ExternalLink href="https://cyclonedx.org/capabilities/vex/">
        CycloneDX VEX
      </ExternalLink>
    ),
  },
  {
    concern: 'Provenance',
    standard: (
      <>
        <ExternalLink href="https://slsa.dev/provenance/v1">SLSA</ExternalLink>{' '}
        in <ExternalLink href="https://in-toto.io/">in-toto</ExternalLink>{' '}
        statements, signed via{' '}
        <ExternalLink href="https://www.sigstore.dev/">Sigstore</ExternalLink>
      </>
    ),
  },
];

interface VerifyTool {
  href: string;
  name: string;
  role: string;
  license: string;
}

const VERIFY_TOOLS: VerifyTool[] = [
  {
    href: 'https://cli.github.com/manual/gh_attestation_verify',
    name: 'gh attestation verify',
    role: 'Confirm CI provenance against Sigstore',
    license: 'MIT',
  },
  {
    href: 'https://github.com/CycloneDX/cyclonedx-cli',
    name: 'cyclonedx-cli',
    role: 'Validate against the published schema',
    license: 'Apache-2.0',
  },
  {
    href: 'https://github.com/interlynk-io/sbomqs',
    name: 'sbomqs',
    role: 'Score quality and NTIA compliance',
    license: 'Apache-2.0',
  },
  {
    href: 'https://github.com/google/osv-scanner',
    name: 'osv-scanner',
    role: 'Match components against the OSV database',
    license: 'Apache-2.0',
  },
  {
    href: 'https://github.com/anchore/grype',
    name: 'grype',
    role: 'Match components against vulnerability feeds',
    license: 'Apache-2.0',
  },
];

interface Limit {
  title: string;
  detail: string;
}

const LIMITS: Limit[] = [
  {
    title: 'Transitive dependencies',
    detail:
      "are included only where the ecosystem's resolver output is available. Release SBOMs otherwise describe the documented direct-dependency source.",
  },
  {
    title: 'Licenses and suppliers',
    detail:
      'combine reviewed local metadata with point-in-time registry enrichment. Unavailable metadata is omitted, and pub.dev and some NuGet packages do not expose a standard value.',
  },
  {
    title: 'Version constraints',
    detail:
      'remain constraints when a library manifest does not select one exact version. Use the consuming application lockfile for exact CVE matching.',
  },
  {
    title: 'KMP target scope',
    detail:
      'uses the published canonical/common KMP POM plus exact Apple, Play, Horizon, and Amazon contracts. A single-platform application should use its resolved target graph.',
  },
  {
    title: 'MAUI target scope',
    detail:
      "is the union of the published nuspec's target-framework groups. Grouped dependencies remain optional and platform-labelled; use the consuming application's resolved graph to narrow the aggregate.",
  },
];

function SecuritySbom() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="SBOM"
        description="OpenIAP release workflows publish CycloneDX SBOM assets — how to download, verify, and reproduce their core inventory."
        path="/docs/security/sbom"
        keywords="OpenIAP SBOM, CycloneDX, software bill of materials, purl, attestation, dependency inventory, NTIA minimum elements"
      />
      <h1>Software Bill of Materials</h1>
      <p>
        Current OpenIAP release workflows attach a machine-readable inventory of
        direct runtime components and dependency contracts, including
        first-party OpenIAP native contracts, to each GitHub Release as a{' '}
        <strong>CycloneDX 1.6 JSON</strong> file. A daily repair job fills
        missed latest-stable-release assets; prereleases rely on their
        release-time dispatch. Exact application exposure comes from the
        consumer&apos;s resolved dependency graph.
      </p>

      <section>
        <AnchorLink id="finding" level="h2">
          Finding one
        </AnchorLink>
        <p>
          SBOMs are release assets, named after the package and version they
          describe:
        </p>
        <pre>
          <code>{`<package>-<version>.cdx.json

react-native-iap-16.3.0.cdx.json
openiap-google-3.3.0.cdx.json
flutter_inapp_purchase-10.3.0.cdx.json`}</code>
        </pre>
        <p>Download one from its release:</p>
        <pre>
          <code>{`gh release download react-native-iap-16.3.0 \\
  --repo hyodotdev/openiap -p '*.cdx.json'`}</code>
        </pre>
        <p>
          One SBOM is published per releasable component — the SDKs, the native
          packages, and the specification — rather than one for the whole
          monorepo, because a repository-wide document would describe something
          nobody installs.
        </p>
      </section>

      <section>
        <AnchorLink id="verifying" level="h2">
          Verifying it
        </AnchorLink>
        <p>
          The SBOM carries a build provenance attestation, so you can confirm
          OpenIAP&apos;s CI produced it rather than trusting the file on sight:
        </p>
        <pre>
          <code>{`CERT_IDENTITY=https://github.com/hyodotdev/openiap
CERT_IDENTITY="$CERT_IDENTITY/.github/workflows/sbom.yml@refs/heads/main"
gh attestation verify react-native-iap-16.3.0.cdx.json \\
  --repo hyodotdev/openiap --cert-identity "$CERT_IDENTITY" \\
  --deny-self-hosted-runners`}</code>
        </pre>
        <p>And validate it against the CycloneDX schema:</p>
        <pre>
          <code>{`cyclonedx validate --input-file react-native-iap-16.3.0.cdx.json \\
  --input-format json --input-version v1_6 --fail-on-errors`}</code>
        </pre>
        <p>
          Every tool below is independent of this repository, so verification
          never requires trusting our tooling:
        </p>
        <DataTable
          rows={VERIFY_TOOLS}
          rowKey={(row) => row.name}
          columns={[
            {
              header: 'Tool',
              cell: (row) => (
                <ExternalLink href={row.href}>
                  <code>{row.name}</code>
                </ExternalLink>
              ),
            },
            { header: 'Role', cell: (row) => row.role },
            { header: 'License', cell: (row) => row.license },
          ]}
        />
        <Callout kind="tip" title="Reproducible core inventory">
          The SBOM records both the release commit and the exact generator
          commit, so you can reproduce its dependency inventory. Reviewed local
          metadata remains stable; registry-enriched licenses and suppliers may
          differ on a later run.
        </Callout>
      </section>

      <section>
        <AnchorLink id="contents" level="h2">
          What is inside
        </AnchorLink>
        <p>Each document records:</p>
        <ul>
          <li>
            The component&apos;s name, version, and{' '}
            <strong>package URL (purl)</strong>, matching the published package
          </li>
          <li>
            The repository URL and the exact commit the release was built from
          </li>
          <li>The exact generator commit used to create the SBOM</li>
          <li>
            The release tag, so an artifact and its inventory cannot be
            mismatched
          </li>
          <li>
            Every direct runtime dependency, with version or constraint, purl,
            and available supplier and license data
          </li>
        </ul>
        <p>
          Deliberately excluded: test and build-only dependencies. Peer
          dependencies from JavaScript manifests are not counted as bundled npm
          runtime code, while native CocoaPods and Maven contracts shipped
          through framework SDKs are listed separately. Operating-system
          frameworks such as StoreKit are not distributed packages and are
          likewise absent.
        </p>
        <Callout kind="note" title="Empty is a real answer">
          <code>openiap-conformance</code> has no runtime components. The React
          Native and Expo npm manifests also have no npm runtime dependencies,
          but their aggregate release SBOMs include the native contracts they
          install. An empty inventory is valid only when the complete released
          artifact has no such dependency layer.
        </Callout>
      </section>

      <section>
        <AnchorLink id="vex" level="h2">
          Vulnerability analysis (VEX)
        </AnchorLink>
        <p>
          When a scanner flags a CVE against a dependency, the useful question
          is whether it is reachable through OpenIAP&apos;s use of that
          dependency. Where that has been analysed, the judgement travels in the
          same SBOM as a CycloneDX <code>vulnerabilities</code> entry, with a
          state such as <code>not_affected</code> and a required justification.
        </p>
        <p>
          If a release&apos;s SBOM has no <code>vulnerabilities</code> section,
          it means no CVE has been analysed for that release — not that a scan
          was run and came back clean.
        </p>
      </section>

      <section>
        <AnchorLink id="standards" level="h2">
          Standards and tooling
        </AnchorLink>
        <p>
          Everything here is an open standard, most of it maintained under the
          Linux Foundation or OWASP.
        </p>
        <DataTable
          rows={STANDARDS}
          rowKey={(row) => row.concern}
          columns={[
            { header: 'Concern', cell: (row) => row.concern },
            { header: 'Standard', cell: (row) => row.standard },
          ]}
        />
        <Callout kind="note" title="The generator keeps dependencies minimal">
          <code>scripts/generate-sbom.mjs</code> uses only the Node.js standard
          library — no npm package, vendored code, or runtime library — and the
          Git executable already required by the checkout. It reads published
          POM and nuspec dependency descriptors, combines reviewed local
          metadata with registry enrichment, and does not add a package
          dependency tree of its own.
        </Callout>
      </section>

      <section>
        <AnchorLink id="limits" level="h2">
          Current limits
        </AnchorLink>
        <p>Stated plainly, so you can judge the evidence:</p>
        <ul>
          {LIMITS.map((limit) => (
            <li key={limit.title}>
              <strong>{limit.title}</strong> {limit.detail}
            </li>
          ))}
        </ul>
        <p>
          Where a dependency cannot be resolved, generation fails rather than
          emitting a shorter list — an inventory that silently omits something
          is worse than none, because it is trusted.
        </p>
      </section>
    </div>
  );
}

export default SecuritySbom;
