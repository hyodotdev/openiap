import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Github,
  MessageSquareText,
  RotateCcw,
  Route,
  Search,
  Video,
} from 'lucide-react';
import SEO from '../components/SEO';
import {
  COMMUNITY_RESOURCES,
  type CommunityResource,
  type Ecosystem,
  type ResourceSourceKind,
  type ResourceType,
} from '../lib/communityResources';
import {
  LIBRARIES,
  LIBRARY_IMAGES,
  type FrameworkLibraryName,
} from '../lib/images';
import { SHOWCASE_APPS } from '../lib/showcase';
import { SHOWCASE_ISSUE_URL } from '../components/ShowcaseCards';

interface EcosystemMeta {
  id: Ecosystem;
  label: string;
  module: string;
  image: string;
}

interface ResourceTypeMeta {
  id: ResourceType;
  label: string;
}

interface ResourceRowProps {
  resource: CommunityResource;
}

const EDIT_DATA_URL =
  'https://github.com/hyodotdev/openiap/edit/main/packages/docs/src/lib/communityResources.ts';
const CONTRIBUTION_GUIDE_URL =
  'https://github.com/hyodotdev/openiap/blob/main/packages/docs/COMMUNITY_RESOURCES.md';
const RESOURCES_PER_PAGE = 20;

const ECOSYSTEM_BY_LIBRARY = {
  'expo-iap': 'expo',
  'react-native-iap': 'react-native',
  flutter_inapp_purchase: 'flutter',
  'kmp-iap': 'kmp',
  'maui-iap': 'maui',
  'godot-iap': 'godot',
} as const satisfies Record<FrameworkLibraryName, Ecosystem>;

const ECOSYSTEMS: EcosystemMeta[] = [
  {
    id: 'openiap',
    label: 'OpenIAP',
    module: 'OpenIAP ecosystem',
    image: '/logo.webp',
  },
  ...LIBRARIES.map((library) => ({
    id: ECOSYSTEM_BY_LIBRARY[library.name],
    label: library.frameworkName,
    module: library.displayName,
    image: library.image,
  })),
  {
    id: 'apple',
    label: 'Apple / Swift',
    module: 'openiap-apple',
    image: LIBRARY_IMAGES['openiap-apple'],
  },
  {
    id: 'android',
    label: 'Android / Kotlin',
    module: 'openiap-google',
    image: LIBRARY_IMAGES['openiap-google'],
  },
  {
    id: 'iapkit',
    label: 'IAPKit',
    module: 'IAPKit',
    image: '/iapkit.webp',
  },
];

const RESOURCE_TYPES: ResourceTypeMeta[] = [
  { id: 'article', label: 'Articles' },
  { id: 'video', label: 'Videos' },
  { id: 'community', label: 'Community' },
  { id: 'documentation', label: 'Documentation' },
];

const AVAILABLE_ECOSYSTEMS = ECOSYSTEMS.filter((ecosystem) =>
  COMMUNITY_RESOURCES.some((resource) =>
    resource.ecosystems.includes(ecosystem.id)
  )
);

function getEcosystemMeta(ecosystem: Ecosystem): EcosystemMeta {
  return (
    ECOSYSTEMS.find((item) => item.id === ecosystem) ?? {
      id: ecosystem,
      label: ecosystem,
      module: ecosystem,
      image: '/logo.webp',
    }
  );
}

function getResourceTypeLabel(type: ResourceType): string {
  return RESOURCE_TYPES.find((item) => item.id === type)?.label ?? type;
}

function getSourceKindLabel(sourceKind: ResourceSourceKind): string {
  const labels: Record<ResourceSourceKind, string> = {
    official: 'Official docs',
    company: 'Engineering',
    independent: 'Independent',
    community: 'Community',
  };

  return labels[sourceKind];
}

function getResourceTypeIcon(type: ResourceType): ReactNode {
  const iconProps = { size: 15, strokeWidth: 1.9, 'aria-hidden': true };

  switch (type) {
    case 'article':
      return <FileText {...iconProps} />;
    case 'video':
      return <Video {...iconProps} />;
    case 'community':
      return <MessageSquareText {...iconProps} />;
    case 'documentation':
      return <BookOpen {...iconProps} />;
  }
}

