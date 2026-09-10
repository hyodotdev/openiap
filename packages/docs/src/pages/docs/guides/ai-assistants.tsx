import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

const REFERENCES = [
  {
    id: 'quick-reference',
    name: 'OpenIAP quick reference',
    url: 'https://openiap.dev/llms.txt',
    description:
      'SDK installation, purchase APIs, types, and links to the implementation guides.',
  },
  {
    id: 'full-reference',
    name: 'OpenIAP full reference',
    url: 'https://openiap.dev/llms-full.txt',
    description:
      'Detailed API behavior and the normative Commerce Protocol specification.',
  },
  {
    id: 'iapkit-reference',
    name: 'IAPKit reference',
    url: 'https://kit.openiap.dev/llms.txt',
    description:
      'Hosted API configuration and product-specific behavior when you choose IAPKit.',
  },
] as const;

export default function AIAssistants() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Build In-App Purchases with AI"
        description="Choose the OpenIAP SDK for your app, give your coding assistant the matching references, and verify purchases, restore, and access before shipping."
        path="/docs/guides/ai-assistants"
      />
      <h1>Build in-app purchases with AI</h1>
      <p>
        You choose what to sell and who should get access. Your coding assistant
        installs the SDK, connects the purchase flow, and runs the checks. Start
        with your app, then inspect the result together.
      </p>

      <section>
        <AnchorLink id="start-in-your-project" level="h2">
          Start in your project
        </AnchorLink>
        <p>
          Building an app, paywall, commerce service, or data product? The
          OpenIAP CLI prepares an implementation brief for your role. Give it to
          your coding assistant alongside the customer outcome you want. Your
          existing stack and service choices stay yours.
        </p>
        <p>
          A usable CLI release is still pending on npm. From an OpenIAP
          checkout, run:
        </p>
        <CodeBlock language="bash">
          {'node packages/cli/bin/openiap.mjs init /path/to/your/product'}
        </CodeBlock>
        <p>
          The command reads local files and prints a brief. Your assistant
          implements it when you paste the brief into your project. See the{' '}
          <a href="https://github.com/hyodotdev/openiap/tree/main/packages/cli">
            CLI guide
          </a>{' '}
          for scripted use, or{' '}
          <Link to="/commerce-protocol/ecosystem">
            choose your product’s role
          </Link>{' '}
          directly in the docs. Continue below for an app integration.
        </p>
      </section>

      <section>
        <AnchorLink id="choose-sdk" level="h2">
          1. Choose the SDK for your app
        </AnchorLink>
        <p>
          Open the <Link to="/languages">SDK list</Link> and follow your
          framework’s <Link to="/docs/setup">setup guide</Link>. Give the AI
          that guide and access to your project. It should use the existing
          framework, package manager, and login system.
        </p>
        <p>
          Decide which stores you support, which products are subscriptions or
          one-time purchases, and what each product unlocks. The AI should
          explain any missing decision before building around an assumption.
        </p>
      </section>

      <section>
        <AnchorLink id="integration" level="h2">
          2. Connect purchase to access
        </AnchorLink>
        <p>
          Follow{' '}
          <Link to="/commerce-protocol/getting-started">
            one purchase from payment to access
          </Link>
          . Each step compares the runnable example with IAPKit and links to the
          corresponding code and checks. Your app owns login and fulfillment;
          the commerce backend verifies evidence and keeps purchase and access
          records for the capabilities it supports.
        </p>
        <p>
          For an existing product, give the AI the{' '}
          <a href="https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/main/INTEGRATE.md">
            integration brief
          </a>
          . To implement a backend, use the{' '}
          <Link to="/commerce-protocol/implementation">
            backend build guide
          </Link>
          . IAPKit is an available backend; OpenIAP SDKs do not require an
          IAPKit account.
        </p>
      </section>

      <section>
        <AnchorLink id="acceptance" level="h2">
          3. Check the result before shipping
        </AnchorLink>
        <p>
          Ask the AI to install and run from clean source, show the purchase
          flow, and provide the commands and actual test results. Then try these
          customer actions in your chosen store’s sandbox:
        </p>
        <ul>
          <li>Buy a product and receive the intended access.</li>
          <li>
            Cancel or leave a purchase pending; neither should create new
            access.
          </li>
          <li>
            Restore and repeat a purchase callback without granting the same
            benefit twice.
          </li>
          <li>
            For subscriptions, cancel renewal and retain access until the paid
            period expires.
          </li>
          <li>
            Sign in as another user and confirm the ownership policy is
            enforced.
          </li>
        </ul>
        <p>
          Use the <Link to="/docs/guides/testing">testing guide</Link> for store
          setup. The local Commerce Protocol example uses fictional purchases;
          its passing checks do not replace a device and store sandbox run.
        </p>
      </section>

      <section>
        <AnchorLink id="ai-optimized-documentation" level="h2">
          References for your coding assistant
        </AnchorLink>
        <p>
          Ask your assistant to read the relevant links. If it cannot fetch
          them, provide the contents directly. A URL in a prompt does not prove
          that its contents were loaded.
        </p>
        <ul id="documentation-contents">
          {REFERENCES.map((reference) => (
            <li key={reference.id} id={reference.id}>
              <a href={reference.url}>{reference.name}</a> —{' '}
              {reference.description}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
