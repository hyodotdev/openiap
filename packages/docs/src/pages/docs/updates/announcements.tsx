import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Callout from '../../../components/Callout';
import SEO from '../../../components/SEO';
import { useScrollToHash, getHashId } from '../../../hooks/useScrollToHash';
import Pagination from '../../../components/Pagination';
import { IAPKIT_URL, trackIapKitClick } from '../../../lib/config';
import { AMAZON_SUPPORTER, META_SUPPORTER } from '../../../lib/sponsors';

const { Wordmark: AmazonSponsorWordmark } = AMAZON_SUPPORTER;
const { Wordmark: MetaSponsorWordmark } = META_SUPPORTER;

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

interface Announcement {
  id: string;
  aliases?: readonly string[];
  date: Date;
  hidden?: boolean;
  element: React.ReactNode;
}

function Announcements() {
  useScrollToHash();

  const announcements: Announcement[] = [
    // 2026-07-29: OpenIAP 3
    {
      id: '2026-07-29-openiap-3',
      date: new Date('2026-07-29'),
      element: (
        <div key="2026-07-29-openiap-3" style={cardStyle}>
          <div style={headerStyle}>
            <div
              aria-hidden="true"
              style={{ fontSize: '2.25rem', lineHeight: 1 }}
            >
              ✨
            </div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              OpenIAP 3: Xcode 27, Flutter SwiftPM, and a cleaner API
            </h2>
            <a
              href="#2026-07-29-openiap-3"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>July 29, 2026</p>

          <p
            style={{
              margin: '0 0 1.25rem',
              color: 'var(--text-primary)',
              fontSize: 'clamp(1.2rem, 3vw, 1.65rem)',
              fontWeight: 700,
              lineHeight: 1.3,
            }}
          >
            Xcode 27-ready. Flutter SwiftPM. The legacy clutter is gone.
          </p>

          <Link
            to="/docs/updates/releases#openiap-major-api-cleanup-2026-07-29"
            style={{
              display: 'block',
              width: '100%',
              borderRadius: '0.75rem',
              margin: '0 0 1.5rem',
              border: '1px solid var(--border-color)',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
          >
            <img
              src="/announcements/openiap-3.webp"
              alt="OpenIAP 3 connecting purchase experiences across device platforms"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </Link>

          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            OpenIAP 3 is our biggest contract cleanup yet. It connects Flutter's
            SwiftPM path to openiap-apple 3.0.0, adds guarded Xcode 27 and
            StoreKit 27 support, and removes the deprecated APIs, duplicate
            fields, legacy request shapes, and compatibility aliases that made
            cross-platform integrations harder to reason about.
          </p>

          <h3 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
            What lands in OpenIAP 3
          </h3>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              Guarded Xcode 27 and StoreKit 27 support brings subscription
              bundles and suites, verified offer-code redemption results, and
              new transaction metadata without dropping the documented older-OS
              fallbacks. Xcode 27-built UIKit hosts must also adopt UIScene; the
              release notes link the host migration checklist and the device
              examples exercise it.
            </li>
            <li>
              Flutter 3.44+ resolves the OpenIAP Apple 3.0.0 native dependency
              through SwiftPM; older or SwiftPM-disabled projects retain the
              CocoaPods path.
            </li>
            <li>
              The legacy surface is gone: purchase, verification, offer,
              billing-program, and platform-request models now use one canonical
              vocabulary across the supported SDKs.
            </li>
            <li>
              IAPKit receipt verification, scoped keys, client payloads, catalog
              reads, and inbound App Store and Google Play webhooks keep their
              existing wire contracts.
            </li>
          </ul>

          <Callout kind="note">
            See the{' '}
            <Link to="/docs/updates/releases#openiap-major-api-cleanup-2026-07-29">
              complete OpenIAP 3 release notes
            </Link>{' '}
            for exact package versions, per-SDK changes, platform availability,
            and release links. Before upgrading, follow the{' '}
            <Link to="/docs/updates/migration">
              Deprecations &amp; 3.0 Migration catalog
            </Link>
            .
          </Callout>
        </div>
      ),
    },

    // 2026-07-24: Major-version deprecation schedule
    {
      id: '2026-07-24-major-version-deprecation-schedule',
      date: new Date('2026-07-24'),
      element: (
        <div
          key="2026-07-24-major-version-deprecation-schedule"
          style={cardStyle}
        >
          <div style={headerStyle}>
            <div
              aria-hidden="true"
              style={{ fontSize: '2.25rem', lineHeight: 1 }}
            >
              ⚠️
            </div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              Advance notice: deprecated APIs leave in the next majors
            </h2>
            <a
              href="#2026-07-24-major-version-deprecation-schedule"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>July 24, 2026</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            OpenIAP is defining one predictable removal window for its
            deprecated APIs and compatibility shims. Nothing is removed in a
            patch or minor release: the OpenIAP specification,{' '}
            <code>openiap-apple</code>, and <code>openiap-google</code> remove
            their deprecated OpenIAP-owned surfaces in <code>3.0.0</code>.
            Framework libraries remove the same generated surfaces and their own
            shims only when each library reaches its independently versioned
            next major.
          </p>
          <ul style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            <li>
              <code>react-native-iap 16.0.0</code> and{' '}
              <code>expo-iap 5.0.0</code>
            </li>
            <li>
              <code>flutter_inapp_purchase 10.0.0</code>
            </li>
            <li>
              <code>godot-iap 3.0.0</code> and <code>kmp-iap 3.0.0</code>
            </li>
            <li>
              <code>OpenIap.Maui 2.0.0</code>
            </li>
          </ul>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            Flutter users should migrate custom Android payload fixtures and
            adapters to the canonical <code>dataAndroid</code> key now. The
            9.6.1 retained <code>originalJsonAndroid</code> only as a temporary
            input fallback for the remainder of Flutter 9.x; the alias is not a
            public Purchase field and is removed in 10.0.0.
          </p>
          <Callout kind="note">
            See the complete{' '}
            <Link to="/docs/updates/migration">
              deprecation schedule and migration catalog
            </Link>
            . Each package reaches its major independently, so this notice does
            not promise a shared release date.
          </Callout>
        </div>
      ),
    },

    // 2026-08-19: Amazon Fire OS / Vega OS
    {
      id: '2026-08-19-amazon-fireos-vega',
      aliases: ['2026-06-09-amazon-fireos-vega'],
      date: new Date('2026-08-19'),
      element: (
        <div key="2026-08-19-amazon-fireos-vega" style={cardStyle}>
          <span id="2026-06-09-amazon-fireos-vega" aria-hidden="true" />
          <div style={headerStyle}>
            <img
              src="/announcements/amazon-fireos-vega.webp"
              alt="Amazon Fire OS and Vega OS support"
              className="announcement-thumb"
              style={{ width: '48px', height: '48px', borderRadius: '10px' }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              We are now backed by Amazon Developer!
            </h2>
            <a
              href="#2026-08-19-amazon-fireos-vega"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>August 19, 2026</p>
          <a
            href={AMAZON_SUPPORTER.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Visit ${AMAZON_SUPPORTER.name}`}
            style={{
              display: 'flex',
              width: 'fit-content',
              margin: '0 auto 1.5rem',
              textDecoration: 'none',
            }}
          >
            <AmazonSponsorWordmark className="announcement-sponsor-wordmark" />
          </a>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            Today marks a meaningful milestone for our team: We're thrilled to
            share that OpenIAP is now backed by Amazon Developer through
            open-source sponsorship and technical contributions.
          </p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            This support helps us to enable In-App Purchasing (IAP) capabilities
            for apps on Fire TVs through the OpenIAP ecosystem.
          </p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            For context, more than 300 million Fire TV devices have been
            purchased around the world. They are used for streaming shows,
            playing games, and watching live events. For example, if you have
            ever rented a streaming movie, you have gone through an IAP payment
            flow.
          </p>
          <a
            href="/docs/setup/store/amazon#fire-os"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '820px',
              borderRadius: '0.75rem',
              margin: '1.5rem auto',
              border: '1px solid var(--border-color)',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.16)',
              overflow: 'hidden',
            }}
          >
            <img
              src="/announcements/amazon-fire-tv-ui.webp"
              alt="Fire TV sports interface displayed on a living room TV"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </a>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginTop: '-0.5rem',
              marginBottom: '1rem',
              textAlign: 'center',
            }}
          >
            Image credit:{' '}
            <a
              href="https://www.aboutamazon.com/news/devices/new-fire-tv-upgrades-features-2026"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              Amazon News
            </a>
          </p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            There are two operating systems that power the Fire TV experience
            across these millions of streaming media players: Fire OS and Vega
            OS. OpenIAP supports both through its SDK and runtime integrations:
            Fire OS uses the Android <code>amazon</code> flavor backed by the
            Amazon Appstore SDK, while Vega OS uses a separate Kepler runtime
            path for <code>react-native-iap</code> and compatible{' '}
            <code>expo-iap</code> apps.
          </p>
          <h3 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
            Key Points
          </h3>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              The{' '}
              <strong>
                <a
                  href="/docs/setup/store/amazon#fire-os"
                  className="external-link"
                >
                  Amazon Store Setup guide
                </a>
              </strong>{' '}
              shows how Fire OS apps can select the Android <code>amazon</code>{' '}
              flavor, including <code>modules.amazon.fireOS</code> for Expo and
              Gradle flavor selection for bare React Native, Flutter, KMP, and
              MAUI where supported.
            </li>
            <li>
              The same Amazon Store Setup guide also covers Vega OS as a Kepler
              runtime target, not a Fire OS Android flavor. Expo uses{' '}
              <code>modules.amazon.vegaOS</code> and bare React Native for Vega
              uses Kepler dependencies plus <code>manifest.toml</code>.
            </li>
            <li>
              <strong>Amazon Appstore IAP</strong>: OpenIAP maps Amazon types of
              purchases including consumables, entitlements, subscriptions,
              purchase updates, and fulfillment into the OpenIAP API standard.
            </li>
            <li>
              <strong>Catalog identity</strong>: Product IDs stay aligned across
              Amazon Appstore, Amazon App Tester, app code, and Kit entitlement
              checks.
            </li>
          </ul>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            <strong>Note:</strong> OpenIAP will continue to operate
            independently with the same commitment to developer experience and
            cross-platform compatibility. Our core libraries remain MIT licensed
            and free to use.
          </p>
          <Callout kind="tip" title="Get started">
            Read the{' '}
            <a
              href="/docs/setup/store/amazon#fire-os"
              className="external-link"
            >
              Fire OS setup guide
            </a>{' '}
            for Amazon Appstore IAP integration, or open the{' '}
            <a
              href="/docs/setup/store/amazon#vega-os"
              className="external-link"
            >
              Vega OS runtime guide
            </a>{' '}
            for React Native for Vega apps and compatible Expo projects.
          </Callout>
        </div>
      ),
    },

    // 2026-05-07: maui-iap
    {
      id: '2026-05-07',
      date: new Date('2026-05-07'),
      element: (
        <div key="2026-05-07" style={cardStyle}>
          <div style={headerStyle}>
            <img
              src="/logo.webp"
              alt="maui-iap"
              className="announcement-thumb"
              style={{ width: '48px', height: '48px', borderRadius: '10px' }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              maui-iap is Now Available!
            </h2>
            <a
              href="#2026-05-07"
              style={linkIconStyle}
              title="Link to this announcement"
            >
              🔗
            </a>
          </div>
          <p style={dateStyle}>May 7, 2026 - maui-iap v1.0.0</p>
          <p style={{ lineHeight: '1.7', marginBottom: '1rem' }}>
            We're excited to announce <a href="/docs/setup/maui">maui-iap</a>,
            an official OpenIAP implementation for .NET MAUI! Starting from{' '}
            <strong>maui-iap v1.0.0</strong>, C# apps can use the same OpenIAP
            product, purchase, subscription, and listener model already used by
            the React Native, Expo, Flutter, Godot, and Kotlin Multiplatform
            libraries.
          </p>
          <ul
            style={{
              paddingLeft: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '1.7',
            }}
          >
            <li>
              <strong>Native C# API</strong> - MAUI-friendly interface following
              the OpenIAP specification
            </li>
            <li>
              <strong>Cross-platform</strong> - Supports iOS, Android, and
              macCatalyst from a single codebase
            </li>
            <li>
              <strong>Type-safe</strong> - Generated C# records and enums for
              better IDE support and fewer runtime errors
            </li>
          </ul>
          <a
            href="/docs/setup/maui"
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
              src="/announcements/maui.webp"
              alt="OpenIAP meets MAUI"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </a>
          <Callout kind="tip" title="Getting Started">
            Install <code>OpenIap.Maui</code> from NuGet or open the{' '}
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/libraries/maui-iap"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              maui-iap source
            </a>
            . See the <a href="/docs/setup/maui">.NET MAUI setup guide</a> for
            full documentation.
          </Callout>
        </div>
      ),
    },

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
            consistent development experience across all platforms. With this
            transition, all libraries now follow the{' '}
            <strong>OpenIAP Spec 2.0.0</strong>, ensuring a single unified
            specification across every platform.
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
                href="https://github.com/hyochan/react-native-iap"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                react-native-iap (archived)
              </a>
            </li>
            <li>
              <a
                href="https://github.com/hyochan/expo-iap"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                expo-iap (archived)
              </a>
            </li>
            <li>
              <a
                href="https://github.com/hyochan/flutter_inapp_purchase"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                flutter_inapp_purchase (archived)
              </a>
            </li>
            <li>
              <a
                href="https://github.com/hyochan/kmp-iap"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                kmp-iap (archived)
              </a>
            </li>
            <li>
              <a
                href="https://github.com/hyochan/godot-iap"
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
              Swift, Kotlin, TypeScript, Dart, C#, and GDScript simultaneously.
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
            <li>
              <strong>Spec & Docs v2.0.0</strong>: The OpenIAP specification
              (openiap-gql) and documentation have also been bumped to v2.0.0 to
              align with the monorepo transition as a fresh start.
            </li>
          </ul>

          <Callout kind="note" title="For existing users">
            There are no breaking changes. The major version bump reflects the
            transition to the monorepo as the new home for development and
            releases — not API changes. Package names and installation commands
            remain the same. Just update to the new version and you're good to
            go.
          </Callout>
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
              className="announcement-thumb"
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
          <Callout kind="tip" title="Getting Started">
            Download GDScript type definitions from the{' '}
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
          </Callout>
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
              src="/iapkit.webp"
              alt="IAPKit"
              className="announcement-thumb"
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
              reuse. More secure than relying only on local client state.
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
              src="/iapkit-love.webp"
              alt="OpenIAP + IAPKit"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
          </a>
          <Callout kind="tip" title="Getting Started">
            Use the new <code>verifyPurchaseWithProvider</code> API with{' '}
            <code>provider: 'iapkit'</code>. See the{' '}
            <a
              href="/docs/features/validation#verify-purchase-with-provider"
              className="external-link"
            >
              API documentation
            </a>{' '}
            for details.
          </Callout>
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
              src="/sponsors/meta.webp"
              alt="Meta Horizon"
              style={{ width: '92px', height: '48px', objectFit: 'contain' }}
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
            href="/docs/setup/store/horizon"
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
              src="/announcements/horizon.webp"
              alt="OpenIAP + Meta Horizon OS"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </a>
          <Callout kind="tip" title="Getting Started">
            Available in <code>openiap-google@1.3.0</code> and later. Check out
            the{' '}
            <a href="/docs/setup/store/horizon" className="external-link">
              Horizon OS guide
            </a>{' '}
            for details.
          </Callout>
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
          <Callout kind="note" title="Next">
            We will be publishing quickstart guides and API references within
            the Docs → Modules section.
          </Callout>
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
            <MetaSponsorWordmark className="announcement-sponsor-wordmark" />
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
              We are now backed by{' '}
              <a
                href={META_SUPPORTER.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--primary-color)',
                  textDecoration: 'none',
                }}
              >
                {META_SUPPORTER.name}
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
          <Callout kind="note">
            OpenIAP will continue to operate independently with the same
            commitment to developer experience and cross-platform compatibility.
            Our core libraries remain MIT licensed and free to use.
          </Callout>
        </div>
      ),
    },
  ];

  const sortedAnnouncements = announcements
    .filter((announcement) => !announcement.hidden)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const itemsPerPage = 5;

  const initialPage = useMemo(() => {
    const hashId = getHashId();
    if (!hashId) return 1;

    const announcementIndex = sortedAnnouncements.findIndex(
      (announcement) =>
        announcement.id === hashId || announcement.aliases?.includes(hashId)
    );
    if (announcementIndex === -1) return 1;

    return Math.floor(announcementIndex / itemsPerPage) + 1;
  }, [sortedAnnouncements]);

  return (
    <div className="doc-page">
      <SEO
        title="Announcements"
        description="Important news and updates about OpenIAP - new features, deprecations, and ecosystem changes."
        path="/docs/updates/announcements"
      />
      <h1>📢 Announcements</h1>
      <p>Important news and updates about OpenIAP</p>

      <Pagination itemsPerPage={itemsPerPage} initialPage={initialPage}>
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
