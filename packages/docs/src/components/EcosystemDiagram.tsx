import { Link } from 'react-router-dom';
import { IAPKIT_LOGO_PATH, IAPKIT_URL, trackIapKitClick } from '../lib/config';
import { LIBRARIES, type FrameworkLibraryName } from '../lib/images';
import { OPENIAP_VERSIONS } from '../lib/versioning';
import '../styles/ecosystem-diagram.css';

// =============================================================================
// Ecosystem Diagram Data
// =============================================================================
// Framework libraries are deliberately NOT listed in this file. Membership,
// order, display name, version, setup path and the fallback framework mark all
// come from LIBRARIES in src/lib/images.ts (SSOT, see CONVENTION.md "Framework
// Listings"). Adding a library there makes it show up here with no edit below.
//
// Artwork lives in public/logos as <= 256px .webp files. To swap an image, drop
// the new file in and repoint the matching entry.
// =============================================================================

const GITHUB = 'https://github.com/hyodotdev/openiap';
const GITHUB_TREE = `${GITHUB}/tree/main`;

/** Rendered when a library ships no OpenIAP package artwork of its own. */
const FALLBACK_PACKAGE_ICON = '/logos/openiap.webp';

/** Package artwork per framework library. Missing key -> FALLBACK_PACKAGE_ICON. */
const PACKAGE_ICONS: Partial<Record<FrameworkLibraryName, string>> = {
  'expo-iap': '/logos/expo-iap.webp',
  'react-native-iap': '/logos/react-native-iap.webp',
  flutter_inapp_purchase: '/logos/flutter_inapp_purchase.webp',
  'kmp-iap': '/logos/kmp-iap.webp',
  'maui-iap': '/logos/maui-iap.webp',
  'godot-iap': '/logos/godot-iap.webp',
};

/** Target framework mark. Missing key -> lib.image from LIBRARY_IMAGES. */
const FRAMEWORK_MARKS: Partial<Record<FrameworkLibraryName, string>> = {
  'expo-iap': '/logos/expo.webp',
  'react-native-iap': '/logos/react.webp',
  flutter_inapp_purchase: '/logos/flutter.webp',
  'kmp-iap': '/logos/kmp.webp',
  'godot-iap': '/logos/godot.webp',
  // maui-iap falls back to /frameworks/maui.webp.
};

/** Flat black artwork - has to flip to white in dark mode. */
const BLACK_INK_ART = new Set(['/logos/apple.webp', '/logos/expo.webp']);

/** Flat white artwork - has to flip to black in light mode. */
const WHITE_INK_ART = new Set(['/logos/horizonos.webp']);

/**
 * Marks whose glyph is narrower than the square box it is fitted into, so they
 * read smaller than a full-bleed neighbour even at the same height. Apple's
 * mark renders 18.5px wide next to Horizon OS's 22px ring; this scales the box
 * so the drawn widths match.
 */
const COMPACT_MARKS = new Set(['/logos/apple.webp']);

/** Artwork that already carries its own opaque square background. */
const SQUARE_ART = new Set([
  '/logos/openiap-gql.webp',
  '/logos/expo-iap.webp',
  '/logos/react-native-iap.webp',
  '/logos/flutter_inapp_purchase.webp',
  '/logos/kmp-iap.webp',
  '/frameworks/maui.webp',
  IAPKIT_LOGO_PATH,
]);

interface DiagramMark {
  src: string;
  label: string;
}

interface DiagramNode {
  id: string;
  name: string;
  note: string;
  icon: string;
  href: string;
  marks?: DiagramMark[];
  onClick?: () => void;
}

const SPEC_NODES: DiagramNode[] = [
  {
    id: 'openiap',
    name: 'openiap',
    note: `The specification · ${OPENIAP_VERSIONS.spec}`,
    icon: '/logos/openiap.webp',
    href: GITHUB,
  },
  {
    id: 'openiap-gql',
    name: 'openiap-gql',
    note: 'GraphQL schema · type SSOT',
    icon: '/logos/openiap-gql.webp',
    href: `${GITHUB_TREE}/packages/gql`,
  },
];

