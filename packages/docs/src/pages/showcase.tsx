import SEO from '../components/SEO';
import {
  ShowcaseAppCard,
  ShowcaseSubmitCard,
  SHOWCASE_GUIDE_URL,
  SHOWCASE_DISCUSSION_URL,
  showcaseGridStyle,
} from '../components/ShowcaseCards';
import { SHOWCASE_APPS } from '../lib/showcase';

function Showcase() {
  return (
    <div className="home">
      <SEO
        title="Who uses OpenIAP?"
        description="Showcase of apps built with OpenIAP libraries, including apps that use IAPKit."
        path="/showcase"
        keywords="OpenIAP apps, IAPKit apps, expo-iap apps, react-native-iap apps, in-app purchase showcase"
      />
      <section className="home-section">
        <div className="section-container" style={{ maxWidth: '960px' }}>
          <h2>Who uses OpenIAP?</h2>
          <p className="section-subtitle">
            {SHOWCASE_APPS.length} apps ship in-app purchases with OpenIAP
            libraries. Ordered by App Store and Google Play review counts.
          </p>
          <div style={{ ...showcaseGridStyle, marginTop: '2.5rem' }}>
            {SHOWCASE_APPS.map((app) => (
              <ShowcaseAppCard key={app.name} app={app} />
            ))}
            <ShowcaseSubmitCard />
          </div>

          <div
            style={{
              marginTop: '3rem',
              padding: '2rem',
              border: '1px solid var(--border-color)',
              borderRadius: '1rem',
              textAlign: 'left',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Add your app</h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                lineHeight: '1.7',
                marginTop: '0.5rem',
              }}
            >
              Reply to{' '}
              <a
                href={SHOWCASE_DISCUSSION_URL}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-color)' }}
              >
                the showcase discussion
              </a>{' '}
              with the details below and we'll add your app. Prefer a pull
              request? Add an entry to{' '}
              <a
                href={SHOWCASE_GUIDE_URL}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-color)' }}
              >
                showcase-apps.json
              </a>
              . If you have multiple apps, include them in one pull request. You
              can also email{' '}
              <a
                href="mailto:hyo@hyo.dev?subject=OpenIAP Showcase Request&body=App Name:%0AOne-liner:%0AApp Icon (512x512 PNG, attached):%0AStore Links:%0A- iOS: %0A- Android: %0AOpenIAP library:%0AUses IAPKit (yes/no):"
                style={{ color: 'var(--accent-color)' }}
              >
                hyo@hyo.dev
              </a>
              .
            </p>
            <ul
              style={{
                color: 'var(--text-secondary)',
                lineHeight: '1.9',
                paddingLeft: '1.2rem',
                margin: 0,
              }}
            >
              <li>
                <strong>App name</strong> and a one-line description
              </li>
              <li>
                <strong>App icon</strong> — square, 512×512 PNG (we round the
                corners and convert it for you)
              </li>
              <li>
                <strong>Store links</strong> — App Store and/or Google Play
              </li>
              <li>
                <strong>Library</strong> you ship with (expo-iap,
                react-native-iap, flutter_inapp_purchase, kmp-iap, maui-iap,
                godot-iap)
              </li>
              <li>
                <strong>IAPKit</strong> — tell us whether you use it
              </li>
            </ul>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: 0,
                marginTop: '1.25rem',
              }}
            >
              Apps are listed only with your permission. Ask for an update or
              removal anytime.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Showcase;
