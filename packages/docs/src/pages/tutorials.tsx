import { ArrowRight, ArrowUpRight, CheckCircle2, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { useScrollToHash } from '../hooks/useScrollToHash';

const JOURNEY = [
  {
    step: '01',
    title: 'Configure the stores',
    description: 'Products, testers, signing, and store credentials.',
    links: [
      { label: 'iOS setup', to: '/docs/ios-setup' },
      { label: 'Android setup', to: '/docs/android-setup' },
    ],
  },
  {
    step: '02',
    title: 'Connect your SDK',
    description: 'Choose a framework and install its OpenIAP implementation.',
    links: [{ label: 'Choose a framework', to: '/languages' }],
  },
  {
    step: '03',
    title: 'Ship a safe purchase',
    description: 'Request, verify, finish, and restore the transaction.',
    links: [
      { label: 'Purchase flow', to: '/docs/features/purchase' },
      { label: 'Verification', to: '/docs/features/validation' },
    ],
  },
] as const;

const REFERENCES = [
  {
    id: 'platform-guides',
    label: 'Platform references',
    links: [
      {
        title: 'StoreKit 2',
        description: "Apple's native in-app purchase framework",
        href: 'https://developer.apple.com/storekit/',
      },
      {
        title: 'Google Play Billing',
        description: "Google Play's billing integration guide",
        href: 'https://developer.android.com/google/play/billing',
      },
    ],
  },
  {
    id: 'verification-guides',
    label: 'Server verification',
    links: [
      {
        title: 'App Store Server Library',
        description: 'Signed transactions and server-side verification',
        href: 'https://developer.apple.com/documentation/appstoreserverapi/simplifying-your-implementation-by-using-the-app-store-server-library',
      },
      {
        title: 'Verify Google Play purchases',
        description: 'Protect entitlements before granting access',
        href: 'https://developer.android.com/google/play/billing/integrate#verifying-purchase',
      },
    ],
  },
] as const;

const SIGNALS = [
  {
    date: '2025-06-30',
    title: 'Billing Library 8.0.0 release notes',
    source: 'Android Developers',
    href: 'https://developer.android.com/google/play/billing/release-notes#8-0-0',
  },
  {
    date: '2025-06-10',
    title: "What's new in StoreKit and In-App Purchase",
    source: 'Apple Developer',
    href: 'https://www.youtube.com/watch?v=LtWMxxL4nsw',
  },
] as const;

function Tutorials() {
  useScrollToHash();

  return (
    <div className="xp-page xp-tutorials">
      <SEO
        title="Tutorials"
        description="Step-by-step guides for iOS StoreKit 2 and Android Play Billing setup. Learn purchase verification, receipt validation, and best practices for in-app purchases."
        path="/tutorials"
        keywords="IAP tutorial, StoreKit 2 tutorial, Google Play Billing guide, purchase verification, receipt validation, iOS IAP setup, Android IAP setup"
      />

      <header className="xp-page-header xp-tutorials-header">
        <div className="xp-shell xp-page-header-grid">
          <div>
            <p className="xp-kicker">Guides</p>
            <h1>From store setup to shipped purchase</h1>
            <p className="xp-lede">
              Follow the shortest path through configuration, integration, and
              server verification.
            </p>
          </div>
          <nav className="xp-jump-list" aria-label="Tutorial sections">
            <a href="#journey">Start the path</a>
            <a href="#signals">Platform signals</a>
            <a href="#references">Reference shelf</a>
          </nav>
        </div>
      </header>

      <main className="xp-shell xp-main">
        <section
          id="journey"
          className="xp-section"
          aria-labelledby="path-title"
        >
          <div className="xp-section-heading">
            <div>
              <p>Start here</p>
              <h2 id="path-title">The purchase path</h2>
            </div>
            <p>
              Three checkpoints from an empty project to a verified purchase.
            </p>
          </div>

          <ol className="xp-journey">
            {JOURNEY.map((item) => (
              <li key={item.step}>
                <span>{item.step}</span>
                <div className="xp-journey-dot" aria-hidden="true" />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div>
                    {item.links.map((link) => (
                      <Link key={link.to} to={link.to}>
                        {link.label}
                        <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="signals"
          className="xp-section"
          aria-labelledby="signals-title"
        >
          <div className="xp-section-heading">
            <div>
              <p>Stay current</p>
              <h2 id="signals-title">Platform signals</h2>
            </div>
            <p>Store APIs move. These are the changes worth watching now.</p>
          </div>

          <div className="xp-signal-list">
            {SIGNALS.map((signal) => (
              <a
                key={signal.href}
                href={signal.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Radio size={16} aria-hidden="true" />
                <time dateTime={signal.date}>{signal.date}</time>
                <strong>{signal.title}</strong>
                <span>{signal.source}</span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        <section
          id="references"
          className="xp-section"
          aria-labelledby="references-title"
        >
          <div className="xp-section-heading">
            <div>
              <p>Go deeper</p>
              <h2 id="references-title">Reference shelf</h2>
            </div>
            <p>Primary documentation for the pieces beneath the shared API.</p>
          </div>

          <div className="xp-reference-shelf">
            {REFERENCES.map((group, groupIndex) => (
              <section key={group.id} aria-labelledby={group.id}>
                <div>
                  <span>{String(groupIndex + 1).padStart(2, '0')}</span>
                  <h3 id={group.id}>{group.label}</h3>
                </div>
                <div>
                  {group.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>
                        <strong>{link.title}</strong>
                        <small>{link.description}</small>
                      </span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Tutorials;
