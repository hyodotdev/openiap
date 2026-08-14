import { ArrowRight, ArrowUpRight, Braces, Github } from 'lucide-react';
import { Link } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import LanguageTabs from '../components/LanguageTabs';
import SEO from '../components/SEO';
import { IAPKIT_LOGO_PATH, IAPKIT_URL, trackIapKitClick } from '../lib/config';
import { LIBRARIES, LIBRARY_IMAGES } from '../lib/images';

const FRICTION = [
  {
    title: 'APIs diverge',
    description: 'Methods, types, and events change with every store and SDK.',
  },
  {
    title: 'Fixes repeat',
    description:
      'Maintainers solve the same lifecycle and error cases in parallel.',
  },
  {
    title: 'Platforms drift',
    description:
      'StoreKit and Play Billing updates reach each framework differently.',
  },
] as const;

const PIPELINE = [
  {
    label: 'Source',
    title: 'GraphQL schema',
    detail: 'One contract',
  },
  {
    label: 'Generate',
    title: 'Native types',
    detail: 'Swift · Kotlin · TS · Dart · C# · GDScript',
  },
  {
    label: 'Implement',
    title: 'Store modules',
    detail: 'StoreKit 2 · Play Billing',
  },
  {
    label: 'Ship',
    title: 'Framework SDKs',
    detail: 'One API in every runtime',
  },
] as const;

const SURFACES = [
  {
    index: '01',
    label: 'Methods',
    detail: 'Start and complete the purchase lifecycle',
    links: [
      { label: 'initConnection()', to: '/docs/apis/init-connection' },
      { label: 'fetchProducts()', to: '/docs/apis/fetch-products' },
      { label: 'requestPurchase()', to: '/docs/apis/request-purchase' },
      { label: 'finishTransaction()', to: '/docs/apis/finish-transaction' },
    ],
  },
  {
    index: '02',
    label: 'Types',
    detail: 'Share one model without hiding native fields',
    links: [
      { label: 'Product', to: '/docs/types/product' },
      { label: 'Purchase', to: '/docs/types/purchase' },
      { label: 'ProductSubscription', to: '/docs/types/subscription-product' },
      { label: 'PurchaseError', to: '/docs/errors' },
    ],
  },
  {
    index: '03',
    label: 'Events',
    detail: 'React to state changes with predictable signals',
    links: [
      {
        label: 'purchaseUpdatedListener',
        to: '/docs/events/purchase-updated-listener',
      },
      {
        label: 'purchaseErrorListener',
        to: '/docs/events/purchase-error-listener',
      },
      {
        label: 'subscriptionBillingIssueListener',
        to: '/docs/events/subscription-billing-issue-listener',
      },
    ],
  },
] as const;

const PURCHASE_LOOP = [
  {
    label: 'Connect',
    code: 'initConnection()',
    to: '/docs/apis/init-connection',
  },
  {
    label: 'Listen',
    code: 'purchaseUpdatedListener',
    to: '/docs/events/purchase-updated-listener',
  },
  { label: 'Fetch', code: 'fetchProducts()', to: '/docs/apis/fetch-products' },
  {
    label: 'Purchase',
    code: 'requestPurchase()',
    to: '/docs/apis/request-purchase',
  },
  {
    label: 'Validate',
    code: 'verifyPurchaseWithProvider()',
    to: '/docs/features/validation#verify-purchase-with-provider',
  },
  {
    label: 'Finish',
    code: 'finishTransaction()',
    to: '/docs/apis/finish-transaction',
  },
] as const;

const STORE_TARGETS = [
  {
    store: 'Apple',
    api: 'StoreKit 2',
    targets: 'iOS 15+ · macOS 12+ · visionOS 1+',
    to: '/docs/ios-setup',
  },
  {
    store: 'Google Play',
    api: 'Billing 9.1',
    targets: 'Android API 21+',
    to: '/docs/android-setup',
  },
  {
    store: 'Meta Horizon',
    api: 'Horizon billing',
    targets: 'Meta Quest 2+',
    to: '/docs/setup/store/horizon',
  },
  {
    store: 'Amazon',
    api: 'Appstore + Vega',
    targets: 'Fire OS · Vega OS',
    to: '/docs/setup/store/amazon',
  },
] as const;