const CORE_NODES: DiagramNode[] = [
  {
    id: 'openiap-google',
    name: 'openiap-google',
    note: `Kotlin · Play Billing · ${OPENIAP_VERSIONS.google}`,
    icon: '/logos/openiap-google.webp',
    href: `${GITHUB_TREE}/packages/google`,
    marks: [
      { src: '/logos/android.webp', label: 'Android' },
      { src: '/logos/horizonos.webp', label: 'Horizon OS' },
    ],
  },
  {
    id: 'openiap-apple',
    name: 'openiap-apple',
    note: `Swift · StoreKit 2 · ${OPENIAP_VERSIONS.apple}`,
    icon: '/logos/openiap-apple.webp',
    href: `${GITHUB_TREE}/packages/apple`,
    marks: [{ src: '/logos/apple.webp', label: 'iOS, macOS and tvOS' }],
  },
];

const IAPKIT_NODE: DiagramNode = {
  id: 'iapkit',
  name: 'IAPKit',
  note: 'Optional verification · entitlements · store sync · MCP',
  icon: IAPKIT_LOGO_PATH,
  href: IAPKIT_URL,
  onClick: trackIapKitClick,
};

function artClass(src: string, base: string): string {
  const classes = [base];

  if (SQUARE_ART.has(src)) {
    classes.push('eco-art--square');
  }

  if (BLACK_INK_ART.has(src)) {
    classes.push('eco-art--black-ink');
  }

  if (WHITE_INK_ART.has(src)) {
    classes.push('eco-art--white-ink');
  }

  if (COMPACT_MARKS.has(src)) {
    classes.push('eco-art--compact');
  }

  return classes.join(' ');
}

