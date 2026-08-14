import { ArrowUpRight, GitFork, MessageSquarePlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { LIBRARIES, LIBRARY_IMAGES } from '../lib/images';

const NATIVE_MODULES = [
  {
    name: 'openiap-apple',
    platform: 'Apple',
    detail: 'StoreKit 2',
    image: LIBRARY_IMAGES['openiap-apple'],
    url: 'https://github.com/hyodotdev/openiap/tree/main/packages/apple',
  },
  {
    name: 'openiap-google',
    platform: 'Google Play',
    detail: 'Billing 9.1',
    image: LIBRARY_IMAGES['openiap-google'],
    url: 'https://github.com/hyodotdev/openiap/tree/main/packages/google',
  },
] as const;

function Languages() {
  return (
    <div className="xp-page xp-languages">
      <SEO
        title="Implementations"
        description="Production-ready IAP libraries implementing OpenIAP: expo-iap, react-native-iap, flutter_inapp_purchase, kmp-iap, maui-iap, and godot-iap. Type-safe in-app purchases for every framework."
        path="/languages"
        keywords="expo-iap, react-native-iap, flutter_inapp_purchase, kmp-iap, maui-iap, godot-iap, IAP SDK, in-app purchase library, mobile payments SDK, cross-platform IAP"
      />

      <header className="xp-page-header xp-languages-header">
        <div className="xp-shell xp-page-header-grid">
          <div>
            <p className="xp-kicker">Implementations</p>
            <h1>Your stack, one contract</h1>
            <p className="xp-lede">
              Native store modules at the core. Six framework SDKs speaking the
              same purchase language.
            </p>
          </div>
          <div className="xp-contract-sample" aria-label="Shared API examples">
            <span>Shared surface</span>
            <Link to="/docs/apis/request-purchase">
              <code>requestPurchase()</code>
            </Link>
            <Link to="/docs/apis/finish-transaction">
              <code>finishTransaction()</code>
            </Link>
            <Link to="/docs/types/purchase">
              <code>Purchase</code>
            </Link>
          </div>
        </div>
      </header>

      <main className="xp-shell xp-main">
        <section className="xp-section" aria-labelledby="native-core">
          <div className="xp-section-heading">
            <div>
              <p>01 / Foundation</p>
              <h2 id="native-core">Native core</h2>
            </div>
            <p>Thin, official modules keep each store capability close.</p>
          </div>

          <div className="xp-native-rail">
            {NATIVE_MODULES.map((module) => (
              <a
                key={module.name}
                href={module.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={module.image} alt="" aria-hidden="true" />
                <span>
                  <small>{module.platform}</small>
                  <strong>{module.name}</strong>
                </span>
                <code>{module.detail}</code>
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            ))}
            <div className="xp-native-connector" aria-hidden="true">
              <span>powers every SDK</span>
            </div>
          </div>
        </section>

        <section className="xp-section" aria-labelledby="framework-sdks">
          <div className="xp-section-heading">
            <div>
              <p>02 / Choose a framework</p>
              <h2 id="framework-sdks">Framework SDKs</h2>
            </div>
            <p>
              Pick the runtime you already use. The contract stays the same.
            </p>
          </div>

          <ol className="xp-library-ledger">
            {LIBRARIES.map((library, index) => (
              <li key={library.name}>
                <span className="xp-row-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <img src={library.image} alt="" aria-hidden="true" />
                <div className="xp-library-name">
                  <small>
                    {library.frameworkName} · {library.language}
                  </small>
                  <h3>{library.displayName}</h3>
                </div>
                <div className="xp-library-install">
                  <span>v{library.version}</span>
                  <code>
                    {library.installCommand ?? 'Download the latest release'}
                  </code>
                </div>
                <div className="xp-row-actions">
                  <Link to={library.setupPath}>Setup</Link>
                  <a
                    href={library.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${library.displayName} on GitHub`}
                  >
                    GitHub <ArrowUpRight size={12} aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="xp-contribute">
          <GitFork size={22} strokeWidth={1.6} aria-hidden="true" />
          <div>
            <p>Missing your platform?</p>
            <h2>Bring another runtime into the contract</h2>
          </div>
          <a
            href="https://github.com/hyodotdev/openiap/discussions/new?category=general&title=%5BFeature%20Request%5D%20New%20platform%20support"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageSquarePlus size={16} aria-hidden="true" />
            Start a feature request
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </aside>
      </main>
    </div>
  );
}

export default Languages;