function matchesQuery(resource: CommunityResource, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    resource.title,
    resource.author,
    resource.organization,
    resource.platform,
    resource.summary,
    resource.seriesLabel,
    ...resource.ecosystems.map(
      (ecosystem) => getEcosystemMeta(ecosystem).label
    ),
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function ResourceRow({ resource }: ResourceRowProps) {
  const ecosystemLabels = resource.ecosystems
    .map((ecosystem) => getEcosystemMeta(ecosystem).label)
    .join(' · ');

  return (
    <li className="cr-resource-row">
      <div className="cr-resource-kind">
        <span>
          {getResourceTypeIcon(resource.type)}
          {getResourceTypeLabel(resource.type)}
        </span>
        <small>{getSourceKindLabel(resource.sourceKind)}</small>
      </div>

      <article className="cr-resource-content">
        <h2>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${resource.title} (opens in a new tab)`}
          >
            {resource.title}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </h2>

        <p className="cr-resource-meta">
          <span>{resource.author ?? resource.organization}</span>
          {resource.author && resource.organization && (
            <span>{resource.organization}</span>
          )}
          <span>{resource.platform}</span>
          <span>{ecosystemLabels}</span>
          {resource.seriesLabel && <span>{resource.seriesLabel}</span>}
        </p>

        <p className="cr-resource-summary">{resource.summary}</p>

        {resource.relatedLinks && resource.relatedLinks.length > 0 && (
          <div className="cr-related-links" aria-label="Related editions">
            <span>Related</span>
            {resource.relatedLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </article>
    </li>
  );
}

function CommunityResources() {
  const [selectedEcosystem, setSelectedEcosystem] = useState<Ecosystem | 'all'>(
    'all'
  );
  const [selectedType, setSelectedType] = useState<ResourceType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredResources = useMemo(
    () =>
      COMMUNITY_RESOURCES.filter((resource) => {
        const matchesEcosystem =
          selectedEcosystem === 'all' ||
          resource.ecosystems.includes(selectedEcosystem);
        const matchesType =
          selectedType === 'all' || resource.type === selectedType;

        return matchesEcosystem && matchesType && matchesQuery(resource, query);
      }),
    [query, selectedEcosystem, selectedType]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredResources.length / RESOURCES_PER_PAGE)
  );
  const pageStart = (currentPage - 1) * RESOURCES_PER_PAGE;
  const visibleResources = filteredResources.slice(
    pageStart,
    pageStart + RESOURCES_PER_PAGE
  );
  const visibleStart = filteredResources.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(
    pageStart + RESOURCES_PER_PAGE,
    filteredResources.length
  );

  const goToPage = (page: number): void => {
    setCurrentPage(page);
    requestAnimationFrame(() => {
      document
        .getElementById('resource-library')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const resetFilters = (): void => {
    setSelectedEcosystem('all');
    setSelectedType('all');
    setQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    selectedEcosystem !== 'all' || selectedType !== 'all' || query.length > 0;

  return (
    <div className="community-resources-page">
      <SEO
        title="Community Resources"
        description="Explore community-created OpenIAP resources, including articles, tutorials, videos, ecosystem documentation, and implementation guides for React Native, Expo, Flutter, Godot, and more."
        path="/community-resources"
        image="/community-resources-og.webp"
        keywords="OpenIAP community resources, react-native-iap tutorials, expo-iap guides, flutter_inapp_purchase articles, godot-iap resources"
      />

      <header className="cr-header">
        <div className="cr-shell">
          <div className="cr-community-banner">
            <img src="/community-resources-banner.webp" alt="" />
            <div className="cr-community-banner-copy">
              <p className="cr-community-banner-kicker">OpenIAP community</p>
              <h1>Community Resources</h1>
              <p className="cr-community-banner-lede">
                Articles, tutorials, videos, and documentation from across the
                OpenIAP ecosystem.
              </p>
            </div>
          </div>
          <nav className="cr-section-nav" aria-label="Community page sections">
            <a href="#resources">
              <span className="cr-section-nav-icon" aria-hidden="true">
                <BookOpen size={17} />
              </span>
              <span>
                <strong>Community resources</strong>
                <small>Articles, guides, videos, and docs</small>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </a>
            <Link to="/tutorials">
              <span className="cr-section-nav-icon" aria-hidden="true">
                <Route size={17} />
              </span>
              <span>
                <strong>Tutorials</strong>
                <small>From store setup to verified purchase</small>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
            <a href="#apps">
              <span className="cr-section-nav-icon" aria-hidden="true">
                <Boxes size={17} />
              </span>
              <span>
                <strong>Community apps</strong>
                <small>Products shipping with OpenIAP</small>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </a>
          </nav>
        </div>
      </header>

      <div className="cr-main">
        <div className="cr-shell">
          <section
            id="resources"
            className="cr-library"
            aria-labelledby="resource-library"
          >
            <div className="cr-library-heading">
              <div>
                <h2 id="resource-library">Resource library</h2>
                <p>
                  Community-maintained links. Inclusion does not imply a
                  partnership or endorsement.
                </p>
              </div>
              <p className="cr-page-range" aria-live="polite">
                <strong>
                  {visibleStart}–{visibleEnd}
                </strong>{' '}
                of {filteredResources.length}
              </p>
            </div>

            <div className="cr-controls">
              <label className="cr-search-field">
                <span>Search</span>
                <span className="cr-search-input">
                  <Search size={17} aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Title, author, or topic"
                  />
                </span>
              </label>

              <label>
                <span>Ecosystem</span>
                <div className="cr-select-input">
                  <select
                    value={selectedEcosystem}
                    onChange={(event) => {
                      setSelectedEcosystem(
                        event.target.value as Ecosystem | 'all'
                      );
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">All ecosystems</option>
                    {AVAILABLE_ECOSYSTEMS.map((ecosystem) => (
                      <option key={ecosystem.id} value={ecosystem.id}>
                        {ecosystem.label}
                      </option>
                    ))}
                  </select>
                  <div className="cr-select-icon" aria-hidden="true">
                    <ChevronDown size={16} strokeWidth={1.8} />
                  </div>
                </div>
              </label>

              <label>
                <span>Type</span>
                <div className="cr-select-input">
                  <select
                    value={selectedType}
                    onChange={(event) => {
                      setSelectedType(
                        event.target.value as ResourceType | 'all'
                      );
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">All types</option>
                    {RESOURCE_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <div className="cr-select-icon" aria-hidden="true">
                    <ChevronDown size={16} strokeWidth={1.8} />
                  </div>
                </div>
              </label>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="cr-reset-button"
                onClick={resetFilters}
              >
                <RotateCcw size={14} aria-hidden="true" />
                Reset filters
              </button>
            )}

            {filteredResources.length > 0 ? (
              <ul className="cr-resource-list">
                {visibleResources.map((resource) => (
                  <ResourceRow key={resource.id} resource={resource} />
                ))}
              </ul>
            ) : (
              <div className="cr-empty-state">
                <Search size={24} aria-hidden="true" />
                <h2>No matching resources</h2>
                <p>Try a broader search or reset the filters.</p>
                <button type="button" onClick={resetFilters}>
                  Reset filters
                </button>
              </div>
            )}

            {filteredResources.length > RESOURCES_PER_PAGE && (
              <nav className="cr-pagination" aria-label="Resource pages">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Previous resource page"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  Previous
                </button>
                <div>
                  {Array.from({ length: totalPages }, (_, index) => {
                    const page = index + 1;

                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToPage(page)}
                        aria-label={`Resource page ${page}`}
                        aria-current={currentPage === page ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Next resource page"
                >
                  Next
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </nav>
            )}
          </section>

          <section
            id="apps"
            className="cr-apps"
            aria-labelledby="community-apps"
          >
            <div className="cr-apps-heading">
              <div>
                <p>Apps in the wild</p>
                <h2 id="community-apps">Built with OpenIAP</h2>
              </div>
              <p>
                Products using OpenIAP libraries across iOS, Android, and the
                web.
              </p>
            </div>

            <div className="cr-app-list">
              {SHOWCASE_APPS.map((app, index) => (
                <article key={app.name} className="cr-app-row">
                  <span className="cr-app-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <img
                    src={app.logo}
                    alt={`${app.name} app icon`}
                    width={60}
                    height={60}
                    loading="lazy"
                  />
                  <div className="cr-app-copy">
                    <h3>{app.name}</h3>
                    <p>{app.tagline}</p>
                  </div>
                  <div className="cr-app-meta">
                    <span>{app.library}</span>
                    <div aria-label={`${app.name} links`}>
                      {app.ios ? (
                        <a href={app.ios} target="_blank" rel="noreferrer">
                          iOS <ArrowUpRight size={11} aria-hidden="true" />
                        </a>
                      ) : null}
                      {app.android ? (
                        <a href={app.android} target="_blank" rel="noreferrer">
                          Android <ArrowUpRight size={11} aria-hidden="true" />
                        </a>
                      ) : null}
                      {app.web ? (
                        <a href={app.web} target="_blank" rel="noreferrer">
                          Web <ArrowUpRight size={11} aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="cr-app-submit">
              <p>
                <strong>Shipping with OpenIAP?</strong> Add your app icon and
                store links to the community index.
              </p>
              <a href={SHOWCASE_ISSUE_URL} target="_blank" rel="noreferrer">
                Add your app
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </div>
          </section>

          <aside
            id="contribute"
            className="cr-contribute"
            aria-labelledby="suggest-resource"
          >
            <div>
              <h2 id="suggest-resource">Suggest a resource</h2>
              <p>
                Add an article, tutorial, video, talk, or community discussion
                to this list.
              </p>
            </div>
            <div className="cr-contribute-links">
              <a
                href={EDIT_DATA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cr-primary-link"
              >
                <Github size={16} aria-hidden="true" />
                Edit and open a PR
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
              <a
                href={CONTRIBUTION_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Contribution guide
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default CommunityResources;