function Introduction() {
  return (
    <div className="in-page">
      <SEO
        title="Why OpenIAP"
        description="OpenIAP is a unified specification for in-app purchases across iOS, Android, and XR platforms. One GraphQL schema generates type-safe code for Swift, Kotlin, TypeScript, Dart, C#, and GDScript."
        path="/introduction"
        keywords="OpenIAP, in-app purchase specification, StoreKit 2, Google Play Billing, cross-platform IAP, type-safe IAP, GraphQL schema"
        includeAppSchema
      />

      <header className="in-page-header">
        <div className="in-shell">
          <p className="in-kicker">Introduction</p>
          <div className="in-page-lead">
            <h1>Why OpenIAP</h1>
            <p>
              <strong>Stop translating purchases</strong>
              One generated, type-safe contract keeps every store and framework
              SDK aligned.
            </p>
          </div>
          <nav className="in-page-links" aria-label="Introduction links">
            <Link to="/languages">
              Choose your SDK
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link to="/docs/apis">
              Explore the API
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="in-shell in-main">
        <section className="in-section" aria-labelledby="rewrite-tax">
          <div className="in-section-heading">
            <div>
              <p>01 / The problem</p>
              <h2 id="rewrite-tax">The rewrite tax</h2>
            </div>
            <div
              className="in-equation"
              aria-label="Store APIs multiplied by frameworks creates repeated work"
            >
              <span>Store APIs</span>
              <strong>×</strong>
              <span>Frameworks</span>
              <strong>=</strong>
              <span>Repeated work</span>
            </div>
          </div>

          <ol className="in-friction-list">
            {FRICTION.map((item, index) => (
              <li key={item.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="in-section" aria-labelledby="schema-pipeline">
          <div className="in-section-heading">
            <div>
              <p>02 / The contract</p>
              <h2 id="schema-pipeline">One source, many targets</h2>
            </div>
            <p>
              Change the contract once. Generate the same shape for every
              language, then implement it against the native stores.
            </p>
          </div>

          <ol className="in-pipeline">
            {PIPELINE.map((item, index) => (
              <li key={item.title}>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
                {index < PIPELINE.length - 1 && (
                  <ArrowRight size={16} aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>

          <div className="in-native-core">
            <p>Native core</p>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={LIBRARY_IMAGES['openiap-apple']}
                alt=""
                aria-hidden="true"
              />
              <span>
                <strong>openiap-apple</strong>
                <small>StoreKit 2</small>
              </span>
            </a>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={LIBRARY_IMAGES['openiap-google']}
                alt=""
                aria-hidden="true"
              />
              <span>
                <strong>openiap-google</strong>
                <small>Play Billing 9.1</small>
              </span>
            </a>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/gql"
              target="_blank"
              rel="noopener noreferrer"
            >
              View the schema
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="in-section" aria-labelledby="shared-surface">
          <div className="in-section-heading in-section-heading-centered">
            <div>
              <p>03 / The API</p>
              <h2 id="shared-surface">A small surface on purpose</h2>
            </div>
          </div>

          <div className="in-surfaces">
            {SURFACES.map((surface) => (
              <section key={surface.label}>
                <div>
                  <span>{surface.index}</span>
                  <h3>{surface.label}</h3>
                  <p>{surface.detail}</p>
                </div>
                <div>
                  {surface.links.map((link) => (
                    <Link key={link.to} to={link.to}>
                      <code>{link.label}</code>
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section
          className="in-section in-type-section"
          aria-labelledby="type-safety"
        >
          <div className="in-section-heading">
            <div>
              <p>04 / Generated types</p>
              <h2 id="type-safety">Same model, native language</h2>
            </div>
            <p>
              Each target gets idiomatic generated types while the field model
              stays aligned across the ecosystem.
            </p>
          </div>

          <LanguageTabs>
            {{
              swift: (
                <CodeBlock language="swift">{`func displayLabel(for product: Product) -> String {
    switch product {
    case let .productIos(ios):
        return ios.title + " " + ios.displayNameIOS
    case let .productAndroid(android):
        return android.title + " " + android.nameAndroid
    }
}`}</CodeBlock>
              ),
              kotlin: (
                <CodeBlock language="kotlin">{`fun displayLabel(product: Product): String = when (product) {
    is ProductIOS -> product.title + " " + product.displayNameIOS
    is ProductAndroid -> product.title + " " + product.nameAndroid
}`}</CodeBlock>
              ),
              typescript: (
                <CodeBlock language="typescript">{`function displayLabel(product: Product): string {
  if (product.platform === 'ios') {
    return product.title + ' ' + product.displayNameIOS;
  }
  return product.title + ' ' + product.nameAndroid;
}`}</CodeBlock>
              ),
              dart: (
                <CodeBlock language="dart">{`String displayLabel(Product product) {
  return switch (product) {
    ProductIOS(:final title, :final displayNameIOS) =>
      '$title $displayNameIOS',
    ProductAndroid(:final title, :final nameAndroid) =>
      '$title $nameAndroid',
  };
}`}</CodeBlock>
              ),
              csharp: (
                <CodeBlock language="csharp">{`string DisplayLabel(Product product) => product switch
{
    ProductIOS ios => $"{ios.Title} {ios.DisplayNameIOS}",
    ProductAndroid android => $"{android.Title} {android.NameAndroid}",
    _ => throw new ArgumentOutOfRangeException(nameof(product)),
};`}</CodeBlock>
              ),
              gdscript: (
                <CodeBlock language="gdscript">{`func display_label(product) -> String:
    if product is ProductIOS:
        return "%s %s" % [product.title, product.display_name_ios]
    if product is ProductAndroid:
        return "%s %s" % [product.title, product.name_android]
    return product.title`}</CodeBlock>
              ),
            }}
          </LanguageTabs>
        </section>

        <section className="in-section" aria-labelledby="purchase-loop">
          <div className="in-section-heading">
            <div>
              <p>05 / Runtime</p>
              <h2 id="purchase-loop">The purchase loop</h2>
            </div>
            <p>
              The same lifecycle travels from connection through server-side
              validation to a finished transaction.
            </p>
          </div>

          <ol className="in-purchase-loop">
            {PURCHASE_LOOP.map((step, index) => (
              <li key={step.label}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <Link to={step.to}>
                  <strong>{step.label}</strong>
                  <code>{step.code}</code>
                </Link>
              </li>
            ))}
          </ol>
          <Link className="in-inline-link" to="/docs/lifecycle">
            Explore the full purchase lifecycle
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </section>

        <section className="in-section" aria-labelledby="shipping-targets">
          <div className="in-section-heading">
            <div>
              <p>06 / Reach</p>
              <h2 id="shipping-targets">Where it ships</h2>
            </div>
            <p>Native store depth below, framework choice above.</p>
          </div>

          <div className="in-targets">
            <div className="in-store-list">
              {STORE_TARGETS.map((target) => (
                <Link key={target.store} to={target.to}>
                  <span>{target.store}</span>
                  <strong>{target.api}</strong>
                  <small>{target.targets}</small>
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              ))}
            </div>
            <div className="in-framework-list">
              {LIBRARIES.map((library) => (
                <Link key={library.name} to={library.setupPath}>
                  <img src={library.image} alt="" aria-hidden="true" />
                  <span>
                    <strong>{library.homeLabel}</strong>
                    <small>{library.language}</small>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="in-kit-reveal" aria-labelledby="iapkit-reveal">
          <div className="in-kit-reveal-inner">
            <p className="in-kit-eyebrow">One more thing</p>
            <img src={IAPKIT_LOGO_PATH} alt="" aria-hidden="true" />
            <h2 id="iapkit-reveal">Meet IAPKit</h2>
            <p className="in-kit-tagline">The backend for every purchase</p>
            <p className="in-kit-description">
              One backend validates purchases from Apple StoreKit 2, Google
              Play, Meta Horizon, Amazon Fire OS, and Vega OS, then returns one
              normalized result.
            </p>
            <div
              className="in-kit-platforms"
              aria-label="IAPKit purchase verification platforms"
            >
              <span>Apple</span>
              <span>Google Play</span>
              <span>Meta Horizon</span>
              <span>Fire OS</span>
              <span>Vega OS</span>
            </div>
            <div className="in-kit-capabilities" aria-label="IAPKit features">
              <span>Server validation</span>
              <span>Entitlements</span>
              <span>Store MCP</span>
              <span>Revenue</span>
            </div>
            <div className="in-kit-actions">
              <a
                href={IAPKIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={trackIapKitClick}
              >
                Open IAPKit
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <Link to="/docs/kit-backend">
                Explore the backend
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <aside className="in-start">
          <Braces size={24} strokeWidth={1.6} aria-hidden="true" />
          <div>
            <p>Ready to build?</p>
            <h2>Start with the stack you already know</h2>
          </div>
          <div>
            <Link to="/languages">
              Choose an SDK
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link to="/tutorials">
              Follow a guide
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <a
              href="https://github.com/hyodotdev/openiap"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={14} aria-hidden="true" />
              GitHub
            </a>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default Introduction;
