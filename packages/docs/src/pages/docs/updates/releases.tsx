import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import SEO from '../../../components/SEO';
import { useScrollToHash, getHashId } from '../../../hooks/useScrollToHash';
import CodeBlock from '../../../components/CodeBlock';
import Pagination from '../../../components/Pagination';
import AnchorLink from '../../../components/AnchorLink';

const noteCardStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '0.5rem',
  padding: '1rem',
  marginBottom: '1.5rem',
  overflow: 'hidden',
  maxWidth: '100%',
};

interface Note {
  id: string;
  date: Date;
  element: React.ReactNode;
}

function Releases() {
  useScrollToHash();

  const allNotes: Note[] = [
    // May 13, 2026 — OpenIAP Spec 2.0.2 purchase update replay controls
    {
      id: 'openiap-spec-2-0-2-purchase-update-replay-controls',
      date: new Date('2026-05-13'),
      element: (
        <div
          key="openiap-spec-2-0-2-purchase-update-replay-controls"
          style={noteCardStyle}
        >
          <AnchorLink
            id="openiap-spec-2-0-2-purchase-update-replay-controls"
            level="h4"
          >
            May 13, 2026 — OpenIAP Spec 2.0.2 purchase update replay controls
          </AnchorLink>

          <p
            style={{
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Publishes <strong>OpenIAP Spec 2.0.2</strong> with{' '}
            <code>PurchaseUpdatedListenerOptions</code> and an iOS-only{' '}
            <code>includeDuplicateTransactionUpdatesIOS</code> flag. StoreKit
            can replay the same unfinished transaction through request and
            transaction-update paths during a single connection session. The
            default listener behavior remains entitlement-safe: one purchase
            success event per iOS transaction ID. Diagnostics can opt into the
            StoreKit replay stream explicitly. Track the fix in{' '}
            <a
              href="https://github.com/hyodotdev/openiap/issues/152"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              issue #152
            </a>{' '}
            and{' '}
            <a
              href="https://github.com/hyodotdev/openiap/pull/153"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              PR #153
            </a>
            .
          </p>

          <ul
            style={{
              marginBottom: '1rem',
              paddingLeft: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <strong>Listener-level opt-in</strong> — React Native and Expo
              accept the flag on <code>purchaseUpdatedListener</code>; Flutter,
              KMP, MAUI, and Godot expose equivalent stream or signal-level
              options without changing default purchase success handling.
            </li>
            <li>
              <strong>Native debugging preserved</strong> — openiap-apple no
              longer drops duplicate StoreKit updates before framework bridges
              can observe them. Default listeners suppress duplicates, while
              duplicate-enabled listeners receive the replay.
            </li>
            <li>
              <strong>Docs and type sync</strong> — the generated GQL types now
              include <code>PurchaseUpdatedListenerOptions</code> across Swift,
              Kotlin, TypeScript, Dart, GDScript, and C#.
            </li>
            <li>
              <strong>Usage guide</strong> — see{' '}
              <Link to="/docs/events/purchase-updated-listener">
                purchaseUpdatedListener
              </Link>{' '}
              for the default behavior and opt-in examples.
            </li>
          </ul>

          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/2.0.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenIAP Spec 2.0.2
                </a>
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // May 10, 2026 — godot-iap 2.2.8 iOS export embedding patch
    {
      id: 'godot-iap-2-2-8-ios-export-framework-embedding',
      date: new Date('2026-05-10'),
      element: (
        <div
          key="godot-iap-2-2-8-ios-export-framework-embedding"
          style={noteCardStyle}
        >
          <AnchorLink
            id="godot-iap-2-2-8-ios-export-framework-embedding"
            level="h4"
          >
            May 10, 2026 — godot-iap 2.2.8 iOS export framework embedding patch
          </AnchorLink>

          <p
            style={{
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Publishes <strong>godot-iap 2.2.8</strong> for the iOS export
            workflow. GodotIap now registers its iOS frameworks during export so
            Xcode receives <code>GodotIap.framework</code> and{' '}
            <code>SwiftGodotRuntime.framework</code> as embedded framework
            bundles automatically. The release also ships the post-export fixer
            inside the addon package for projects that were exported with an
            older plugin version. See{' '}
            <a
              href="https://github.com/hyodotdev/openiap/discussions/146"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              discussion #146
            </a>{' '}
            and{' '}
            <a
              href="https://github.com/hyodotdev/openiap/pull/148"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              PR #148
            </a>
            .
          </p>

          <ul
            style={{
              marginBottom: '1rem',
              paddingLeft: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <strong>Automatic iOS embedding</strong> — the Godot export plugin
              now supports iOS export presets and adds both Swift GDExtension
              frameworks to Xcode&apos;s <strong>Embed Frameworks</strong> build
              phase when the plugin is enabled.
            </li>
            <li>
              <strong>Post-export fallback</strong> —{' '}
              <code>fix_ios_embed.sh</code> is included in release artifacts and
              can repair existing exports by copying missing framework{' '}
              <code>Info.plist</code> files, normalizing framework bundle
              references, and avoiding duplicate framework link entries.
            </li>
            <li>
              <strong>Safer Xcode project handling</strong> — the fixer now asks
              users to set <code>XCODEPROJ</code> when multiple{' '}
              <code>.xcodeproj</code> files are present, rather than silently
              patching the first project it finds.
            </li>
            <li>
              <strong>Setup docs</strong> — the{' '}
              <Link to="/docs/setup/godot">Godot setup guide</Link> now
              documents automatic framework embedding first and keeps manual
              Xcode / <code>Info.plist</code> steps as fallback guidance.
            </li>
          </ul>

          {/* Package Releases */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.2.8"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap 2.2.8
                </a>
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // May 8, 2026 — openiap-apple 2.1.8 promoted IAP cold-start fix
    {
      id: 'apple-2-1-8-promoted-iap-cold-start',
      date: new Date('2026-05-08'),
      element: (
        <div key="apple-2-1-8-promoted-iap-cold-start" style={noteCardStyle}>
          <AnchorLink id="apple-2-1-8-promoted-iap-cold-start" level="h4">
            May 8, 2026 — openiap-apple 2.1.8 promoted IAP cold-start fix
          </AnchorLink>

          <p
            style={{
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Ships <strong>openiap-apple 2.1.8</strong> and framework-library
            patch releases for an iOS promoted-purchase cold-start race. The App
            Store can deliver a promoted purchase intent before a framework
            bridge is ready — before React Native / Expo JavaScript, Flutter
            Dart, Godot GDScript, KMP, or MAUI code has registered listeners or
            called <Link to="/docs/apis/init-connection">initConnection()</Link>
            {'. The shared '}
            <strong>openiap-apple</strong> StoreKit runtime now captures that
            intent at native module launch, keeps promoted purchase observation
            independent from connection teardown, and lets each wrapper replay
            the pending product through{' '}
            <Link to="/docs/events/ios/promoted-product-listener-ios">
              promotedProductListenerIOS
            </Link>{' '}
            and{' '}
            <Link to="/docs/apis/ios/get-promoted-product-ios">
              getPromotedProductIOS()
            </Link>
            {'. Track the fix in '}
            <a
              href="https://github.com/hyodotdev/openiap/issues/143"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              issue #143
            </a>{' '}
            and{' '}
            <a
              href="https://github.com/hyodotdev/openiap/pull/144"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              PR #144
            </a>
            {'.'}
          </p>

          <ul
            style={{
              marginBottom: '1rem',
              paddingLeft: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <strong>Cold-start delivery</strong> — promoted App Store purchase
              intents are captured in openiap-apple before any framework runtime
              has finished booting, including when the app is force-quit and
              relaunched by the purchase intent URL.
            </li>
            <li>
              <strong>Framework bridge replay</strong> — React Native, Expo,
              Flutter, Godot, KMP, and MAUI consumers can still receive the
              pending promoted product when their listener registration happens
              after the native StoreKit callback.
            </li>
            <li>
              <strong>Wrapper package updates</strong> — the framework releases
              pick up the new Apple runtime and keep each bridge&apos;s public
              promoted-purchase listener aligned with the shared iOS behavior.
              Expo additionally registers an AppDelegate subscriber so generated
              projects instantiate the Apple runtime early enough for promoted
              IAP callbacks.
            </li>
            <li>
              <strong>No API changes</strong> — apps should continue using{' '}
              <code>promotedProductListenerIOS</code> with{' '}
              <code>requestPurchase()</code>; only the deprecated{' '}
              <code>requestPurchaseOnPromotedProductIOS</code> helper remains
              deprecated.
            </li>
          </ul>

          {/* Package Releases */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/2.1.8"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple 2.1.8
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/react-native-iap-15.2.3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  react-native-iap 15.2.3
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.2.7"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap 4.2.7
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.2.7"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase 9.2.7
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.2.7"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap 2.2.7
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.2.7"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap 2.2.7
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/maui-iap-1.0.3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  maui-iap 1.0.3
                </a>
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // May 8, 2026 — openiap-apple + framework SDK iOS connection teardown patches
    {
      id: 'apple-2-1-7-framework-ios-connection-teardown-patches',
      date: new Date('2026-05-08'),
      element: (
        <div
          key="apple-2-1-7-framework-ios-connection-teardown-patches"
          style={noteCardStyle}
        >
          <AnchorLink
            id="apple-2-1-7-framework-ios-connection-teardown-patches"
            level="h4"
          >
            May 8, 2026 — openiap-apple + framework SDK iOS connection teardown
            patches
          </AnchorLink>

          <p
            style={{
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Publishes <strong>openiap-apple 2.1.7</strong> and framework-library
            patch releases for an iOS lifecycle race where{' '}
            <Link to="/docs/apis/end-connection">endConnection()</Link> could
            run while{' '}
            <Link to="/docs/apis/init-connection">initConnection()</Link> was
            still preparing StoreKit resources. The crash was reported from an{' '}
            <Link to="/docs/setup/expo">expo-iap</Link> unmount path, but the
            shared Apple runtime is consumed by all framework SDKs, so the
            native Apple patch and six framework patches are released together.
            See{' '}
            <a
              href="https://github.com/hyodotdev/openiap/issues/140"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              issue #140
            </a>{' '}
            and{' '}
            <a
              href="https://github.com/hyodotdev/openiap/pull/142"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              PR #142
            </a>
            .
          </p>

          <ul
            style={{
              marginBottom: '1rem',
              paddingLeft: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <strong>iOS lifecycle fix</strong> — connection teardown now
              cancels and waits for in-flight initialization before clearing
              listener tasks, pending StoreKit work, product cache state, and
              promoted-purchase observer registration.
            </li>
            <li>
              <strong>Unmount-safe cleanup</strong> — duplicate cleanup calls
              from JS hooks and native module destruction share the same
              teardown path, reducing the crash window on physical iOS devices.
            </li>
            <li>
              <strong>Listener stability</strong> — subscription billing issue
              listeners restore the StoreKit message stream after reconnects
              while avoiding duplicate stream tasks when one is already active.
            </li>
            <li>
              <strong>No API changes</strong> — app code can keep calling{' '}
              <code>initConnection()</code> and <code>endConnection()</code> the
              same way; direct SPM/CocoaPods consumers should upgrade
              openiap-apple, and framework consumers should upgrade their
              wrapper package.
            </li>
          </ul>

          {/* Package Releases */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/2.1.7"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple 2.1.7
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/react-native-iap-15.2.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  react-native-iap 15.2.2
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.2.6"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap 4.2.6
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.2.6"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase 9.2.6
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.2.6"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap 2.2.6
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.2.6"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap 2.2.6
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/maui-iap-1.0.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  maui-iap 1.0.2
                </a>
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // May 8, 2026 — maui-iap 1.0.1 namespace corrective release
    {
      id: 'maui-iap-1-0-1-openiap-namespace',
      date: new Date('2026-05-08'),
      element: (
        <div key="maui-iap-1-0-1-openiap-namespace" style={noteCardStyle}>
          <AnchorLink id="maui-iap-1-0-1-openiap-namespace" level="h4">
            May 8, 2026 — maui-iap v1.0.1 OpenIap namespace update
          </AnchorLink>

          <p
            style={{
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Publishes a corrective <strong>maui-iap 1.0.1</strong> patch so the
            public C# namespace matches the package name and documentation.
            Generated OpenIAP types now live under <code>OpenIap</code>. Apps
            import <code>OpenIap.Maui</code> and access the MAUI facade as{' '}
            <code>Iap.Instance</code>. See{' '}
            <a
              href="https://github.com/hyodotdev/openiap/pull/141"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              PR #141
            </a>
            .
          </p>

          <ul
            style={{
              marginBottom: '1rem',
              paddingLeft: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <strong>Namespace cleanup</strong> — C# apps should import{' '}
              <code>using OpenIap;</code> for generated records, enums, and
              resolver interfaces, plus <code>using OpenIap.Maui;</code> for the
              MAUI facade.
            </li>
            <li>
              <strong>Generated type sync</strong> — the C# generator now emits{' '}
              <code>namespace OpenIap;</code>, and the MAUI package copy of{' '}
              <code>Types.cs</code> stays byte-for-byte synced from GQL.
            </li>
            <li>
              <strong>Docs and examples</strong> — MAUI setup, API examples,
              event examples, README snippets, and LLM reference files now show
              the same <code>OpenIap</code> imports users receive from NuGet.
            </li>
          </ul>

          {/* Package Releases */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/maui-iap-1.0.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  maui-iap 1.0.1
                </a>{' '}
                (
                <a
                  href="https://www.nuget.org/packages/OpenIap.Maui/1.0.1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  NuGet
                </a>
                )
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // May 6, 2026 — maui-iap 1.0.0 published
    {
      id: 'maui-iap-1-0-0',
      date: new Date('2026-05-06'),
      element: (
        <div key="maui-iap-1-0-0" style={noteCardStyle}>
          <AnchorLink id="maui-iap-1-0-0" level="h4">
            May 6, 2026 — maui-iap v1.0.0 .NET MAUI release
          </AnchorLink>

          <p
            style={{
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Published the first official{' '}
            <Link to="/docs/setup/maui">maui-iap</Link> <strong>1.0.0</strong>{' '}
            package on NuGet. This gives .NET MAUI apps the same OpenIAP
            product, purchase, subscription, listener, and verification model
            used by the existing framework SDKs, backed by the current native
            Apple and Google packages.
          </p>

          <ul
            style={{
              marginBottom: '1rem',
              paddingLeft: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <strong>maui-iap 1.0.0</strong> — new NuGet package{' '}
              <code>OpenIap.Maui</code> for iOS, Android, and macCatalyst apps
              using .NET MAUI / C# 12.
            </li>
            <li>
              <strong>Single-package MAUI install</strong> — Android and iOS
              native bindings are private implementation details packed into the
              main NuGet, so apps only reference <code>OpenIap.Maui</code>.
            </li>
            <li>
              <strong>Example parity</strong> — the MAUI example mirrors the
              Expo sample flows for all products, purchase flow, subscription
              flow, available purchases, alternative billing, offer codes, and
              webhook stream demos.
            </li>
            <li>
              <strong>IAPKit helper parity</strong> — MAUI exposes{' '}
              <code>Iap.KitApi</code> and <code>Iap.ConnectWebhookStream</code>,
              plus the webhook parser helper, so apps can use the same status,
              entitlements, bind-user, and webhook flow as the TypeScript SDKs.
            </li>
          </ul>

          {/* Package Releases */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/maui-iap-1.0.0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  maui-iap 1.0.0
                </a>{' '}
                (
                <a
                  href="https://www.nuget.org/packages/OpenIap.Maui/1.0.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  NuGet
                </a>
                )
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // May 7, 2026 — non-Godot SDK parity + native API wiring guardrails
    {
      id: 'apple-2-1-6-google-2-1-4-sdk-parity',
      date: new Date('2026-05-07'),
      element: (
        <div key="apple-2-1-6-google-2-1-4-sdk-parity" style={noteCardStyle}>
          <AnchorLink id="apple-2-1-6-google-2-1-4-sdk-parity" level="h4">
            May 7, 2026 — Non-Godot SDK parity patch releases
          </AnchorLink>

          <p
            style={{
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Tightens the non-Godot SDK surface around the{' '}
            <Link to="/docs/setup/expo">expo-iap</Link> example SSOT. Apple and
            Google now expose the native wiring needed by the framework
            examples, while CI gains a parity audit that fails when a new
            library, route, product id, generated operation, or shared generated
            helper drifts from the SSOT. See{' '}
            <a
              href="https://github.com/hyodotdev/openiap/pull/134"
              target="_blank"
              rel="noopener noreferrer"
              className="external-link"
            >
              PR #134
            </a>
            .
          </p>

          <ul
            style={{
              marginBottom: '1rem',
              paddingLeft: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <strong>openiap-apple 2.1.6</strong> — adds the cross-platform{' '}
              <Link to="/docs/apis/get-storefront">
                <code>getStorefront()</code>
              </Link>{' '}
              protocol/store/module path and ObjC bridge wrappers, with{' '}
              <Link to="/docs/apis/ios/get-storefront-ios">
                <code>getStorefrontIOS()</code>
              </Link>{' '}
              delegating to the unified method for backward compatibility.
            </li>
            <li>
              <strong>openiap-google 2.1.4</strong> — wires Play and Horizon
              handler bundles for{' '}
              <Link to="/docs/apis/get-storefront">
                <code>getStorefront</code>
              </Link>
              , legacy alternative billing helpers, and Billing Programs APIs
              such as{' '}
              <Link to="/docs/apis/android/is-billing-program-available-android">
                <code>isBillingProgramAvailableAndroid</code>
              </Link>
              ,{' '}
              <Link to="/docs/apis/android/launch-external-link-android">
                <code>launchExternalLinkAndroid</code>
              </Link>
              , and{' '}
              <Link to="/docs/apis/android/create-billing-program-reporting-details-android">
                <code>createBillingProgramReportingDetailsAndroid</code>
              </Link>
              . This release also improves Android <code>QueryProduct</code>{' '}
              failures with Billing response code, debug message, queried
              product IDs, product type, and empty-result diagnostics.
            </li>
            <li>
              <strong>Example parity</strong> — Expo, React Native classic,
              React Native Expo, Flutter, KMP, MAUI, Apple, and Google examples
              now share the same product ids, route set, storefront usage,
              alternative billing flow, and webhook stream demo coverage.
            </li>
            <li>
              <strong>Framework SDK patches</strong> — Expo, React Native,
              Flutter, and KMP patch releases pick up the new native
              Apple/Google versions and ship the synchronized examples and
              tests. React Native's latest published patch for this rollout is
              <code>15.2.1</code>. No breaking JS, Dart, or Kotlin API changes
              are required for this parity patch.
            </li>
            <li>
              <strong>SSOT enforcement</strong> — new{' '}
              <code>bun run audit:parity</code> check compares the Expo example,
              generated GraphQL operations, generated type copies, and non-Godot
              library registry; the root CI workflow runs it on SDK/API/example
              changes.
            </li>
          </ul>

          <p
            style={{
              marginBottom: 0,
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
            }}
          >
            Godot remains intentionally excluded from this parity gate until its
            example parity and automated verification are brought into the same
            release lane.
          </p>

          {/* Package Releases */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
              marginTop: '1rem',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/2.1.6"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple 2.1.6
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/google-2.1.4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-google 2.1.4
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/react-native-iap-15.2.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  react-native-iap 15.2.1
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.2.5"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap 4.2.5
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.2.5"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase 9.2.5
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.2.5"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap 2.2.5
                </a>
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // May 5, 2026 — Webhook event streaming + IAPKit kit-api shipped to all SDKs
    {
      id: 'releases-2026-05-05',
      date: new Date('2026-05-05'),
      element: (
        <div key="releases-2026-05-05" style={noteCardStyle}>
          <AnchorLink id="releases-2026-05-05" level="h4">
            May 5, 2026
          </AnchorLink>

          <div style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              Webhook event streaming + IAPKit <code>kit-api</code> wired across
              every SDK
            </h5>
            <p
              style={{
                marginBottom: '1rem',
                color: 'var(--text-secondary)',
              }}
            >
              Picks up the kit hosted backend rollout (
              <a
                href="https://github.com/hyodotdev/openiap/pull/124"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                PR #124
              </a>
              ): every wrapper SDK and both native packages now expose the
              normalized webhook event stream (App Store Server Notifications v2
              + Google RTDN, surfaced through <code>kit.openiap.dev</code>'s SSE
              channel) plus a typed <code>kit-api</code> client for hosted
              purchase verification, subscription state, and product sync.
            </p>

            <ul
              style={{
                marginBottom: '1rem',
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <strong>packages/gql</strong> — added{' '}
                <code>webhook.graphql</code> spec, generated webhook event
                types, <code>connectWebhookStream</code> SSE client, and{' '}
                <code>kit-api</code> typed client. Spec bumped to{' '}
                <code>2.1.0</code>.
              </li>
              <li>
                <strong>packages/apple</strong> — <code>Types.swift</code>{' '}
                regenerated with webhook event payloads + kit-api request /
                response shapes; <code>OpenIapModule</code> exposes ASN v2
                normalization helpers used by Convex sync.
              </li>
              <li>
                <strong>packages/google</strong> — <code>Types.kt</code>{' '}
                regenerated; <code>OpenIapStore</code> emits RTDN-normalized
                events into the kit pipeline and exposes the same kit-api
                surface as Apple.
              </li>
              <li>
                <strong>expo-iap</strong> &amp;{' '}
                <strong>react-native-iap</strong> — added{' '}
                <code>webhook-client.ts</code>, <code>useWebhookEvents</code>{' '}
                hook, and <code>kit-api.ts</code>. <code>useIAP</code> now
                optionally subscribes to the live event stream so receipt
                updates fan out without polling.
              </li>
              <li>
                <strong>flutter_inapp_purchase</strong> — added{' '}
                <code>webhook_client.dart</code> with a Dart SSE transport;{' '}
                <code>types.dart</code> now mirrors the new webhook + kit-api
                shapes generated from <code>packages/gql</code>.
              </li>
              <li>
                <strong>kmp-iap</strong> — added <code>WebhookClient</code> with
                platform <code>WebhookTransport</code> implementations
                (OkHttp-EventSource on Android, NSURLSession on iOS) and{' '}
                expanded <code>Types.kt</code> for the new payloads.
              </li>
              <li>
                <strong>godot-iap</strong> — added{' '}
                <code>webhook_client.gd</code> with a GDScript SSE client and
                regenerated <code>types.gd</code>; the addon now ships with the
                same kit verification path the other SDKs use.
              </li>
            </ul>

            <p
              style={{
                marginBottom: 0,
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              The legacy <code>api.iapkit.com</code> redirect still forwards to{' '}
              <code>kit.openiap.dev</code> until{' '}
              <strong>August 12, 2026</strong> — apps that pick up these package
              versions move off the redirect and onto the native webhook stream
              in one upgrade.
            </p>
          </div>

          {/* Package Releases */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/2.1.5"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple 2.1.5
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/google-2.1.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-google 2.1.2
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.2.4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap 4.2.4
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.2.4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase 9.2.4
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.2.4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap 2.2.4
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.2.4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap 2.2.4
                </a>
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // May 4, 2026 — Kit webhook drain helper extraction + CI/BuildKit hardening
    {
      id: 'releases-2026-05-04',
      date: new Date('2026-05-04'),
      element: (
        <div key="releases-2026-05-04" style={noteCardStyle}>
          <AnchorLink id="releases-2026-05-04" level="h4">
            May 4, 2026
          </AnchorLink>

          <div style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              Kit webhook drain helper extracted + SSE drain edges hardened
            </h5>
            <p
              style={{
                marginBottom: '1rem',
                color: 'var(--text-secondary)',
              }}
            >
              The SSE live-drain loop in{' '}
              <code>packages/kit/server/api/v1/webhooks.ts</code> now delegates
              to a standalone <code>drainWebhookEventBatches</code> helper
              (preserving the same advance/abort semantics), so cohort and
              iteration-limit edges are testable in isolation. See{' '}
              <a
                href="https://github.com/hyodotdev/openiap/pull/125"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                PR #125
              </a>
              .
            </p>

            <ul
              style={{
                marginBottom: '1rem',
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <strong>Saturated-cohort fallback</strong> — drain loop now
                advances when a same-millisecond cohort exceeds the{' '}
                <code>take()</code> cap. The fallback is gated on a true same-
                <code>receivedAt</code> cohort (full page, every event shares
                one <code>receivedAt</code>, that <code>receivedAt</code>{' '}
                matches <code>cursor.sinceMs</code>) so a mixed full page ending
                at the cursor ms cannot skip a late-arriving same-ms event.
              </li>
              <li>
                <strong>Write-failure retryability</strong> — event ids are
                added to <code>seen</code> only after <code>writeEvent</code>{' '}
                succeeds, so a thrown writer leaves the event eligible for the
                next drain pass.
              </li>
              <li>
                <strong>Convex index cleanup</strong> — removed the redundant{' '}
                <code>by_project_and_received_and_creation</code> index. Convex
                auto-appends <code>_creationTime</code> to every index, so{' '}
                <code>by_project_and_received</code> already serves both{' '}
                <code>webhookEventsSince</code> and{' '}
                <code>latestWebhookEventsSince</code>.
              </li>
              <li>
                <strong>Typed drain events</strong> —{' '}
                <code>Record&lt;string, unknown&gt;</code> replaced with a{' '}
                <code>WebhookStreamEvent</code> type that names the fields the
                helper actually reads (<code>id</code>, <code>receivedAt</code>,{' '}
                <code>_creationTime</code>).
              </li>
              <li>
                <strong>Real-HTTP SSE integration test</strong> — added for{' '}
                <code>connectWebhookStream</code> in <code>packages/gql</code>{' '}
                using <code>http.createServer</code> + a fetch-based{' '}
                <code>EventSource</code> shim, and wired{' '}
                <code>packages/gql</code> vitest into CI's <code>test-gql</code>{' '}
                job (these tests weren't running on PRs before).
              </li>
            </ul>

            <p
              style={{
                marginBottom: '0.75rem',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              <strong>Build &amp; deploy:</strong>{' '}
              <code>VITE_KIT_MIXPANEL_TOKEN</code> is now passed as a BuildKit
              secret (<code>--build-secret</code>) instead of an{' '}
              <code>ARG</code>/<code>ENV</code> pair, with a{' '}
              <code>VITE_KIT_MIXPANEL_TOKEN_HASH</code> cache-bust ARG expanded
              inside the <code>RUN</code> command so token rotations actually
              invalidate the cached <code>bun run build:all</code> layer.{' '}
              <code>deploy-prod.sh</code> now prefers <code>sha256sum</code>{' '}
              with a <code>shasum -a 256</code> fallback for macOS.
            </p>

            <p
              style={{
                marginBottom: 0,
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              <strong>CI bumps:</strong> <code>actions/checkout@v4</code> →{' '}
              <code>v6</code>, <code>docker/setup-buildx-action@v3</code> →{' '}
              <code>v4</code>, <code>docker/build-push-action@v6</code> →{' '}
              <code>v7</code>.
            </p>
          </div>
        </div>
      ),
    },

    // April 25, 2026 — SDK parity patch: wire every type-declared handler end-to-end
    {
      id: 'releases-2026-04-25',
      date: new Date('2026-04-25'),
      element: (
        <div key="releases-2026-04-25" style={noteCardStyle}>
          <AnchorLink id="releases-2026-04-25" level="h4">
            April 25, 2026
          </AnchorLink>

          <div style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              SDK parity patch — every type-declared handler now has a runtime
              path
            </h5>
            <p
              style={{
                marginBottom: '1rem',
                color: 'var(--text-secondary)',
              }}
            >
              Closes{' '}
              <a
                href="https://github.com/hyodotdev/openiap/issues/104"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                issue #104
              </a>{' '}
              (Flutter <code>beginRefundRequestIOS</code> declared but never
              implemented) and every other instance of the same pattern found
              via a systematic 3-pass audit across all five wrapper SDKs. After
              this release, every handler declared in each library's generated
              types file has a complete runtime path (public API + native bridge
              + handlers-bundle wiring where applicable).
            </p>

            <ul
              style={{
                marginBottom: '1rem',
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <strong>packages/apple</strong> — added <code>@objc</code>{' '}
                bridge for <code>requestPurchaseOnPromotedProductIOS</code> and{' '}
                <code>deepLinkToSubscriptions</code> so kmp-iap cinterop can
                reach them.
              </li>
              <li>
                <strong>flutter_inapp_purchase</strong> — added 7 missing iOS
                query handlers (<code>beginRefundRequestIOS</code>,{' '}
                <code>currentEntitlementIOS</code>,{' '}
                <code>latestTransactionIOS</code>,{' '}
                <code>isTransactionVerifiedIOS</code>,{' '}
                <code>getTransactionJwsIOS</code>,{' '}
                <code>getReceiptDataIOS</code>,{' '}
                <code>canPresentExternalPurchaseNoticeIOS</code>), fixed
                channel-name drift on <code>syncIOS</code>/
                <code>subscriptionStatusIOS</code>/
                <code>getAppTransactionIOS</code>, and wired{' '}
                <code>verifyPurchase</code> plus three Android billing-program
                handlers into the <code>MutationHandlers</code> bundle.
              </li>
              <li>
                <strong>kmp-iap</strong> — replaced 5{' '}
                <code>UnsupportedOperationException</code> stubs in{' '}
                <code>iosMain</code> with real ObjC bridge calls for{' '}
                <code>beginRefundRequestIOS</code>, <code>syncIOS</code>,{' '}
                <code>getAllTransactionsIOS</code>,{' '}
                <code>requestPurchaseOnPromotedProductIOS</code>, and{' '}
                <code>deepLinkToSubscriptions</code>.
              </li>
              <li>
                <strong>expo-iap</strong> — exported{' '}
                <code>consumePurchaseAndroid</code> (previously asymmetric vs{' '}
                <code>acknowledgePurchaseAndroid</code>) and{' '}
                <code>getStorefrontIOS</code> deprecated alias.
              </li>
              <li>
                <strong>react-native-iap</strong> — exported{' '}
                <code>validateReceiptIOS</code> deprecated alias.
              </li>
              <li>
                <strong>godot-iap</strong> — added <code>validate_receipt</code>
                , <code>validate_receipt_ios</code>, and three iOS 18.1+{' '}
                <code>ExternalPurchaseCustomLink</code> methods across the
                GDExtension Swift bridge and GDScript public API.
              </li>
            </ul>

            <p
              style={{
                marginBottom: 0,
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              The knowledge base gained an{' '}
              <a
                href="https://github.com/hyodotdev/openiap/blob/main/knowledge/internal/04-platform-packages.md#sdk-parity-checklist-critical--prevents-declared-but-not-implemented"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                SDK Parity Checklist
              </a>{' '}
              so future schema additions cannot reintroduce phantom interfaces.
              See{' '}
              <a
                href="https://github.com/hyodotdev/openiap/pull/105"
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                PR #105 (https://github.com/hyodotdev/openiap/pull/105)
              </a>{' '}
              for the full diff.
            </p>
          </div>

          {/* Package Releases */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/2.1.4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple 2.1.4
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.2.3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap 4.2.3
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.2.3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase 9.2.3
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.2.3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap 2.2.3
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.2.3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap 2.2.3
                </a>
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // April 24, 2026 — IAPKit verification host migration shipped in native patches
    {
      id: 'releases-2026-04-24',
      date: new Date('2026-04-24'),
      element: (
        <div key="releases-2026-04-24" style={noteCardStyle}>
          <AnchorLink id="releases-2026-04-24" level="h4">
            April 24, 2026
          </AnchorLink>

          <div style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              IAPKit verification host migrated to <code>kit.openiap.dev</code>
            </h5>
            <p
              style={{
                marginBottom: '1rem',
                color: 'var(--text-secondary)',
              }}
            >
              The IAPKit purchase verification service moved from{' '}
              <code>api.iapkit.com</code> to <code>kit.openiap.dev</code>. Only
              the host changed — the request/response shape, authentication (
              <code>Authorization: Bearer &lt;apiKey&gt;</code>), and the{' '}
              <code>/v1/purchase/verify</code> path are identical. No client
              code changes are required once you pick up the latest package
              versions.
            </p>
            <ul
              style={{
                marginBottom: '1rem',
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <strong>Old:</strong>{' '}
                <code>https://api.iapkit.com/v1/purchase/verify</code>
              </li>
              <li>
                <strong>New:</strong>{' '}
                <code>https://kit.openiap.dev/v1/purchase/verify</code>
              </li>
              <li>
                API keys are now issued from{' '}
                <a
                  href="https://kit.openiap.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  kit.openiap.dev
                </a>
                .
              </li>
            </ul>
            <p
              style={{
                marginBottom: 0,
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              The legacy <code>api.iapkit.com</code> host redirects to{' '}
              <code>kit.openiap.dev</code> until{' '}
              <strong>August 12, 2026</strong>. Upgrade before that date to
              avoid verification failures.
            </p>
          </div>

          {/* Package Releases */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/2.1.3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple 2.1.3
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/google-2.1.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-google 2.1.1
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.2.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap 4.2.2
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.2.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase 9.2.2
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.2.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap 2.2.2
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.2.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap 2.2.2
                </a>
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // April 17, 2026 — Advanced Commerce & Transaction History
    {
      id: 'releases-2026-04-17',
      date: new Date('2026-04-17'),
      element: (
        <div key="releases-2026-04-17" style={noteCardStyle}>
          <AnchorLink id="releases-2026-04-17" level="h4">
            April 17, 2026
          </AnchorLink>

          <div style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              Advanced Commerce API &amp; Transaction History
            </h5>

            <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              <strong>iOS — Advanced Commerce Info (iOS 18.4+):</strong>
            </p>
            <ul
              style={{
                marginBottom: '1rem',
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                New <code>AdvancedCommerceInfoIOS</code> type with nested{' '}
                <code>AdvancedCommerceItemIOS</code>,{' '}
                <code>AdvancedCommerceItemDetailsIOS</code>, and{' '}
                <code>AdvancedCommerceRefundIOS</code> types.
              </li>
              <li>
                New <code>advancedCommerceInfoIOS</code> field on{' '}
                <Link to="/docs/types/purchase">
                  <code>PurchaseIOS</code>
                </Link>{' '}
                — present only for transactions using the Advanced Commerce API
                with generic SKU purchases.
              </li>
              <li>
                Contains item details, tax info, and refund data from{' '}
                <code>Transaction.AdvancedCommerceInfo</code>.
              </li>
            </ul>

            <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              <strong>
                iOS — Full Transaction History (
                <code>getAllTransactionsIOS</code>):
              </strong>
            </p>
            <ul
              style={{
                marginBottom: '1rem',
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                New{' '}
                <Link to="/docs/apis/ios/get-all-transactions-ios">
                  <code>getAllTransactionsIOS()</code>
                </Link>{' '}
                query returns the full StoreKit 2 transaction history as{' '}
                <Link to="/docs/types/purchase">
                  <code>PurchaseIOS</code>
                </Link>{' '}
                values.
              </li>
              <li>
                Requires the <code>SK2ConsumableTransactionHistory</code>{' '}
                Info.plist key for finished consumables to be included (iOS
                18+).
              </li>
              <li>
                Unlike <code>getAvailablePurchases</code>, always returns the
                iOS-specific{' '}
                <Link to="/docs/types/purchase">
                  <code>PurchaseIOS</code>
                </Link>{' '}
                shape.
              </li>
            </ul>

            <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              <strong>References:</strong>
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a href="/docs/types/purchase">AdvancedCommerceInfoIOS Type</a>
              </li>
              <li>
                <a href="/docs/apis/ios/get-all-transactions-ios">
                  getAllTransactionsIOS API
                </a>
              </li>
            </ul>
          </div>

          {/* Package Releases */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/gql-2.0.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-spec 2.0.1
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/2.1.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple 2.1.2
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.2.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap 4.2.1
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.2.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase 9.2.1
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.2.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap 2.2.1
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.2.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap 2.2.1
                </a>
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // April 16, 2026 — combined release note
    {
      id: 'releases-2026-04-16',
      date: new Date('2026-04-16'),
      element: (
        <div key="releases-2026-04-16" style={noteCardStyle}>
          <AnchorLink id="releases-2026-04-16" level="h4">
            April 16, 2026
          </AnchorLink>

          {/* subscriptionBillingIssue event */}
          <div style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              Cross-platform <code>subscriptionBillingIssue</code> event
            </h5>
            <p
              style={{
                marginBottom: '1rem',
                color: 'var(--text-secondary)',
              }}
            >
              Until now, catching a failed payment before the platform silently
              downgrades or cancels a subscription required running your own
              server and polling Apple/Google Server-to-Server Notifications.
              With the new <code>subscriptionBillingIssue</code> event, apps can
              detect billing problems purely on the client — no backend
              infrastructure needed. Listen for the event, deep-link the user to
              the platform&apos;s subscription management screen via{' '}
              <code>deepLinkToSubscriptions</code>, and turn involuntary churn
              into a recoverable moment.
            </p>

            <ul
              style={{
                marginBottom: '1rem',
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <strong>Schema:</strong> new{' '}
                <code>IapEvent.SubscriptionBillingIssue</code> enum value and{' '}
                <code>subscriptionBillingIssue: Purchase!</code> subscription in{' '}
                <code>event.graphql</code>. Payload is the affected{' '}
                <Link to="/docs/types/purchase">
                  <code>Purchase</code>
                </Link>
                .
              </li>
              <li>
                <strong>iOS:</strong> registered via{' '}
                <code>subscriptionBillingIssueListener</code> on{' '}
                <code>OpenIapModule</code>. Starts a{' '}
                <code>StoreKit.Message.messages</code> loop (iOS 18+), and on{' '}
                <code>.billingIssue</code> scans{' '}
                <code>Transaction.currentEntitlements</code> for subscriptions
                whose renewal state is <code>.inBillingRetryPeriod</code> or{' '}
                <code>.inGracePeriod</code>, emitting one event per match.
                Silent no-op on iOS 17 and earlier, and on macOS / tvOS /
                watchOS / visionOS.
              </li>
              <li>
                <strong>Android (Play flavor):</strong> registered via{' '}
                <code>addSubscriptionBillingIssueListener</code>. Fires during{' '}
                <code>getAvailablePurchases</code> for each purchase with{' '}
                <code>isSuspendedAndroid == true</code>; deduped by purchase
                token across the session.
              </li>
              <li>
                <strong>Android (Horizon flavor):</strong> explicit no-op — the
                Horizon Billing Compatibility SDK targets Play Billing 7.0 and
                does not expose a suspended-subscription signal. Calling{' '}
                <code>addSubscriptionBillingIssueListener</code> logs a warning
                and returns; the listener is never invoked.
              </li>
              <li>
                <strong>Recommended UX:</strong> on fire, direct the user to{' '}
                <code>deepLinkToSubscriptions</code> so they can update payment
                method in the platform subscription center.
              </li>
            </ul>
          </div>

          {/* Version bumps */}
          <div
            style={{
              paddingTop: '1rem',
              marginBottom: '1.5rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>Package Releases</h5>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/2.1.0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple 2.1.0
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/google-2.1.0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-google 2.1.0
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/react-native-iap-15.2.0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  react-native-iap 15.2.0
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.1.0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap 4.1.0
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.2.0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase 9.2.0
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.2.0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap 2.2.0
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.2.0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap 2.2.0
                </a>
              </li>
            </ul>
          </div>

          {/* Android minSdk lint fix */}
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              Android: minSdk 23 Lint Fix
            </h5>
            <p style={{ color: 'var(--text-secondary)' }}>
              Fixed an Android lint error in <code>openiap-google</code> where{' '}
              <code>ConcurrentHashMap.newKeySet()</code> (API 24+) was used
              while <code>minSdk</code> is 23. Replaced with{' '}
              <code>Collections.newSetFromMap(ConcurrentHashMap())</code> which
              is available from API 1. This was introduced in the{' '}
              <code>subscriptionBillingIssue</code> event feature.
            </p>
          </div>
        </div>
      ),
    },
    // Subscription replacement + debug message diagnostics - Apr 15, 2026
    {
      id: 'subscription-replacement-and-debug-message-2026-04-15',
      date: new Date('2026-04-15'),
      element: (
        <div
          key="subscription-replacement-and-debug-message-2026-04-15"
          style={noteCardStyle}
        >
          <AnchorLink
            id="subscription-replacement-and-debug-message-2026-04-15"
            level="h4"
          >
            Subscription Replacement Wiring & Billing Debug Messages - April 15,
            2026
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1.5rem',
              color: 'var(--text-secondary)',
            }}
          >
            Two connected Android fixes. First, the newer per-product
            subscription replacement path now actually reaches the native layer
            on flutter_inapp_purchase. Second, Google Play&apos;s raw{' '}
            <code>BillingResult.debugMessage</code> is now forwarded through{' '}
            <code>PurchaseError</code>, so callers can read the specific reason
            Play rejected a replacement flow instead of just seeing a generic
            &quot;Invalid arguments&quot;.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/google-2.0.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                openiap-google 2.0.0
              </a>
            </h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                <strong>
                  Breaking: <code>OpenIapError</code> error types are now data
                  classes
                </strong>{' '}
                — every error returned by <code>fromBillingResponseCode</code> (
                <code>DeveloperError</code>, <code>PurchaseFailed</code>,{' '}
                <code>UserCancelled</code>, <code>ServiceUnavailable</code>,{' '}
                <code>BillingUnavailable</code>, <code>ItemUnavailable</code>,{' '}
                <code>BillingError</code>, <code>ItemAlreadyOwned</code>,{' '}
                <code>ItemNotOwned</code>, <code>ServiceDisconnected</code>,{' '}
                <code>FeatureNotSupported</code>, <code>ServiceTimeout</code>,{' '}
                <code>UnknownError</code>) now accepts an optional{' '}
                <code>debugMessage: String?</code>. This is a source-breaking
                change for direct Kotlin consumers: references like{' '}
                <code>throw OpenIapError.DeveloperError</code> must become{' '}
                <code>throw OpenIapError.DeveloperError()</code>. Companion{' '}
                <code>.CODE</code> / <code>.MESSAGE</code> accesses and{' '}
                <code>is OpenIapError.X</code> type checks are unchanged. Hence
                the major version bump.
              </li>
              <li>
                <strong>
                  Feat: surface Google Play&apos;s{' '}
                  <code>BillingResult.debugMessage</code>
                </strong>{' '}
                — <code>fromBillingResponseCode</code> forwards Play&apos;s raw
                debug text into the error instance for every response code, and{' '}
                <code>OpenIapError.toJSON()</code> emits a{' '}
                <code>debugMessage</code> key so downstream framework libraries
                can surface the reason Play rejected a purchase (offer token
                mismatch, subscription group conflict, etc.). The{' '}
                <code>launchBillingFlow</code> sync-failure path now also
                produces <code>DeveloperError</code> (matching the{' '}
                <code>onPurchasesUpdated</code> async path) instead of a generic{' '}
                <code>PurchaseFailed</code> for <code>DEVELOPER_ERROR</code>{' '}
                response codes.
              </li>
              <li>
                <strong>
                  Schema: add <code>ServiceTimeout</code> to the shared{' '}
                  <code>ErrorCode</code> enum
                </strong>{' '}
                so the code comes from{' '}
                <code>ErrorCode.ServiceTimeout.rawValue</code> like every other
                entry instead of a hand-typed string literal.
              </li>
            </ul>
            <p
              style={{
                margin: '0.5rem 0 0',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              <a
                href="https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google/2.0.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                openiap-google
              </a>{' '}
              ·{' '}
              <a
                href="https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google-horizon/2.0.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                openiap-google-horizon
              </a>
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/apple-2.0.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                openiap-apple 2.0.0
              </a>
            </h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                <strong>
                  Breaking: <code>ErrorCode</code> gains{' '}
                  <code>.serviceTimeout</code>
                </strong>{' '}
                — the shared spec schema adds <code>ServiceTimeout</code>, so
                the Swift <code>ErrorCode</code> enum picks up a new case. Any
                Swift consumer that does an exhaustive <code>switch</code> on{' '}
                <code>ErrorCode</code> without a <code>default:</code> branch
                will need to add a <code>.serviceTimeout</code> case (or a
                fallback), hence the major bump per SemVer. The enum is not{' '}
                <code>@frozen</code>, so switches with{' '}
                <code>@unknown default</code> keep working without changes.
              </li>
              <li>
                <strong>
                  Feat: <code>PurchaseError.debugMessage</code>
                </strong>{' '}
                — the generated <code>PurchaseError</code> struct gains an
                optional <code>debugMessage: String?</code> field that mirrors
                the Android side. <code>makePurchaseError(...)</code> accepts a{' '}
                <code>debugMessage:</code> parameter, and the StoreKit catch
                sites (product query, promoted product, promotional offer
                failure) now forward <code>error.localizedDescription</code>
                into it so iOS callers get the same structured diagnostic shape.
              </li>
              <li>
                The Swift codegen plugin emits <code>= nil</code> defaults on
                nullable struct properties so existing memberwise-init call
                sites keep compiling when new optional fields land.
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              flutter_inapp_purchase{' '}
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.0.3"
                target="_blank"
                rel="noopener noreferrer"
              >
                9.0.3
              </a>{' '}
              &amp;{' '}
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.1.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                9.1.0
              </a>
            </h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                <strong>
                  9.0.3 · Fix: forward{' '}
                  <code>subscriptionProductReplacementParams</code> on Android
                </strong>{' '}
                — the field was declared on{' '}
                <Link to="/docs/types/request-purchase-props">
                  <code>RequestSubscriptionAndroidProps</code>
                </Link>{' '}
                and parsed correctly by the native plugin, but{' '}
                <code>flutter_inapp_purchase.dart</code> was dropping it when
                building the method-channel payload, so the native side received{' '}
                <code>null</code> and Google Play applied its default
                replacement mode (<code>WITHOUT_PRORATION</code>) regardless of
                what callers passed from Dart. The Billing Library 8.1.0+
                per-product replacement path now works end-to-end. (
                <a href="https://github.com/hyodotdev/openiap/pull/97">#97</a>)
                A new channel test asserts that <code>oldProductId</code> and{' '}
                <code>replacementMode</code> reach the native{' '}
                <code>requestPurchase</code> call, so the wiring can&apos;t
                silently regress again.
              </li>
              <li>
                <strong>
                  9.1.0 · Feat: surface Google Play&apos;s{' '}
                  <code>debugMessage</code> through <code>PurchaseError</code>
                </strong>{' '}
                — <code>convertToPurchaseError</code> was only forwarding{' '}
                <code>code</code> and <code>message</code> from the native error
                payload, so the raw <code>BillingResult.debugMessage</code>,{' '}
                <code>responseCode</code>, and the resolved{' '}
                <code>platform</code> were being dropped. Combined with the
                openiap-google 2.0.0 change, Dart callers inspecting{' '}
                <code>PurchaseError.debugMessage</code> now see Play&apos;s
                exact rejection reason — useful for diagnosing{' '}
                <code>DEVELOPER_ERROR</code> surfaces such as{' '}
                <code>DEFERRED</code> replacement failures without having to
                attach adb.
              </li>
              <li>
                <strong>9.1.0</strong> picks up openiap-google 2.0.0 (debug
                message + data class error types) and openiap-apple 2.0.0 on
                iOS.
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/react-native-iap-15.1.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                react-native-iap 15.1.0
              </a>
            </h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                Regenerated types pick up{' '}
                <code>PurchaseError.debugMessage</code> and the new{' '}
                <code>ErrorCode.ServiceTimeout</code> enum value. JS consumers
                reading <code>error.debugMessage</code> now receive Play&apos;s
                raw rejection reason on Android when one is surfaced.
              </li>
              <li>
                Picks up openiap-google 2.0.0 via the Nitro bridge (no JS API
                breakage).
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.1.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                expo-iap 4.1.0
              </a>
            </h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                Same type-regen story as react-native-iap —{' '}
                <code>PurchaseError.debugMessage</code> and{' '}
                <code>ErrorCode.ServiceTimeout</code> reach JS consumers, and
                the Expo Modules bridge picks up openiap-google 2.0.0 without
                breaking the Expo-facing API.
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.1.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                kmp-iap 2.1.0
              </a>
            </h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                Regenerated <code>commonMain</code> <code>Types.kt</code> picks
                up <code>PurchaseError.debugMessage</code> and the new{' '}
                <code>ErrorCode.ServiceTimeout</code> /{' '}
                <code>ErrorCode.DuplicatePurchase</code> entries. Auto-synced
                from the spec schema via the extended{' '}
                <code>sync-to-platforms</code> script (package declaration and
                enum-companion semicolons are injected automatically, no hand
                edits).
              </li>
              <li>
                <code>ErrorMapping.legacyCodeMap</code> gains{' '}
                <code>E_SERVICE_TIMEOUT</code> / <code>SERVICE_TIMEOUT</code>{' '}
                and <code>E_DUPLICATE_PURCHASE</code> /{' '}
                <code>DUPLICATE_PURCHASE</code> aliases so legacy Android codes
                no longer collapse to <code>ErrorCode.Unknown</code>.
              </li>
              <li>
                Picks up openiap-google 2.0.0. The KMP-facing API is unchanged;
                consumers continue to interact with <code>kmpIapInstance</code>{' '}
                as before.
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.1.0"
                target="_blank"
                rel="noopener noreferrer"
              >
                godot-iap 2.1.0
              </a>
            </h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                The GDScript codegen now declares nullable scalars as{' '}
                <code>var field: Variant = null</code> instead of{' '}
                typed-with-sentinel-default. This preserves the schema&apos;s
                null-vs-default distinction so legitimate <code>false</code>,{' '}
                <code>0</code>, and <code>&quot;&quot;</code> values round-trip
                through <code>from_dict</code> / <code>to_dict</code> without
                being conflated with &quot;unset&quot;. <code>to_dict()</code>{' '}
                omits the key entirely when the value is still <code>null</code>
                .
              </li>
              <li>
                Regenerated types pick up{' '}
                <code>PurchaseError.debug_message</code>,{' '}
                <code>ErrorCode.ServiceTimeout</code>, and the nullable-scalar
                representation change.
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    // Monorepo patch releases - Apr 14, 2026
    {
      id: 'monorepo-2026-04-14',
      date: new Date('2026-04-14'),
      element: (
        <div key="monorepo-2026-04-14" style={noteCardStyle}>
          <AnchorLink id="monorepo-2026-04-14" level="h4">
            Monorepo Patch Releases - April 14, 2026
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1.5rem',
              color: 'var(--text-secondary)',
            }}
          >
            Two Android fixes: a subscription replacement mode integer mapping
            and a double-resume race in the purchase callback path. The Kotlin
            replacement-mode mapping now sources its integers from the native
            Google Play Billing constants so this class of drift cannot recur.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/google-1.3.31"
                target="_blank"
                rel="noopener noreferrer"
              >
                openiap-google 1.3.31
              </a>
            </h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                <strong>
                  Fix: Subscription replacement mode DEFERRED int value
                </strong>{' '}
                — <code>DEFERRED</code> was mapped to <code>4</code>, which is
                not a valid{' '}
                <code>SubscriptionUpdateParams.ReplacementMode</code> constant.
                Corrected to <code>6</code> to match the legacy Billing API
                consumed by <code>setSubscriptionReplacementMode(int)</code>. (
                <a href="https://github.com/hyodotdev/openiap/issues/92">#92</a>
                )
              </li>
              <li>
                <strong>
                  Internal: Replacement-mode mapping uses native Billing
                  constants
                </strong>{' '}
                — <code>SubscriptionReplacementModeAndroidExt.kt</code> moved
                into the <code>play/</code> source set and now references{' '}
                <code>
                  BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode
                </code>{' '}
                directly instead of hand-typed <code>0..6</code> literals.
                Matching tests assert against the native constants so the
                mapping tracks the Billing Library if Google ever renumbers
                them.
              </li>
              <li>
                <strong>
                  Fix: <code>IllegalStateException: Already resumed</code> in
                  purchase flow
                </strong>{' '}
                — <code>currentPurchaseCallback</code> is now an{' '}
                <code>AtomicReference</code> and is managed via{' '}
                <code>compareAndSet(null, callback)</code> on store and{' '}
                <code>compareAndSet(callback, null)</code> on cancellation. A
                concurrent second <code>requestPurchase</code> fails fast with{' '}
                <code>OpenIapError.DeveloperError</code> instead of overwriting
                the in-flight continuation, and a cancelled request can no
                longer clear a newer request's callback slot. Applied
                symmetrically to Play and Horizon flavors. (
                <a href="https://github.com/hyodotdev/openiap/issues/94">#94</a>
                )
              </li>
            </ul>
            <p
              style={{
                margin: '0.5rem 0 0',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              Maven Central:{' '}
              <a
                href="https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google/1.3.31"
                target="_blank"
                rel="noopener noreferrer"
              >
                openiap-google
              </a>{' '}
              ·{' '}
              <a
                href="https://central.sonatype.com/artifact/io.github.hyochan.openiap/openiap-google-horizon/1.3.31"
                target="_blank"
                rel="noopener noreferrer"
              >
                openiap-google-horizon
              </a>
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              <a
                href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.0.2"
                target="_blank"
                rel="noopener noreferrer"
              >
                flutter_inapp_purchase 9.0.2
              </a>
            </h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                <strong>
                  Fix: <code>AndroidReplacementMode.deferred.value</code> now
                  returns <code>6</code>
                </strong>{' '}
                (was <code>4</code>), matching the legacy{' '}
                <code>SubscriptionUpdateParams.ReplacementMode</code> consumed
                by the native side. <code>chargeFullPrice</code> remains{' '}
                <code>5</code>. Full enum coverage added to{' '}
                <code>enums_unit_test.dart</code>.
              </li>
              <li>Picks up openiap-google 1.3.31 (callback race fix).</li>
            </ul>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              Framework Library Patches
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              The remaining framework libraries receive a patch release to pick
              up the openiap-google 1.3.31 fixes:
            </p>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/react-native-iap-15.0.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  react-native-iap v15.0.2
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.0.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap v4.0.2
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.0.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap v2.0.2
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.0.2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap v2.0.2
                </a>
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // Monorepo patch releases - Apr 13, 2026
    {
      id: 'monorepo-2026-04-13',
      date: new Date('2026-04-13'),
      element: (
        <div key="monorepo-2026-04-13" style={noteCardStyle}>
          <AnchorLink id="monorepo-2026-04-13" level="h4">
            Monorepo Patch Releases - April 13, 2026
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1.5rem',
              color: 'var(--text-secondary)',
            }}
          >
            First patch releases from the OpenIAP monorepo. Includes a critical
            Android crash fix and godot-iap initialization guard.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>openiap-google 1.3.30</h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                <strong>Fix: Android crash in ProductManager.getOrQuery</strong>{' '}
                — Guard coroutine continuation with <code>isActive</code> before
                resume to prevent{' '}
                <code>IllegalStateException: Already resumed</code> when the
                billing callback arrives after coroutine cancellation. (
                <a href="https://github.com/hyodotdev/openiap/issues/88">#88</a>
                )
              </li>
              <li>
                Cache is now updated before the <code>isActive</code> check so
                cancelled queries still warm the ProductDetails cache,
                preventing redundant network requests.
              </li>
              <li>
                Same guard added to <code>queryPurchases</code> in Helpers.kt.
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>godot-iap 2.0.1</h5>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                <strong>Fix: Double initialization guard</strong> — Added{' '}
                <code>static var _is_initialized</code> in <code>_ready()</code>{' '}
                to prevent duplicate native plugin initialization when the
                plugin is both enabled in ProjectSettings and attached as an
                AutoLoad node. (
                <a href="https://github.com/hyochan/godot-iap/issues/24">
                  hyochan/godot-iap#24
                </a>
                )
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0' }}>
              Framework Library Patches
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              All framework libraries receive a patch release to pick up the
              openiap-google 1.3.30 fix:
            </p>
            <ul
              style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/react-native-iap-15.0.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  react-native-iap v15.0.1
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/expo-iap-4.0.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  expo-iap v4.0.1
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/flutter-iap-9.0.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  flutter_inapp_purchase v9.0.1
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/kmp-iap-2.0.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kmp-iap v2.0.1
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/releases/tag/godot-iap-2.0.1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  godot-iap v2.0.1
                </a>{' '}
                (includes init guard fix above)
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    // Apple 1.3.15 - Feb 12, 2026
    {
      id: 'apple-1-3-15',
      date: new Date('2026-02-12'),
      element: (
        <div key="apple-1-3-15" style={noteCardStyle}>
          <AnchorLink id="apple-1-3-15" level="h4">
            📅 openiap-apple v1.3.15 - iOS 15 Compatibility & watchOS Support
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1.5rem',
              color: 'var(--text-secondary)',
            }}
          >
            Fixed iOS 15 compatibility for currency code retrieval, unified
            platform availability annotations, and added watchOS support.
          </p>

          {/* Section 1: iOS 15 Compatibility */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              1. iOS 15 Compatibility Fix
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Fixed potential crash when using{' '}
              <code>priceFormatStyle.currencyCode</code> on iOS 15 devices. Now
              uses <code>product.priceFormatStyle.locale.currencyCode</code> as
              fallback to get the correct App Store currency.
            </p>
            <CodeBlock language="swift">{`// iOS 16+: Direct API
product.priceFormatStyle.currencyCode

// iOS 15: Fallback using product's locale
product.priceFormatStyle.locale.currencyCode`}</CodeBlock>
          </div>

          {/* Section 2: watchOS Support */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              2. watchOS Support Added
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Added <code>watchOS 8.0+</code> deployment target to podspec and
              unified all <code>@available</code> annotations.
            </p>
            <CodeBlock language="swift">{`@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)`}</CodeBlock>
          </div>

          {/* Section 3: Documentation Links */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              3. Apple Documentation Links
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Added <code>SeeAlso</code> documentation links to all main types
              for easier navigation to Apple's official StoreKit documentation.
            </p>
          </div>

          {/* References */}
          <details open style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              References
            </summary>
            <ul
              style={{
                marginTop: '0.5rem',
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <li>
                <a
                  href="https://developer.apple.com/documentation/storekit/product"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  StoreKit Product Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://developer.apple.com/documentation/storekit/in-app_purchase"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  In-App Purchase Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/pull/80"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PR #80 (https://github.com/hyodotdev/openiap/pull/80)
                </a>
              </li>
            </ul>
          </details>
        </div>
      ),
    },
    // Spec 1.3.17 / Google 1.3.28 - Feb 11, 2026
    {
      id: 'spec-1-3-17-google-1-3-28',
      date: new Date('2026-02-11'),
      element: (
        <div key="spec-1-3-17-google-1-3-28" style={noteCardStyle}>
          <AnchorLink id="spec-1-3-17-google-1-3-28" level="h4">
            📅 openiap-spec v1.3.17 / openiap-google v1.3.28 - Android
            BillingClient Enhancement
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1.5rem',
              color: 'var(--text-secondary)',
            }}
          >
            Added new fields from Google Play Billing Library 5.0+ and 7.0+ for
            offer details, installment plans, and pending subscription updates.
          </p>

          {/* Section 1: purchaseOptionId */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              1. <code>purchaseOptionId</code> for One-Time Purchase Offers
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Identifies which purchase option the user selected for one-time
              products with multiple offers.
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginTop: '0.5rem',
              }}
            >
              <a
                href="/docs/types/android/one-time-purchase-offer-detail-android"
                style={{ fontSize: '0.85rem' }}
              >
                <code>
                  ProductAndroidOneTimePurchaseOfferDetail.purchaseOptionId
                </code>
              </a>
              <a
                href="/docs/types/discount-offer"
                style={{ fontSize: '0.85rem' }}
              >
                <code>DiscountOffer.purchaseOptionIdAndroid</code>
              </a>
            </div>
          </div>

          {/* Section 2: InstallmentPlanDetailsAndroid */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              2. <code>InstallmentPlanDetailsAndroid</code> for Subscriptions
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Subscription installment plans - users pay over a commitment
              period (e.g., 12 monthly payments).
            </p>
            <CodeBlock language="graphql">{`type InstallmentPlanDetailsAndroid {
  commitmentPaymentsCount: Int!           # Initial commitment payments
  subsequentCommitmentPaymentsCount: Int! # Renewal commitment (0 = reverts to normal)
}`}</CodeBlock>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginTop: '0.5rem',
              }}
            >
              <a
                href="/docs/types/android/subscription-offer-android"
                style={{ fontSize: '0.85rem' }}
              >
                <code>
                  ProductSubscriptionAndroidOfferDetails.installmentPlanDetails
                </code>
              </a>
              <a
                href="/docs/types/subscription-offer"
                style={{ fontSize: '0.85rem' }}
              >
                <code>SubscriptionOffer.installmentPlanDetailsAndroid</code>
              </a>
            </div>
          </div>

          {/* Section 3: PendingPurchaseUpdateAndroid */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              3.{' '}
              <Link to="/docs/types/purchase">
                <code>PendingPurchaseUpdateAndroid</code>
              </Link>{' '}
              for Upgrades/Downgrades
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Track pending subscription plan changes that take effect at the
              end of the current billing period.
            </p>
            <CodeBlock language="graphql">{`type PendingPurchaseUpdateAndroid {
  products: [String!]!   # New product IDs user is switching to
  purchaseToken: String! # Token for the pending transaction
}`}</CodeBlock>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginTop: '0.5rem',
              }}
            >
              <a href="/docs/types/purchase" style={{ fontSize: '0.85rem' }}>
                <code>PurchaseAndroid.pendingPurchaseUpdateAndroid</code>
              </a>
            </div>
          </div>

          {/* References */}
          <details open style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              References
            </summary>
            <ul
              style={{
                marginTop: '0.5rem',
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <li>
                <a
                  href="https://developer.android.com/reference/com/android/billingclient/api/ProductDetails.OneTimePurchaseOfferDetails#getPurchaseOptionId()"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  getPurchaseOptionId() (7.0+)
                </a>
              </li>
              <li>
                <a
                  href="https://developer.android.com/reference/com/android/billingclient/api/ProductDetails.InstallmentPlanDetails"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  InstallmentPlanDetails (7.0+)
                </a>
              </li>
              <li>
                <a
                  href="https://developer.android.com/reference/com/android/billingclient/api/Purchase.PendingPurchaseUpdate"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PendingPurchaseUpdate (5.0+)
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/issues/77"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Issue #77
                </a>
              </li>
            </ul>
          </details>
        </div>
      ),
    },
    // Spec 1.3.16 / Apple 1.3.14 - Jan 26, 2026
    {
      id: 'spec-1-3-16-apple-1-3-14',
      date: new Date('2026-01-26'),
      element: (
        <div key="spec-1-3-16-apple-1-3-14" style={noteCardStyle}>
          <AnchorLink id="spec-1-3-16-apple-1-3-14" level="h4">
            📅 openiap-spec v1.3.16 / openiap-apple v1.3.14 -
            ExternalPurchaseCustomLink Support (iOS 18.1+)
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Added full support for Apple's{' '}
            <code>ExternalPurchaseCustomLink</code> API (iOS 18.1+) for apps
            using custom external purchase links with token-based reporting.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>1. New APIs</h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>isEligibleForExternalPurchaseCustomLinkIOS()</code> -
                Check if app can use ExternalPurchaseCustomLink API
              </li>
              <li>
                <code>getExternalPurchaseCustomLinkTokenIOS(tokenType)</code> -
                Get token for reporting to Apple's External Purchase Server API
              </li>
              <li>
                <code>showExternalPurchaseCustomLinkNoticeIOS(noticeType)</code>{' '}
                - Show CustomLink-specific disclosure notice sheet
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>2. New Types</h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>ExternalPurchaseCustomLinkTokenTypeIOS</code> - Token
                types: <code>acquisition</code>, <code>services</code>
              </li>
              <li>
                <code>ExternalPurchaseCustomLinkNoticeTypeIOS</code> - Notice
                types: <code>browser</code>
              </li>
              <li>
                <code>ExternalPurchaseCustomLinkTokenResultIOS</code> - Token
                result with <code>token</code> and <code>error</code>
              </li>
              <li>
                <code>ExternalPurchaseCustomLinkNoticeResultIOS</code> - Notice
                result with <code>continued</code> and <code>error</code>
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              3. Improved{' '}
              <Link to="/docs/apis/ios/present-external-purchase-notice-sheet-ios">
                <code>presentExternalPurchaseNoticeSheetIOS()</code>
              </Link>
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Now returns <code>externalPurchaseToken</code> field when user
              continues. This token is required for reporting transactions to
              Apple's External Purchase Server API.
            </p>
            <CodeBlock language="typescript">{`// Before
result.result  // "continue" or "dismissed"
result.error   // optional error

// After (v1.3.14+)
result.result                 // "continue" or "dismissed"
result.externalPurchaseToken  // Token string (when result is "continue")
result.error                  // optional error`}</CodeBlock>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>4. API Comparison</h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              <code>ExternalPurchase</code> (17.4+): Basic external purchase
              notice | <code>ExternalPurchaseCustomLink</code> (18.1+): Custom
              links with token-based reporting
            </p>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              References
            </summary>
            <ul
              style={{
                marginTop: '0.5rem',
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <li>
                <a
                  href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apple ExternalPurchaseCustomLink Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  token(for:) API Reference
                </a>
              </li>
              <li>
                <a
                  href="https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  showNotice(type:) API Reference
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hyochan/react-native-iap/discussions/3135"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Feature Request Discussion #3135
                </a>
              </li>
            </ul>
          </details>
        </div>
      ),
    },
    // Spec 1.3.15 / Google 1.3.27 / Apple 1.3.13 - Jan 21, 2026
    {
      id: 'spec-1-3-15-google-1-3-27-apple-1-3-13',
      date: new Date('2026-01-21'),
      element: (
        <div key="spec-1-3-15-google-1-3-27-apple-1-3-13" style={noteCardStyle}>
          <AnchorLink id="spec-1-3-15-google-1-3-27-apple-1-3-13" level="h4">
            📅 openiap-spec v1.3.15 / openiap-google v1.3.27 / openiap-apple
            v1.3.13 - Bug Fix
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Fixed incorrect <code>replacementModeConstant</code> mapping in{' '}
            <code>applySubscriptionProductReplacementParams</code>. The function
            was using values from the legacy{' '}
            <code>SubscriptionUpdateParams.ReplacementMode</code> API instead of
            the new{' '}
            <code>SubscriptionProductReplacementParams.ReplacementMode</code>{' '}
            API (Billing Library 8.1.0+). Issue:{' '}
            <a
              href="https://github.com/hyodotdev/openiap/issues/71"
              target="_blank"
              rel="noopener noreferrer"
            >
              #71
            </a>
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>Mode Value Changes</h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>CHARGE_FULL_PRICE</code>: 5 → 4
              </li>
              <li>
                <code>DEFERRED</code>: 6 → 5
              </li>
              <li>
                <code>KEEP_EXISTING</code>: 7 → 6
              </li>
            </ul>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              References
            </summary>
            <ul
              style={{
                marginTop: '0.5rem',
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <li>
                <a
                  href="https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  SubscriptionProductReplacementParams.ReplacementMode (Billing
                  8.1.0+)
                </a>
              </li>
              <li>
                <a
                  href="https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.SubscriptionUpdateParams.ReplacementMode"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  SubscriptionUpdateParams.ReplacementMode (Legacy)
                </a>
              </li>
            </ul>
          </details>
        </div>
      ),
    },
    // Spec 1.3.14 / Google 1.3.25 / Apple 1.3.13 - Jan 19, 2026
    {
      id: 'spec-1-3-14-google-1-3-25-apple-1-3-13',
      date: new Date('2026-01-19'),
      element: (
        <div key="spec-1-3-14-google-1-3-25-apple-1-3-13" style={noteCardStyle}>
          <AnchorLink id="spec-1-3-14-google-1-3-25-apple-1-3-13" level="h4">
            📅 openiap-spec v1.3.14 / openiap-google v1.3.25 / openiap-apple
            v1.3.13 - Breaking Changes & Bug Fixes
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Breaking changes for iOS subscription props, bug fixes for Android
            displayPrice, and Objective-C bridge updates.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              1. iOS - Subscription-Only Props Cleanup (Breaking Change)
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Removed subscription-specific fields from{' '}
              <Link to="/docs/types/request-purchase-props">
                <code>RequestPurchaseIosProps</code>
              </Link>
              . These fields now only exist in{' '}
              <Link to="/docs/types/request-purchase-props">
                <code>RequestSubscriptionIosProps</code>
              </Link>
              .
            </p>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>introductoryOfferEligibility</code> - Removed
              </li>
              <li>
                <code>promotionalOfferJWS</code> - Removed
              </li>
              <li>
                <code>winBackOffer</code> - Removed
              </li>
            </ul>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Migration: Use <code>requestSubscription()</code> API.
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              2. Known Issue - <code>introductoryOfferEligibility</code> API (
              <a
                href="https://github.com/hyodotdev/openiap/issues/68"
                target="_blank"
                rel="noopener noreferrer"
              >
                #68
              </a>
              )
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Current field uses <code>Boolean</code> type, but Apple's{' '}
              <a
                href="https://developer.apple.com/documentation/storekit/product/purchaseoption/introductoryoffereligibility(compactjws:)"
                target="_blank"
                rel="noopener noreferrer"
              >
                introductoryOfferEligibility(compactJWS:)
              </a>{' '}
              API requires a JWS string. Will be corrected in future release.
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              3. Android - Fix <code>displayPrice</code> for Subscriptions with
              Free Trials
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Fixed <code>displayPrice</code> returning "Free" or "$0.00"
              instead of actual base/recurring price.
            </p>
            <CodeBlock language="typescript">{`// Before (bug): displayPrice = "Free", price = 0.0
// After (fixed): displayPrice = "$9.99", price = 9.99
// Free trial info available in: subscriptionOffers[0].displayPrice`}</CodeBlock>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              4. Apple v1.3.13 - Objective-C Bridge Updates
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Updated <code>OpenIapModule+ObjC.swift</code> to expose new Swift
              async functions to Objective-C. Critical for kmp-iap. See{' '}
              <a
                href="https://github.com/hyodotdev/openiap/blob/main/knowledge/internal/04-platform-packages.md#objective-c-bridge-critical-for-kmp-iap"
                target="_blank"
                rel="noopener noreferrer"
              >
                Objective-C Bridge Documentation
              </a>
              .
            </p>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              References
            </summary>
            <ul
              style={{
                marginTop: '0.5rem',
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <li>
                <a
                  href="https://github.com/hyodotdev/openiap/issues/68"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Issue #68 - introductoryOfferEligibility API Correction
                </a>
              </li>
              <li>
                <a href="/docs/types/purchase">Purchase Types Documentation</a>
              </li>
            </ul>
          </details>
        </div>
      ),
    },
    // Spec 1.3.13 / Google 1.3.24 / Apple 1.3.11 - Jan 18, 2026
    {
      id: 'spec-1-3-13-google-1-3-24-apple-1-3-11',
      date: new Date('2026-01-18'),
      element: (
        <div key="spec-1-3-13-google-1-3-24-apple-1-3-11" style={noteCardStyle}>
          <AnchorLink id="spec-1-3-13-google-1-3-24-apple-1-3-11" level="h4">
            📅 openiap-spec v1.3.13 / openiap-google v1.3.24 / openiap-apple
            v1.3.11 - Platform API Gap Analysis
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            New iOS win-back offers, JWS promotional offers, and Android product
            status codes.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              1. iOS - Win-Back Offers (iOS 18+)
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Added support for{' '}
              <a
                href="https://developer.apple.com/documentation/storekit/product/subscriptionoffer"
                target="_blank"
                rel="noopener noreferrer"
              >
                win-back offers
              </a>{' '}
              to re-engage churned subscribers.
            </p>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>winBackOffer</code> - New field in purchase props
              </li>
              <li>
                <code>WinBackOfferInputIOS</code> - Input type with{' '}
                <code>offerId</code> field
              </li>
              <li>
                <code>SubscriptionOfferTypeIOS.WinBack</code> - New enum value
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              2. iOS - JWS Promotional Offers (iOS 15+, WWDC 2025)
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              New signature format using compact JWS string for promotional
              offers. Back-deployed to iOS 15. Requires Xcode 16.4+.
            </p>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>promotionalOfferJWS</code> - New field in purchase props
              </li>
              <li>
                <code>PromotionalOfferJWSInputIOS</code> - Input type with{' '}
                <code>offerId</code> and <code>jws</code> fields
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              3. iOS - Introductory Offer Eligibility Override (iOS 15+, WWDC
              2025)
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              <code>introductoryOfferEligibility</code> - Override system
              eligibility check. Set <code>true</code>/<code>false</code>/
              <code>nil</code> for system default. Requires Xcode 16.4+.
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              4. Android - Product Status Codes (Billing 8.0+)
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Product-level status codes indicating why products couldn't be
              fetched.
            </p>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>ProductStatusAndroid</code> - Enum: <code>Ok</code>,{' '}
                <code>NotFound</code>, <code>NoOffersAvailable</code>,{' '}
                <code>Unknown</code>
              </li>
              <li>
                <code>productStatusAndroid</code> - New field on{' '}
                <Link to="/docs/types/product">
                  <code>ProductAndroid</code>
                </Link>
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              5. Android - Auto Service Reconnection
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              <code>enableAutoServiceReconnection()</code> is now always enabled
              internally since OpenIAP uses Billing Library 8.3.0+.
            </p>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              References
            </summary>
            <ul
              style={{
                marginTop: '0.5rem',
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <li>
                <a
                  href="https://developer.apple.com/documentation/storekit/product/subscriptionoffer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apple StoreKit 2 - SubscriptionOffer
                </a>
              </li>
              <li>
                <a
                  href="https://developer.android.com/google/play/billing/release-notes#8-0-0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Play Billing 8.0.0 Release Notes
                </a>
              </li>
              <li>
                <a href="/docs/types/product">Product Types Documentation</a>
              </li>
            </ul>
          </details>
        </div>
      ),
    },
    // Spec 1.3.12 / Google 1.3.22 / Apple 1.3.10 - Jan 17, 2026
    {
      id: 'spec-1-3-12-google-1-3-22-apple-1-3-10',
      date: new Date('2026-01-17'),
      element: (
        <div key="spec-1-3-12-google-1-3-22-apple-1-3-10" style={noteCardStyle}>
          <AnchorLink id="spec-1-3-12-google-1-3-22-apple-1-3-10" level="h4">
            📅 openiap-spec v1.3.12 / openiap-google v1.3.22 / openiap-apple
            v1.3.10 - Standardized Offer Types
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Introduced standardized{' '}
            <Link to="/docs/types/discount-offer">
              <code>DiscountOffer</code>
            </Link>{' '}
            and{' '}
            <Link to="/docs/types/subscription-offer">
              <code>SubscriptionOffer</code>
            </Link>{' '}
            types for unified handling across iOS and Android.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              1.{' '}
              <Link to="/docs/types/discount-offer">
                <code>DiscountOffer</code>
              </Link>{' '}
              (One-time products)
            </h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>Cross-platform type for one-time purchase discounts</li>
              <li>
                Android fields: <code>offerTokenAndroid</code>,{' '}
                <code>fullPriceMicrosAndroid</code>,{' '}
                <code>percentageDiscountAndroid</code>
              </li>
              <li>
                Replaces deprecated{' '}
                <code>ProductAndroidOneTimePurchaseOfferDetail</code>
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              2.{' '}
              <Link to="/docs/types/subscription-offer">
                <code>SubscriptionOffer</code>
              </Link>
            </h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                Cross-platform type for subscription offers (introductory,
                promotional)
              </li>
              <li>
                Includes <code>paymentMode</code>: FreeTrial, PayAsYouGo,
                PayUpFront
              </li>
              <li>
                Replaces deprecated{' '}
                <code>ProductSubscriptionAndroidOfferDetails</code>,{' '}
                <Link to="/docs/types/ios/discount-offer-ios">
                  <code>DiscountOfferIOS</code>
                </Link>
                ,{' '}
                <Link to="/docs/types/ios/discount-ios">
                  <code>DiscountIOS</code>
                </Link>
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              3. New Fields on Product Types
            </h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>discountOffers: [DiscountOffer!]</code> - One-time product
                discounts
              </li>
              <li>
                <code>subscriptionOffers: [SubscriptionOffer!]</code> -
                Subscription offers
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              4. PaymentMode Logic Fix (Android)
            </h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>Zero price → FreeTrial (regardless of recurrenceMode)</li>
              <li>NON_RECURRING (3) with paid → PayUpFront</li>
              <li>
                FINITE_RECURRING (2) / INFINITE_RECURRING (1) with paid →
                PayAsYouGo
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>5. Deprecated Types</h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <del>
                  <code>ProductAndroidOneTimePurchaseOfferDetail</code>
                </del>{' '}
                →{' '}
                <Link to="/docs/types/discount-offer">
                  <code>DiscountOffer</code>
                </Link>
              </li>
              <li>
                <del>
                  <code>ProductSubscriptionAndroidOfferDetails</code>
                </del>{' '}
                →{' '}
                <Link to="/docs/types/subscription-offer">
                  <code>SubscriptionOffer</code>
                </Link>
              </li>
              <li>
                <del>
                  <code>oneTimePurchaseOfferDetailsAndroid</code>
                </del>{' '}
                → <code>discountOffers</code>
              </li>
              <li>
                <del>
                  <code>subscriptionOfferDetailsAndroid</code>
                </del>{' '}
                → <code>subscriptionOffers</code>
              </li>
            </ul>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              References
            </summary>
            <ul
              style={{
                marginTop: '0.5rem',
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <li>
                <a href="/docs/types/offer">Offer Types Documentation</a>
              </li>
              <li>
                <a href="/docs/features/discount">Discount Feature Guide</a>
              </li>
            </ul>
          </details>
        </div>
      ),
    },
    // Spec 1.3.11 / Google 1.3.20 / Apple 1.3.9 - Dec 28, 2025
    {
      id: 'spec-1-3-11-google-1-3-20-apple-1-3-9',
      date: new Date('2025-12-28'),
      element: (
        <div key="spec-1-3-11-google-1-3-21-apple-1-3-9" style={noteCardStyle}>
          <AnchorLink id="spec-1-3-11-google-1-3-21-apple-1-3-9" level="h4">
            📅 openiap-spec v1.3.11 / openiap-google v1.3.21 / openiap-apple
            v1.3.9 - PurchaseState Cleanup
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Simplified PurchaseState enum and deprecated
            AlternativeBillingModeAndroid in favor of BillingProgramAndroid.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              1. PurchaseState Simplified
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Removed unused <code>Failed</code>, <code>Restored</code>,{' '}
              <code>Deferred</code> states. Now: <code>Pending</code>,{' '}
              <code>Purchased</code>, <code>Unknown</code>
            </p>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>Failed</code> - Platforms return errors instead
              </li>
              <li>
                <code>Restored</code> - Returns as <code>Purchased</code> state
              </li>
              <li>
                <code>Deferred</code> - StoreKit 2 has no transaction state;
                Android uses <code>Pending</code>
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              2. API Consolidation - BillingProgramAndroid
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Deprecated{' '}
              <Link to="/docs/types/alternative-billing-types">
                <code>AlternativeBillingModeAndroid</code>
              </Link>{' '}
              in favor of unified{' '}
              <Link to="/docs/types/billing-programs">
                <code>BillingProgramAndroid</code>
              </Link>{' '}
              enum.
            </p>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>BillingProgramAndroid.USER_CHOICE_BILLING</code> - New
                enum value (7.0+)
              </li>
              <li>
                <del>
                  <Link to="/docs/types/alternative-billing-types">
                    <code>AlternativeBillingModeAndroid</code>
                  </Link>
                </del>{' '}
                - Deprecated
              </li>
              <li>
                <del>
                  <code>
                    InitConnectionConfig.alternativeBillingModeAndroid
                  </code>
                </del>{' '}
                - Deprecated
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>3. Migration</h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>alternativeBillingModeAndroid: USER_CHOICE</code> →{' '}
                <code>enableBillingProgramAndroid: USER_CHOICE_BILLING</code>
              </li>
              <li>
                <code>alternativeBillingModeAndroid: ALTERNATIVE_ONLY</code> →{' '}
                <code>enableBillingProgramAndroid: EXTERNAL_OFFER</code>
              </li>
            </ul>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              References
            </summary>
            <ul
              style={{
                marginTop: '0.5rem',
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <li>
                <a
                  href="https://developer.android.com/reference/com/android/billingclient/api/Purchase.PurchaseState"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Play Billing - Purchase.PurchaseState
                </a>
              </li>
              <li>
                <a
                  href="https://developer.apple.com/documentation/storekit/product/purchaseresult"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apple StoreKit 2 - Product.PurchaseResult
                </a>
              </li>
            </ul>
          </details>
        </div>
      ),
    },
    // Combined Release - Dec 28, 2025
    {
      id: 'release-dec-28-2025',
      date: new Date('2025-12-28'),
      element: (
        <div key="release-dec-28-2025" style={noteCardStyle}>
          <AnchorLink id="release-dec-28-2025" level="h4">
            📅 openiap-spec v1.3.10 / openiap-google v1.3.19 / openiap-apple
            v1.3.8 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-3-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.3.0 External Payments
            </a>
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            InitConnectionConfig enhancement, auto connection management for
            iOS, and External Payments program support.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              1. Spec v1.3.10 - InitConnectionConfig Enhancement
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Added{' '}
              <code>enableBillingProgramAndroid: BillingProgramAndroid</code>{' '}
              field for easier billing program setup during{' '}
              <Link to="/docs/apis/init-connection">
                <code>initConnection()</code>
              </Link>
              .
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              2. Apple v1.3.8 - Auto Connection Management
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              All API methods now automatically call{' '}
              <Link to="/docs/apis/init-connection">
                <code>initConnection()</code>
              </Link>{' '}
              internally. No need to manually call it before using any API.
              Backward compatible.
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              3. Google v1.3.19 - External Payments Program (Japan Only)
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Billing Library 8.3.0 introduces side-by-side choice between
              Google Play Billing and developer's external payment.
            </p>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>BillingProgramAndroid.EXTERNAL_PAYMENTS</code> - New
                billing program type
              </li>
              <li>
                <code>DeveloperBillingOptionParamsAndroid</code> - Configure
                external payment option
              </li>
              <li>
                <code>DeveloperProvidedBillingDetailsAndroid</code> - Contains
                externalTransactionToken
              </li>
              <li>
                <code>IapEvent.DeveloperProvidedBillingAndroid</code> - New
                event
              </li>
            </ul>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              References
            </summary>
            <ul
              style={{
                marginTop: '0.5rem',
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <li>
                <a
                  href="https://developer.android.com/google/play/billing/externalpaymentlinks"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  External Payment Links Documentation
                </a>
              </li>
              <li>
                <a href="/docs/features/external-purchase#external-payments-830---japan-only">
                  External Payments Implementation Guide
                </a>
              </li>
            </ul>
          </details>
        </div>
      ),
    },

    // v1.3.16 Billing Library 8.2.1 - Dec 24, 2025
    {
      id: 'v1.3.16-billing-821',
      date: new Date('2025-12-24'),
      element: (
        <div key="v1.3.16-billing-821" style={noteCardStyle}>
          <AnchorLink id="v1.3.16-billing-821" level="h4">
            📅 openiap-google v1.3.16 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-2-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.2.1
            </a>
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Upgraded from 8.1.0 to 8.2.1 with new Billing Programs API. Skipped
            8.2.0 due to bugs in <code>isBillingProgramAvailableAsync</code> and{' '}
            <code>createBillingProgramReportingDetailsAsync</code>.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>1. New APIs</h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <code>enableBillingProgram()</code> - Setup BillingClient for
                billing programs
              </li>
              <li>
                <code>isBillingProgramAvailableAsync()</code> - Determine user
                eligibility
              </li>
              <li>
                <code>createBillingProgramReportingDetailsAsync()</code> -
                Create external transaction token
              </li>
              <li>
                <code>launchExternalLink()</code> - Initiate external link
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>2. Deprecated APIs</h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                <del>
                  <code>enableExternalOffer()</code>
                </del>{' '}
                →{' '}
                <code>
                  enableBillingProgram(BillingProgramAndroid.ExternalOffer)
                </code>
              </li>
              <li>
                <del>
                  <code>isExternalOfferAvailableAsync()</code>
                </del>{' '}
                → <code>isBillingProgramAvailable()</code>
              </li>
              <li>
                <del>
                  <code>createExternalOfferReportingDetailsAsync()</code>
                </del>{' '}
                → <code>createBillingProgramReportingDetails()</code>
              </li>
              <li>
                <del>
                  <code>showExternalOfferInformationDialog()</code>
                </del>{' '}
                → <code>launchExternalLink()</code>
              </li>
            </ul>
          </div>

          <details open style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}
            >
              References
            </summary>
            <ul
              style={{
                marginTop: '0.5rem',
                paddingLeft: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <li>
                <a
                  href="https://developer.android.com/google/play/billing/release-notes#8-2-0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Billing Library 8.2.0 Release Notes
                </a>
              </li>
              <li>
                <a href="/docs/features/external-purchase">
                  External Purchase Guide
                </a>
              </li>
            </ul>
          </details>
        </div>
      ),
    },

    // v1.3.8 Kotlin null-safe casting - Dec 24, 2025
    {
      id: 'v1.3.8-kotlin-null-safe',
      date: new Date('2025-12-24'),
      element: (
        <div key="v1.3.8-kotlin-null-safe" style={noteCardStyle}>
          <AnchorLink id="v1.3.8-kotlin-null-safe" level="h4">
            📅 openiap-spec v1.3.8 - Kotlin Null-Safe Casting
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Fixed potential <code>TypeCastException</code> in generated Kotlin
            types by using safe casts (<code>as?</code>) instead of unsafe casts
            (<code>as</code>).
          </p>

          <ul
            style={{
              margin: '0.25rem 0',
              paddingLeft: '1.5rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              Lists now use <code>mapNotNull</code> with safe element casting
            </li>
            <li>
              Non-nullable fields provide sensible defaults (empty string,
              false, 0, emptyList)
            </li>
            <li>
              Prevents crashes when JSON keys are missing or contain unexpected
              null values
            </li>
          </ul>
        </div>
      ),
    },

    // v1.3.7 Advanced Commerce Data - Dec 23, 2025
    {
      id: 'v1.3.7-advanced-commerce',
      date: new Date('2025-12-23'),
      element: (
        <div key="v1.3.7-advanced-commerce" style={noteCardStyle}>
          <AnchorLink id="v1.3.7-advanced-commerce" level="h4">
            📅 openiap-spec v1.3.7 / openiap-apple v1.3.7 / openiap-google
            v1.3.15 - Advanced Commerce Data
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Added support for{' '}
            <a
              href="https://developer.apple.com/documentation/storekit/product/purchaseoption/custom(key:value:)"
              target="_blank"
              rel="noopener noreferrer"
            >
              StoreKit 2's Product.PurchaseOption.custom API
            </a>{' '}
            to pass attribution data during purchases.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              1. <code>advancedCommerceData</code> Field
            </h5>
            <ul
              style={{
                margin: '0.25rem 0',
                paddingLeft: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              <li>
                New optional field in{' '}
                <Link to="/docs/types/request-purchase-props">
                  <code>RequestPurchaseIosProps</code>
                </Link>{' '}
                and{' '}
                <Link to="/docs/types/request-purchase-props">
                  <code>RequestSubscriptionIosProps</code>
                </Link>
              </li>
              <li>
                Use cases: Campaign attribution, affiliate marketing,
                promotional code tracking
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              2. Deprecated{' '}
              <Link to="/docs/apis/ios/request-purchase-on-promoted-product-ios">
                <code>requestPurchaseOnPromotedProductIOS()</code>
              </Link>
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              In StoreKit 2, use <code>promotedProductListenerIOS</code> +{' '}
              <Link to="/docs/apis/request-purchase">
                <code>requestPurchase()</code>
              </Link>{' '}
              directly.
            </p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h5 style={{ margin: '0 0 0.25rem 0' }}>
              3. Android: <code>google</code> Field Support
            </h5>
            <p
              style={{
                margin: '0.25rem 0',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
              }}
            >
              Now supports <code>google</code> field with fallback to deprecated{' '}
              <code>android</code> field.
            </p>
          </div>
        </div>
      ),
    },

    // v1.3.5 Tag Management - Dec 16, 2025
    {
      id: 'v1.3.5-tag',
      date: new Date('2025-12-16'),
      element: (
        <div key="v1.3.5-tag" style={noteCardStyle}>
          <AnchorLink id="v1.3.5-tag" level="h4">
            📅 openiap-spec v1.3.5 / openiap-apple v1.3.5 - GitHub Release Tag
            Management Update
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            No API changes. Updated GitHub release tag management for Swift
            Package Manager (SPM) compatibility.
          </p>

          <ul
            style={{
              margin: '0.25rem 0',
              paddingLeft: '1.5rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <strong>Apple</strong>: Uses semver tags directly (e.g.,{' '}
              <code>1.3.5</code>) - Required for SPM
            </li>
            <li>
              <strong>Spec</strong>: Uses <code>spec-</code> prefix (e.g.,{' '}
              <code>spec-1.3.5</code>)
            </li>
            <li>
              <strong>Google</strong>: Uses <code>google-</code> prefix (e.g.,{' '}
              <code>google-1.3.5</code>)
            </li>
          </ul>
        </div>
      ),
    },

    // v1.3.4 Platform-Specific Verification - Dec 10, 2025
    {
      id: 'v1.3.4-verify',
      date: new Date('2025-12-10'),
      element: (
        <div key="v1.3.4-verify" style={noteCardStyle}>
          <AnchorLink id="v1.3.4-verify" level="h4">
            📅 openiap-spec v1.3.4 / openiap-google v1.3.14 / openiap-apple
            v1.3.2 - Platform-Specific Verification
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            <code>verifyPurchase</code> API refactored (Breaking Change). Now
            requires platform-specific options. <code>sku</code> moved inside
            each platform options.
          </p>

          <ul
            style={{
              margin: '0.25rem 0',
              paddingLeft: '1.5rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <code>VerifyPurchaseAppleOptions</code> - Apple App Store
              verification
            </li>
            <li>
              <code>VerifyPurchaseGoogleOptions</code> - Google Play with
              packageName, purchaseToken, accessToken
            </li>
            <li>
              <code>VerifyPurchaseHorizonOptions</code> - Meta Horizon (Quest)
              via S2S API
            </li>
            <li>
              <del>
                <code>androidOptions</code>
              </del>{' '}
              → Use <code>google</code> instead
            </li>
          </ul>

          <p style={{ fontSize: '0.9rem' }}>
            See:{' '}
            <a href="/docs/features/validation#verify-purchase">
              verifyPurchase API
            </a>
          </p>
        </div>
      ),
    },

    // v1.3.12 Billing Programs API - Dec 5, 2025
    {
      id: 'v1.3.12-billing',
      date: new Date('2025-12-05'),
      element: (
        <div key="v1.3.12-billing" style={noteCardStyle}>
          <AnchorLink id="v1.3.12-billing" level="h4">
            📅 openiap-google v1.3.12 / openiap-spec v1.3.2 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-2-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.2.0
            </a>{' '}
            Billing Programs API
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            New Billing Programs API (8.2.0+) and deprecated alternative billing
            APIs.
          </p>

          <ul
            style={{
              margin: '0.25rem 0',
              paddingLeft: '1.5rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <code>enableBillingProgram()</code>,{' '}
              <code>isBillingProgramAvailable()</code>,{' '}
              <code>createBillingProgramReportingDetails()</code>,{' '}
              <code>launchExternalLink()</code>
            </li>
            <li>
              <del>
                <code>checkAlternativeBillingAvailability()</code>
              </del>{' '}
              → <code>isBillingProgramAvailable()</code>
            </li>
            <li>
              <del>
                <code>showAlternativeBillingInformationDialog()</code>
              </del>{' '}
              → <code>launchExternalLink()</code>
            </li>
          </ul>

          <p style={{ fontSize: '0.9rem' }}>
            See:{' '}
            <a href="/docs/features/external-purchase">
              External Purchase Guide
            </a>
          </p>
        </div>
      ),
    },

    // v1.3.11 Billing 8.1.0 Support - Nov 15, 2025
    {
      id: 'v1.3.11-billing',
      date: new Date('2025-11-15'),
      element: (
        <div key="v1.3.11-billing" style={noteCardStyle}>
          <AnchorLink id="v1.3.11-billing" level="h4">
            📅 openiap-google v1.3.11 / openiap-spec v1.3.1 -{' '}
            <a
              href="https://developer.android.com/google/play/billing/release-notes#8-1-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Play Billing 8.1.0
            </a>
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Billing Library 8.0.0 → 8.1.0, minSdk 21 → 23, Kotlin 2.0.21 →
            2.2.0.
          </p>

          <ul
            style={{
              margin: '0.25rem 0',
              paddingLeft: '1.5rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <code>isSuspendedAndroid</code> - Detect suspended subscriptions
              due to payment failures
            </li>
            <li>
              <code>PreorderDetailsAndroid</code> - New type for pre-order
              products
            </li>
            <li>
              <code>oneTimePurchaseOfferDetailsAndroid</code> - Changed to array
              type
            </li>
          </ul>
        </div>
      ),
    },

    // v1.3.0 Platform Props - Oct 15, 2025
    {
      id: 'v1.3.0-platform',
      date: new Date('2025-10-15'),
      element: (
        <div key="v1.3.0-platform" style={noteCardStyle}>
          <AnchorLink id="v1.3.0-platform" level="h4">
            📅 openiap v1.3.0 - Platform Props & Store Field Updates
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Breaking Changes:{' '}
            <del>
              <code>Purchase.platform</code>
            </del>{' '}
            → <code>store</code>,{' '}
            <del>
              <code>ios/android</code>
            </del>{' '}
            props → <code>apple/google</code>.
          </p>

          <ul
            style={{
              margin: '0.25rem 0',
              paddingLeft: '1.5rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              New: <code>verifyPurchaseWithProvider</code> - Verification with
              external providers like IAPKit
            </li>
          </ul>
        </div>
      ),
    },

    // v1.2.6 validateReceipt → verifyPurchase - Sep 20, 2025
    {
      id: 'v1.2.6-verify',
      date: new Date('2025-09-20'),
      element: (
        <div key="v1.2.6-verify" style={noteCardStyle}>
          <AnchorLink id="v1.2.6-verify" level="h4">
            📅 openiap v1.2.6 - <del>validateReceipt</del> → verifyPurchase
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Terminology alignment with modern StoreKit 2. "Receipt Validation"
            was Apple's legacy term. Unified interface across iOS and Android.
          </p>
        </div>
      ),
    },

    // v1.2.0 Version Alignment - Sep 1, 2025
    {
      id: 'v1.2.0-alignment',
      date: new Date('2025-09-01'),
      element: (
        <div key="v1.2.0-alignment" style={noteCardStyle}>
          <AnchorLink id="v1.2.0-alignment" level="h4">
            📅 openiap v1.2.0 - Version Alignment & Alternative Billing
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            Version jumped from 1.0.12 to 1.2.0 to align with native libraries.
            iOS External Purchase & Android Alternative Billing support.
          </p>
        </div>
      ),
    },

    // openiap-spec 1.0.12 - External Purchase Support - Aug 25, 2025
    {
      id: 'spec-1.0.12-external',
      date: new Date('2025-08-25'),
      element: (
        <div key="spec-1.0.12-external" style={noteCardStyle}>
          <AnchorLink id="spec-1.0.12-external" level="h4">
            📅 openiap-spec 1.0.12 - External Purchase Support
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            iOS External Purchase (iOS 17.4+, 18.2+) and Android Alternative
            Billing (Billing Library 6.2+/7.0+).
          </p>

          <ul
            style={{
              margin: '0.25rem 0',
              paddingLeft: '1.5rem',
              fontSize: '0.9rem',
            }}
          >
            <li>
              <Link to="/docs/apis/ios/can-present-external-purchase-notice-ios">
                <code>canPresentExternalPurchaseNoticeIOS()</code>
              </Link>
              ,{' '}
              <Link to="/docs/apis/ios/present-external-purchase-notice-sheet-ios">
                <code>presentExternalPurchaseNoticeSheetIOS()</code>
              </Link>
              ,{' '}
              <Link to="/docs/apis/ios/present-external-purchase-link-ios">
                <code>presentExternalPurchaseLinkIOS()</code>
              </Link>
            </li>
          </ul>
        </div>
      ),
    },

    // Subscription Status APIs - Aug 15, 2025
    {
      id: 'subscription-status-apis',
      date: new Date('2025-08-15'),
      element: (
        <div key="subscription-status-apis" style={noteCardStyle}>
          <AnchorLink id="subscription-status-apis" level="h4">
            📅 August 2025 - Subscription Status APIs
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            New standardized APIs:{' '}
            <Link to="/docs/apis/get-active-subscriptions">
              <code>getActiveSubscriptions()</code>
            </Link>
            ,{' '}
            <Link to="/docs/apis/has-active-subscriptions">
              <code>hasActiveSubscriptions()</code>
            </Link>{' '}
            - automatic detection without requiring product IDs.
          </p>
        </div>
      ),
    },

    // Billing Library v5 Deprecated - Aug 31, 2024
    {
      id: 'billing-v5-deprecated',
      date: new Date('2024-08-31'),
      element: (
        <div key="billing-v5-deprecated" style={noteCardStyle}>
          <AnchorLink id="billing-v5-deprecated" level="h4">
            📅 August 31, 2024 - Billing Library v5 Deprecated
          </AnchorLink>

          <p
            style={{
              marginTop: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
            }}
          >
            All apps must use Google Play Billing Library v6.0.1 or later.
            Deadline extended to November 1, 2024.
          </p>
        </div>
      ),
    },
  ];

  // Sort by date (newest first)
  const sortedNotes = [...allNotes].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const itemsPerPage = 5;

  // Calculate initial page based on URL hash
  const initialPage = useMemo(() => {
    const hashId = getHashId();
    if (!hashId) return 1;

    const noteIndex = sortedNotes.findIndex((note) => note.id === hashId);
    if (noteIndex === -1) return 1;

    return Math.floor(noteIndex / itemsPerPage) + 1;
  }, [sortedNotes]);

  return (
    <div className="doc-page">
      <SEO
        title="Releases"
        description="Release notes for OpenIAP packages and framework libraries - new features, bug fixes, and breaking changes."
        path="/docs/updates/releases"
        keywords="IAP updates, validateReceipt, verifyPurchase, receipt validation, purchase verification, migration guide"
      />
      <h1>Releases</h1>
      <p>Release notes for OpenIAP packages and framework libraries.</p>

      <Pagination itemsPerPage={itemsPerPage} initialPage={initialPage}>
        {sortedNotes.map((note) => (
          <section key={note.id}>{note.element}</section>
        ))}
      </Pagination>
    </div>
  );
}

export default Releases;
