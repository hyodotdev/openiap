import type { CSSProperties } from 'react';
import { SiApple, SiGoogleplay } from 'react-icons/si';
import { Globe } from 'lucide-react';
import type { ShowcaseApp } from '../lib/showcase';

export const SHOWCASE_DISCUSSION_URL =
  'https://github.com/hyodotdev/openiap/discussions/350';

export const SHOWCASE_GUIDE_URL =
  'https://github.com/hyodotdev/openiap/blob/main/packages/docs/SHOWCASE.md';

export const showcaseGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '1rem',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'flex-start',
  padding: '1.25rem',
  border: '1px solid var(--border-color)',
  borderRadius: '0.875rem',
  textAlign: 'left',
};

const logoStyle: CSSProperties = {
  width: '56px',
  height: '56px',
  // Matches the rounded mask baked into /showcase icons so store artwork with
  // and without built-in corners renders identically.
  borderRadius: '22.37%',
  objectFit: 'cover',
  flexShrink: 0,
};

const storeLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: '0.5rem',
  border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)',
  textDecoration: 'none',
};

const badgeStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '0.75rem',
  padding: '0.1rem 0.5rem',
};

export function ShowcaseAppCard({ app }: { app: ShowcaseApp }) {
  return (
    <div style={cardStyle}>
      <img
        src={app.logo}
        alt={`${app.name} app icon`}
        width={56}
        height={56}
        loading="lazy"
        style={logoStyle}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>
          {app.name}
        </div>
        <div
          style={{
            fontSize: '0.85rem',
            lineHeight: '1.5',
            color: 'var(--text-secondary)',
            marginBottom: '0.6rem',
          }}
        >
          {app.tagline}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {app.ios ? (
            <a
              href={app.ios}
              target="_blank"
              rel="noreferrer"
              style={storeLinkStyle}
              aria-label={`${app.name} on the App Store`}
              title="App Store"
            >
              <SiApple size={15} />
            </a>
          ) : null}
          {app.android ? (
            <a
              href={app.android}
              target="_blank"
              rel="noreferrer"
              style={storeLinkStyle}
              aria-label={`${app.name} on Google Play`}
              title="Google Play"
            >
              <SiGoogleplay size={14} />
            </a>
          ) : null}
          {app.web ? (
            <a
              href={app.web}
              target="_blank"
              rel="noreferrer"
              style={storeLinkStyle}
              aria-label={`${app.name} website`}
              title="Website"
            >
              <Globe size={15} strokeWidth={2} />
            </a>
          ) : null}
          <span style={{ ...badgeStyle, marginLeft: '0.25rem' }}>
            {app.library}
          </span>
          {app.iapkit ? (
            <span
              style={{
                ...badgeStyle,
                color: 'var(--accent-color)',
              }}
              title="Uses IAPKit receipt validation"
            >
              IAPKit
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Sits in the app grid as the last cell, inviting the next submission. */
export function ShowcaseSubmitCard() {
  return (
    <div
      style={{
        ...cardStyle,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        border: '2px dashed var(--border-color)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontWeight: 700 }}>Ship with OpenIAP?</div>
      <div
        style={{
          fontSize: '0.85rem',
          lineHeight: '1.5',
          color: 'var(--text-secondary)',
        }}
      >
        Send your app details and IAPKit usage — we'll add it here.
      </div>
      <a
        href={SHOWCASE_DISCUSSION_URL}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-block',
          padding: '0.5rem 1.25rem',
          backgroundColor: 'var(--accent-color)',
          color: 'white',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
        }}
      >
        Submit Your App
      </a>
    </div>
  );
}
