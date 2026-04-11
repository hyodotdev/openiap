import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import Pagination from '../../../components/Pagination';
import { IAPKIT_URL, trackIapKitClick } from '../../../lib/config';

const cardStyle = {
  background: 'var(--bg-secondary)',
  border: '2px solid var(--border-color)',
  borderRadius: '1rem',
  padding: '2rem',
  marginBottom: '2rem',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
  overflowWrap: 'break-word' as const,
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  marginBottom: '1rem',
  flexWrap: 'wrap' as const,
};

const dateStyle = {
  fontSize: '0.9rem',
  color: 'var(--text-secondary)',
  marginBottom: '1rem',
};

const linkIconStyle = {
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  fontSize: '1.2rem',
};

const calloutStyle = {
  marginTop: '1.5rem',
  padding: '1rem',
  background: 'var(--bg-secondary)',
  borderRadius: '0.5rem',
  borderLeft: '4px solid var(--primary-color)',
};

interface Announcement {
  id: string;
  date: Date;
  element: React.ReactNode;
}

function Announcements() {
  useScrollToHash();

  const announcements: Announcement[] = [
    // 2026-04-06: Monorepo consolidation
    {
      id: '2026-04-06',
      date: new Date('2026-04-06'),
      element: (
        <div key="2026-04-06" style={cardStyle}>
          <div style={headerStyle}>
            <span style={{ fontSize: '2rem' }}>📦</span>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              All Framework Libraries Are Now in the OpenIAP Monorepo
            </h2>
            <a
              href="#2026-04-06"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>April 6, 2026</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            All framework libraries are now managed in the{' '}
            <a
              href="https://github.com/hyodotdev/openiap"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              OpenIAP monorepo
            </a>
            . This consolidation brings unified versioning, shared CI/CD, and
            consistent development experience across all platforms.
          </p>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              <a href="/docs/setup/react-native">react-native-iap</a> — React
              Native (Nitro Modules) — <strong>v15.0.0+</strong>
            </li>
            <li>
              <a href="/docs/setup/expo">expo-iap</a> — Expo managed & bare
              workflow — <strong>v4.0.0+</strong>
            </li>
            <li>
              <a href="/docs/setup/flutter">flutter_inapp_purchase</a> — Flutter
              — <strong>v9.0.0+</strong>
            </li>
            <li>
              <a href="/docs/setup/godot">godot-iap</a> — Godot 4.x —{' '}
              <strong>v2.0.0+</strong>
            </li>
            <li>
              <a href="/docs/setup/kmp">kmp-iap</a> — Kotlin Multiplatform —{' '}
              <strong>v2.0.0+</strong>
            </li>
          </ul>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            Each library retains its own example apps, CI/CD pipelines, and
            publishes to its respective registry (npm, pub.dev, Maven Central,
            Godot Asset Library). The individual repositories will be archived
            and point to the monorepo going forward.
          </p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            Documentation for versions prior to the ones listed above can be
            found in the archived individual repositories:
          </p>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              <a
                href="https://hyochan.github.io/react-native-iap"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                react-native-iap (archived)
              </a>
            </li>
            <li>
              <a
                href="https://hyochan.github.io/expo-iap"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                expo-iap (archived)
              </a>
            </li>
            <li>
              <a
                href="https://hyochan.github.io/flutter_inapp_purchase"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                flutter_inapp_purchase (archived)
              </a>
            </li>
            <li>
              <a
                href="https://hyochan.github.io/kmp-iap"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                kmp-iap (archived)
              </a>
            </li>
            <li>
              <a
                href="https://hyochan.github.io/godot-iap"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                godot-iap (archived)
              </a>
            </li>
          </ul>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
            Why Monorepo?
          </h3>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              <strong>Single source of truth</strong> — GraphQL schema, native
              modules, framework SDKs, generated types, documentation, and CI/CD
              all live in one repository. A spec change propagates across every
              platform in one commit.
            </li>
            <li>
              <strong>Faster development cycle</strong> — Developers can work
              across native modules and framework SDKs simultaneously using
              local source references, without waiting for intermediate releases
              during development.
            </li>
            <li>
              <strong>AI-friendly codebase</strong> — With all code co-located,
              AI assistants can navigate the full dependency graph, understand
              cross-platform implications, and make consistent changes across
              Swift, Kotlin, TypeScript, Dart, and GDScript simultaneously.
            </li>
            <li>
              <strong>Unified CI/CD</strong> — One set of release workflows with
              consistent versioning, prerelease support (rc), and GitHub Release
              creation across all platforms.
            </li>
          </ul>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
            Notable Changes
          </h3>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              <strong>Expo users</strong>: Use{' '}
              <a href="/docs/setup/expo">expo-iap</a> instead of
              react-native-iap. The Expo example in react-native-iap has been
              removed — expo-iap is the recommended library for Expo projects.
            </li>
            <li>
              <strong>DuplicatePurchase error code</strong>: Now an official
              part of the OpenIAP spec. Previously react-native-iap only, now
              available across all platforms.
            </li>
            <li>
              <strong>expo-iap naming fix</strong>:{' '}
              <code>isEligibleForIntroOfferIOS</code> parameter renamed from{' '}
              <code>groupID</code> to <code>groupId</code> to follow the OpenIAP{' '}
              <code>Id</code> (not <code>ID</code>) naming convention.
            </li>
          </ul>

          <div style={calloutStyle}>
            <strong>For existing users:</strong> There are no breaking changes.
            The major version bump reflects the transition to the monorepo as
            the new home for development and releases — not API changes. Package
            names and installation commands remain the same. Just update to the
            new version and you're good to go.
          </div>
        </div>
      ),
    },

    // 2025-12-31: godot-iap
    {
      id: '2025-12-31',
      date: new Date('2025-12-31'),
      element: (
        <div key="2025-12-31" style={cardStyle}>
          <div style={headerStyle}>
            <img
              src="https://github.com/user-attachments/assets/cc7f363a-43a9-470c-bde7-2f63985a9f46"
              alt="godot-iap"
              style={{ width: '48px', height: '48px', borderRadius: '10px' }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              godot-iap is Now Available!
            </h2>
            <a
              href="#2025-12-31"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>December 31, 2025 - openiap-gql v1.3.11</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            We're excited to announce{' '}
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              godot-iap
            </a>
            , an official OpenIAP implementation for the Godot game engine!
            Starting from <strong>openiap-gql v1.3.11</strong>, GDScript type
            definitions are now included in our type generation pipeline.
          </p>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              <strong>Native GDScript API</strong> - Godot-friendly interface
              following OpenIAP specification
            </li>
            <li>
              <strong>Cross-platform</strong> - Supports iOS and Android from a
              single codebase
            </li>
            <li>
              <strong>Type-safe</strong> - Generated GDScript types for better
              IDE support and fewer runtime errors
            </li>
          </ul>
          <a
            href="https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '400px',
              borderRadius: '0.75rem',
              margin: '1.5rem auto 0',
              border: '1px solid var(--border-color)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <img
              src="/announcements/godot.webp"
              alt="OpenIAP + Godot"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </a>
          <div style={calloutStyle}>
            <strong>Getting Started:</strong> Download GDScript type definitions
            from the{' '}
            <a href="/docs/types" className="external-link">
              Types page
            </a>{' '}
            or check out the{' '}
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              godot-iap repository
            </a>{' '}
            for full documentation.
          </div>
        </div>
      ),
    },

    // 2025-12-09: IAPKit
    {
      id: '2025-12-09',
      date: new Date('2025-12-09'),
      element: (
        <div key="2025-12-09" style={cardStyle}>
          <div style={headerStyle}>
            <img
              src="/iapkit.png"
              alt="IAPKit"
              style={{ width: '48px', height: '48px', borderRadius: '10px' }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              IAPKit is Now an Official Verification Provider!
            </h2>
            <a
              href="#2025-12-09"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>December 9, 2025 - v1.3.0</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            Starting from <strong>OpenIAP v1.3.0</strong>,{' '}
            <a
              href={IAPKIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
              onClick={trackIapKitClick}
            >
              IAPKit
            </a>{' '}
            is now integrated as the official purchase verification provider.
            This brings enterprise-grade backend verification to OpenIAP with
            minimal setup required.
          </p>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              <strong>Backend Purchase Verification + Security</strong> -
              Server-side validation that prevents fraud, tampering, and receipt
              reuse. More secure than client-only verification.
            </li>
            <li>
              <strong>Fast Launch</strong> - Simplified IAP verification
              process. Start selling in-app products with minimal configuration.
            </li>
            <li>
              <strong>Flexibility + Easy Maintenance</strong> - Single unified
              API for both Apple App Store and Google Play. Adding or changing
              stores is seamless.
            </li>
          </ul>
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackIapKitClick}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '400px',
              height: '220px',
              borderRadius: '0.75rem',
              margin: '1.5rem auto 0',
              border: '1px solid var(--border-color)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <img
              src="/iapkit-love.png"
              alt="OpenIAP + IAPKit"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
          </a>
          <div style={calloutStyle}>
            <strong>Getting Started:</strong> Use the new{' '}
            <code>verifyPurchaseWithProvider</code> API with{' '}
            <code>provider: 'iapkit'</code>. See the{' '}
            <a
              href="/docs/apis#verify-purchase-with-provider"
              className="external-link"
            >
              API documentation
            </a>{' '}
            for details.
          </div>
        </div>
      ),
    },

    // 2025-10-01: Meta Horizon OS
    {
      id: '2025-10-01',
      date: new Date('2025-10-01'),
      element: (
        <div key="2025-10-01" style={cardStyle}>
          <div style={headerStyle}>
            <img
              src="/meta.svg"
              alt="Meta Horizon"
              style={{ width: '48px', height: '48px' }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              Meta Horizon OS Support is Here!
            </h2>
            <a
              href="#2025-10-01"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>October 1, 2025</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            OpenIAP now officially supports{' '}
            <a
              href="https://developers.meta.com/horizon"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Meta Horizon OS
            </a>
            ! Build immersive VR experiences with Quest devices while using the
            same unified API you know and love.
          </p>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              <strong>Auto-detection</strong>: Automatically switches between
              Google Play and Horizon billing based on device
            </li>
            <li>
              <strong>Unified API</strong>: Same code works on Android phones,
              tablets, and Quest headsets
            </li>
            <li>
              <strong>Full feature support</strong>: Subscriptions, consumables,
              non-consumables, and alternative billing
            </li>
            <li>
              <strong>Production ready</strong>: Thread-safe implementation with
              comprehensive error handling
            </li>
          </ul>
          <a
            href="/docs/horizon-setup"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '400px',
              borderRadius: '0.75rem',
              margin: '1.5rem auto 0',
              border: '1px solid var(--border-color)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <img
              src="/announcements/horizon.png"
              alt="OpenIAP + Meta Horizon OS"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </a>
          <div style={calloutStyle}>
            <strong>Getting Started:</strong> Available in{' '}
            <code>openiap-google@1.3.0</code> and later. Check out the{' '}
            <a href="/docs/horizon-setup" className="external-link">
              Horizon OS guide
            </a>{' '}
            for details.
          </div>
        </div>
      ),
    },

    // 2025-09-15: openiap-gql v1.0.0
    {
      id: '2025-09-15',
      date: new Date('2025-09-15'),
      element: (
        <div key="2025-09-15" style={cardStyle}>
          <div style={headerStyle}>
            <span style={{ fontSize: '2rem' }}>📰</span>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              openiap-gql v1.0.0 is live
            </h2>
            <a
              href="#2025-09-15"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>September 15, 2025</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            Our GraphQL gateway for OpenIAP has reached its first stable
            release. Version 1.0.0 delivers a strongly typed schema, realtime
            subscription awareness, and polished tooling to help teams ship
            production-ready experiences faster.
          </p>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              Explore the{' '}
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/1.0.0"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                detailed v1.0.0 release notes
              </a>
            </li>
            <li>
              Subscription-aware directives with live entitlement helpers built
              in
            </li>
            <li>
              Explorer presets and copy-ready queries for rapid onboarding
            </li>
          </ul>
          <div
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem',
            }}
          >
            Want to kick the tires? Point your tooling at the new playground and
            start testing subscriptions with mocked entitlements in seconds.
          </div>
          <img
            src="https://github.com/user-attachments/assets/d53df582-fbb0-4df8-9fd3-a4411eba5ef6"
            alt="GraphQL explorer showcasing the openiap-gql release"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '720px',
              borderRadius: '0.75rem',
              margin: '0 auto',
              border: '1px solid var(--border-color)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
            }}
          />
        </div>
      ),
    },

    // 2025-09-01: Official Modules
    {
      id: '2025-09-01',
      date: new Date('2025-09-01'),
      element: (
        <div key="2025-09-01" style={cardStyle}>
          <div style={headerStyle}>
            <span style={{ fontSize: '2rem' }}>🚀</span>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              OpenIAP Official Modules are live
            </h2>
            <a
              href="#2025-09-01"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>September 1, 2025</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            We are excited to announce the first official OpenIAP modules for
            Apple and Google are now available. These modules provide a clean,
            unified interface aligned with the OpenIAP specification.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              margin: '1rem 0',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <img
                src="/logo.webp"
                alt="OpenIAP Apple"
                style={{ width: '56px', height: '56px', borderRadius: '10px' }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>openiap-apple</div>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  github.com/hyodotdev/openiap/tree/main/packages/apple
                </a>
              </div>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <img
                src="/logo.webp"
                alt="OpenIAP Google"
                style={{ width: '56px', height: '56px', borderRadius: '10px' }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>openiap-google</div>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  github.com/hyodotdev/openiap/tree/main/packages/google
                </a>
              </div>
            </div>
          </div>
          <p style={calloutStyle}>
            <strong>Next:</strong> We will be publishing quickstart guides and
            API references within the Docs → Modules section.
          </p>
        </div>
      ),
    },

    // 2025-08-15: Meta backing
    {
      id: '2025-08-15',
      date: new Date('2025-08-15'),
      element: (
        <div key="2025-08-15" style={cardStyle}>
          <div style={headerStyle}>
            <img
              src="/meta.svg"
              alt="Meta"
              style={{ width: '48px', height: '48px' }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              We are now backed by{' '}
              <a
                href="https://meta.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--primary-color)',
                  textDecoration: 'none',
                }}
              >
                Meta
              </a>
              !
            </h2>
            <a
              href="#2025-08-15"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>August 15, 2025</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1.5rem' }}>
            We're thrilled to announce that OpenIAP is now officially backed by
            Meta! This partnership marks a significant milestone in our mission
            to standardize and simplify in-app purchases across all platforms.
          </p>
          <p style={calloutStyle}>
            <strong>Note:</strong> OpenIAP will continue to operate
            independently with the same commitment to developer experience and
            cross-platform compatibility. Our core libraries remain MIT licensed
            and free to use.
          </p>
        </div>
      ),
    },
  ];

  // Sort by date (newest first)
  const sortedAnnouncements = [...announcements].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  return (
    <div className="doc-page">
      <SEO
        title="Announcements"
        description="Important news and updates about OpenIAP - new features, deprecations, and ecosystem changes."
        path="/docs/updates/announcements"
      />
      <h1>📢 Announcements</h1>
      <p>Important news and updates about OpenIAP</p>

      <Pagination itemsPerPage={5}>
        {sortedAnnouncements.map((a) => (
          <section key={a.id} id={a.id}>
            {a.element}
          </section>
        ))}
      </Pagination>
    </div>
  );
}

export default Announcements;
