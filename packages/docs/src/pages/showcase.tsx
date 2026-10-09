import type { CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import SEO from '../components/SEO';
import {
  ShowcaseAppCard,
  ShowcaseSubmitCard,
  SHOWCASE_GUIDE_URL,
  SHOWCASE_DISCUSSION_URL,
} from '../components/ShowcaseCards';
import {
  GITHUB_DEPENDENTS_LABEL,
  GITHUB_DEPENDENTS_URL,
  GITHUB_DEPENDENTS_DESCRIPTION,
  SHOWCASE_APPS,
} from '../lib/showcase';

const showcaseGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: '1rem',
};

function Showcase() {
  return (
    <div className="home">
      <SEO
        title="Apps built with OpenIAP"
        description={`${GITHUB_DEPENDENTS_LABEL}. Explore apps built with OpenIAP for React Native, Expo, and Flutter.`}
        path="/showcase"
        keywords="OpenIAP apps, IAPKit apps, expo-iap apps, react-native-iap apps, in-app purchase showcase"
      />
      <section className="home-section">
        <div className="section-container" style={{ maxWidth: '960px' }}>
          <h1
            id="apps"
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
              scrollMarginTop: '5rem',
            }}
          >
            Apps built with OpenIAP
          </h1>
          <p
            className="section-subtitle"
            style={{ fontSize: '1rem', marginBottom: '2rem' }}
          >
            <a
              href={GITHUB_DEPENDENTS_URL}
              target="_blank"
              rel="noreferrer"
              title={GITHUB_DEPENDENTS_DESCRIPTION}
              style={{
                color: 'inherit',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Plus size={15} aria-hidden="true" />
              <strong>{GITHUB_DEPENDENTS_LABEL}</strong>
            </a>
          </p>
          <div style={showcaseGridStyle}>
            {SHOWCASE_APPS.map((app) => (
              <ShowcaseAppCard key={app.github ?? app.name} app={app} />
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
              Submitted apps are listed with your permission. Ask for an update
              or removal anytime.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Showcase;