function NodeCard({
  node,
  className,
}: {
  node: DiagramNode;
  className?: string;
}) {
  return (
    <a
      className={`eco-node no-icon${className ? ` ${className}` : ''}`}
      href={node.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={node.onClick}
    >
      <img
        className={artClass(node.icon, 'eco-icon')}
        src={node.icon}
        alt=""
        loading="lazy"
      />
      <span className="eco-node-text">
        <span className="eco-node-name">{node.name}</span>
        <span className="eco-node-note">{node.note}</span>
      </span>
      {node.marks ? (
        <span className="eco-node-marks">
          {node.marks.map((mark) => (
            <img
              key={mark.src}
              className={artClass(mark.src, 'eco-mark')}
              src={mark.src}
              alt={mark.label}
              title={mark.label}
              loading="lazy"
            />
          ))}
        </span>
      ) : null}
    </a>
  );
}

function Rail({
  variant,
  label,
}: {
  variant: 'a' | 'b' | 'bypass' | 'iapkit' | 'iapkit-core';
  label?: string;
}) {
  return (
    <div className={`eco-rail eco-rail--${variant}`} aria-hidden="true">
      {label ? <span className="eco-rail-label">{label}</span> : null}
    </div>
  );
}

function EcosystemDiagram() {
  return (
    <figure className="eco-diagram">
      <div className="eco-grid">
        {/* display: contents - the two spec nodes are grid items of .eco-grid
            so the gutter arrow can sit on openiap-gql's own row. */}
        <section className="eco-spec" aria-labelledby="eco-spec">
          <h3 className="eco-hidden-title" id="eco-spec">
            Spec
          </h3>
          <NodeCard node={SPEC_NODES[0]} className="eco-node--root" />
          <span className="eco-flow-arrow" aria-hidden="true" />
          <NodeCard node={SPEC_NODES[1]} className="eco-node--gql" />
        </section>

        <Rail variant="a" label="generate types" />

        <section className="eco-band eco-band--core" aria-labelledby="eco-core">
          <h3 className="eco-band-title" id="eco-core">
            Core
          </h3>
          <div className="eco-band-body eco-band-body--pair">
            {CORE_NODES.map((node) => (
              <NodeCard key={node.id} node={node} />
            ))}
          </div>
        </section>

        <Rail variant="bypass" label="generate types" />
        <Rail variant="b" label="bundled" />

        <section className="eco-band eco-band--libs" aria-labelledby="eco-libs">
          <h3 className="eco-band-title" id="eco-libs">
            Libraries
          </h3>
          <a
            className="eco-band-chip no-icon"
            href={`${GITHUB_TREE}/packages/gql`}
            target="_blank"
            rel="noopener noreferrer"
          >
            types from openiap-gql
          </a>
          <div className="eco-band-body eco-band-body--grid">
            {LIBRARIES.map((lib) => {
              const icon = PACKAGE_ICONS[lib.name] ?? FALLBACK_PACKAGE_ICON;
              const mark = FRAMEWORK_MARKS[lib.name] ?? lib.image;

              return (
                <div
                  key={lib.name}
                  className={`eco-library${
                    lib.modules?.length ? ' eco-library--has-modules' : ''
                  }`}
                >
                  <Link
                    className="eco-node eco-node--library"
                    to={lib.setupPath}
                  >
                    <img
                      className={artClass(icon, 'eco-icon')}
                      src={icon}
                      alt=""
                      loading="lazy"
                    />
                    <span className="eco-node-text">
                      <span className="eco-node-name">{lib.displayName}</span>
                      <span className="eco-node-note">{lib.description}</span>
                      {lib.modules?.length ? (
                        <span className="eco-node-module-count">
                          {lib.modules.length}{' '}
                          {lib.modules.length === 1 ? 'module' : 'modules'}
                          <span aria-hidden="true"> ↓</span>
                        </span>
                      ) : null}
                    </span>
                    <span className="eco-node-marks">
                      <span className="eco-node-version">{lib.version}</span>
                      <img
                        className={artClass(mark, 'eco-mark')}
                        src={mark}
                        alt={lib.frameworkName}
                        title={lib.frameworkName}
                        loading="lazy"
                      />
                    </span>
                  </Link>
                  {lib.modules?.length ? (
                    <div
                      className="eco-modules"
                      role="group"
                      aria-label={`${lib.displayName} modules`}
                    >
                      <div className="eco-modules-inner">
                        <span className="eco-modules-label">Modules</span>
                        {lib.modules.map((module) => (
                          <Link
                            key={module.name}
                            className="eco-module"
                            to={module.setupPath}
                          >
                            <span className="eco-module-name">
                              {module.name}
                            </span>
                            <span className="eco-module-description">
                              {module.description}
                            </span>
                            <span
                              className="eco-module-arrow"
                              aria-hidden="true"
                            >
                              →
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <a className="eco-more" href="mailto:hyo@hyo.dev">
              and more … join the ecosystem
            </a>
          </div>
        </section>

        <Rail variant="iapkit-core" />
        <Rail variant="iapkit" label="optional backend" />

        <section
          className="eco-band eco-band--iapkit"
          aria-labelledby="eco-iapkit"
        >
          <h3 className="eco-band-title" id="eco-iapkit">
            Infrastructure
          </h3>
          <div className="eco-iapkit-body">
            <NodeCard node={IAPKIT_NODE} className="eco-node--iapkit" />
          </div>
        </section>
      </div>

      <figcaption className="eco-caption">
        <strong>openiap-gql</strong> generates the type system for the core
        native packages <em>and</em> for every framework library, and the core
        packages are bundled into each library. <strong>IAPKit</strong> is the
        optional hosted layer for purchase verification, entitlements, store
        notifications, and product operations, and the core packages can use it
        directly without a framework library. Select any node to open its
        documentation or project.
      </figcaption>
    </figure>
  );
}

export default EcosystemDiagram;
