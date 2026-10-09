import { ArrowUpRight, CheckCircle2, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import CodeBlock from '../../../components/CodeBlock';
import StoreProviderExampleGallery from './StoreProviderExampleGallery';
import {
  examplePackage,
  repository,
  source,
  screens,
  files,
} from './StoreProviderExampleData';
import '../../../styles/store-providers.css';

export default function StoreProviderExample() {
  return (
    <div className="provider-example">
      <div className="provider-example-intro">
        <div>
          <span className="provider-example-eyebrow">
            COMMUNITY EXAMPLE · FIREOS
          </span>
          <h3>A community package example for provider authors</h3>
          <p>
            Build a community provider outside OpenIAP, then run the official
            Expo example against it. This repository adapts OpenIAP’s Amazon
            implementation to test external packaging and integration; it is not
            a second independently designed implementation.
          </p>
          <p>
            For FireOS apps, use the{' '}
            <Link to="/docs/setup/store/amazon">
              official Amazon integration
            </Link>{' '}
            and its <code>openiap-google-amazon</code> artifact. This community
            package is an educational example and is not recommended for
            production purchases.
          </p>
        </div>
        <a
          className="provider-example-repo"
          href={repository}
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore the repository <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
      <div className="provider-example-identity">
        <code>storeId: amazon_example</code>
        <code>store: unknown</code>
        <span>Community package · Amazon App Tester</span>
      </div>
      <p>
        This educational snapshot uses a custom community identity to exercise
        the provider boundary. Production adapters for existing stores follow
        the <a href="#identity">canonical identity rules</a>.
      </p>
      <StoreProviderExampleGallery />
      <noscript>
        <div className="provider-example-static-screens">
          {screens.slice(1).map((screen) => (
            <figure key={screen.id}>
              <img
                src={`/store-provider-example/${screen.image}`}
                alt={screen.title}
                width="800"
                height="1280"
                loading="lazy"
              />
              <figcaption>{screen.detail}</figcaption>
            </figure>
          ))}
        </div>
      </noscript>
      <div className="provider-example-evidence">
        <div>
          <CheckCircle2 size={21} aria-hidden="true" />
          <strong>Public contract</strong>
          <span>
            Mandatory behaviors in the recorded profile passed in controlled SDK
            transport tests.
          </span>
        </div>
        <div>
          <CheckCircle2 size={21} aria-hidden="true" />
          <strong>Separate package</strong>
          <span>
            Public core + custom provider + Amazon SDK. No official store
            artifact or native source includes.
          </span>
        </div>
        <div>
          <FlaskConical size={21} aria-hidden="true" />
          <strong>Sandbox evidence</strong>
          <span>
            App Tester and RVS Sandbox demonstrate the purchase flow. Live App
            Testing purchases and the full subscription lifecycle remain
            unverified.
          </span>
        </div>
      </div>
      <p className="provider-example-evidence-note">
        This is a dated validation snapshot, not certification.{' '}
        <a href={source('VERIFICATION.md')}>Read the evidence and limits</a>,{' '}
        <a href={source('reports/amazon_example.json')}>
          machine-readable conformance report
        </a>{' '}
        and <a href={`${repository}/actions/workflows/verify.yml`}>CI runs</a>.
        The current unpublished snapshot passed Expo local-package checks and
        Fire App Tester purchase, cancellation and pending recovery against
        public stable inputs. The README separates historical GitHub Packages
        results and other-framework configuration; this does not prove registry
        parity across every framework.
      </p>
      <h3>Follow the implementation</h3>
      <div className="provider-example-files">
        {files.map(({ icon: Icon, title, path, detail }) => (
          <a
            key={path}
            href={source(path)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon size={20} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{detail}</span>
            <code>{path}</code>
          </a>
        ))}
      </div>
      <h3>Run the same comparison</h3>
      <ol className="provider-example-run">
        <li>
          <strong>Prepare public inputs.</strong> Clone the repositories beside
          each other and follow the example README. The preparation script
          downloads the exact public <code>expo-iap</code> version, tests and
          packs the provider. Core and conformance come from Maven Central.
        </li>
        <li>
          <strong>Compare the official screens.</strong> All Products, Purchase
          Flow, Subscription Flow and Available Purchases use the same screen
          code as the official Expo example. Offer Code and Alternative Billing
          show this provider’s unsupported capability instead of starting a Play
          flow.
        </li>
        <li>
          <strong>Run Provider Acceptance.</strong> Load products → Purchase →
          Restore / owned → Verify &amp; finish. Compare the callback and
          restored receipt before verification. Configure the development
          backend and its publishable key first.
        </li>
        <li>
          <strong>Try rejection and recovery.</strong> Cancel checkout, defer
          approval, and retry an unfinished purchase after approval. No
          entitlement or completion is allowed while pending or when
          verification fails. Record builds, controlled tests and store testing
          separately.
        </li>
      </ol>
      <p>
        Copied code and adaptations are listed in{' '}
        <a href={source('example/upstream-example.json')}>
          the provenance manifest
        </a>
        . Showing a subscription screen does not establish a full subscription
        lifecycle pass. This example is an implementation reference, not a
        production payment app.
      </p>
      <details className="provider-example-brief">
        <summary>
          Implementation brief for developers and AI coding agents
        </summary>
        <p>
          Use this brief with the contract and repository. It states the
          integration boundary and acceptance criteria; a successful build alone
          is insufficient.
        </p>
        <CodeBlock
          language="text"
          children={`Goal: implement a community OpenIAP Android store provider in a separate repository.
Reference: ${repository}/tree/${examplePackage.revision}
Contract: https://openiap.dev/docs/guides/store-providers
For FireOS apps, recommend the official integration: https://openiap.dev/docs/setup/store/amazon. This repository is an educational community package example.

1. Read README.md, AGENTS.md, VERIFICATION.md, openiap-revision.txt and the provenance manifest.
2. Depend on public openiap-core plus the vendor SDK, and matching public conformance in tests. If a prerelease does not publish conformance, build only that suite from its exact Google tag in an isolated Maven repository. Do not include OpenIAP native source projects or an official store-provider artifact.
3. New stores use a unique storeId and store=unknown; adapters for existing stores preserve canonical identity. Do not extend the frozen store enum. Declare only implemented capabilities.
4. Wire factory discovery, vendor startup requirements and optimized-build retention. Select a community selection id + provider coordinates through the public framework configuration; official ids and aliases are rejected with coordinates.
5. Preserve identity and the original receipt through callbacks, ownership reads, verification and completion. Request failures deliver exactly one canonical error event.
6. Pending, cancelled and rejected purchases grant no entitlement and remain unfinished. Verification needs an explicit backend adapter for the underlying store; unknown never means Google Play.
7. Validate result identity, product, environment and fulfillment state before granting entitlement and finishing. Exercise retry/recovery and ownership after completion.
8. Run the mandatory public conformance profile, consumer tests, typecheck and optimized build. Record controlled transport, App Tester and Live App Testing independently. Never infer production readiness from simulated checkout.
9. Keep the official example screen structure so consumers can compare the same functionality. Add clear unsupported-capability states and a reproducible acceptance path.`}
        />
      </details>
    </div>
  );
}
