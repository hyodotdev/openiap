import { useState, type CSSProperties } from 'react';
import { Plus, Search } from 'lucide-react';
import SEO from '../components/SEO';
import SelectInput from '../components/SelectInput';
import {
  ShowcaseAppCard,
  ShowcaseSubmitCard,
} from '../components/ShowcaseCards';
import {
  GITHUB_DEPENDENTS_LABEL,
  GITHUB_DEPENDENTS_URL,
  GITHUB_DEPENDENTS_DESCRIPTION,
  filterShowcaseApps,
  getShowcaseAppLibraries,
  type ShowcaseFilters,
} from '../lib/showcase';
import { showcaseIdentity } from '@hyodotdev/openiap-mcp-server/showcase-schema';

import { LIBRARIES } from '../lib/images';
import { useShowcaseApps } from '../hooks/useShowcaseApps';
import ShowcaseSubmissionGuide from '../components/ShowcaseSubmissionGuide';

const showcaseGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: '1rem',
};

function Showcase() {
  const apps = useShowcaseApps();
  const libraries = LIBRARIES.filter((entry) =>
    apps.some((app) => getShowcaseAppLibraries(app).includes(entry.name))
  );
  const categories = [...new Set(apps.map((app) => app.category))].sort(
    (a, b) => a.localeCompare(b, 'en')
  );
  const [filters, setFilters] = useState<ShowcaseFilters>({
    query: '',
    category: '',
    library: '',
  });
  const matchingApps = filterShowcaseApps(apps, {
    ...filters,
    library: '',
  });
  const visibleApps = filterShowcaseApps(matchingApps, {
    query: '',
    category: '',
    library: filters.library,
  });
  const hasFilters = Boolean(
    filters.query || filters.category || filters.library
  );

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
          <section className="showcase-filters" aria-label="Find apps">
            <div className="showcase-search-controls">
              <label>
                <span>Search apps</span>
                <span className="showcase-search-input">
                  <Search size={17} aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Name, purpose, or library"
                    value={filters.query}
                    onChange={(event) =>
                      setFilters({ ...filters, query: event.target.value })
                    }
                  />
                </span>
              </label>
              <label>
                <span>Category</span>
                <SelectInput
                  value={filters.category}
                  onChange={(event) =>
                    setFilters({ ...filters, category: event.target.value })
                  }
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </SelectInput>
              </label>
            </div>
            <fieldset className="showcase-library-filters">
              <legend>Library</legend>
              <div>
                <button
                  type="button"
                  aria-pressed={!filters.library}
                  onClick={() => setFilters({ ...filters, library: '' })}
                >
                  All <span>{matchingApps.length}</span>
                </button>
                {libraries.map((library) => (
                  <button
                    key={library.name}
                    type="button"
                    aria-pressed={filters.library === library.name}
                    onClick={() =>
                      setFilters({ ...filters, library: library.name })
                    }
                  >
                    {library.homeLabel}{' '}
                    <span>
                      {
                        matchingApps.filter((app) =>
                          getShowcaseAppLibraries(app).includes(library.name)
                        ).length
                      }
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
          <div className="showcase-results-bar">
            <p role="status">
              {visibleApps.length} {visibleApps.length === 1 ? 'app' : 'apps'}
              <span> · Sorted by downloads</span>
            </p>
            {hasFilters ? (
              <button
                type="button"
                onClick={() =>
                  setFilters({ query: '', category: '', library: '' })
                }
              >
                Clear filters
              </button>
            ) : null}
          </div>
          {visibleApps.length ? (
            <div style={showcaseGridStyle}>
              {visibleApps.map((app) => (
                <ShowcaseAppCard key={showcaseIdentity(app)} app={app} />
              ))}
              <ShowcaseSubmitCard />
            </div>
          ) : (
            <div className="showcase-empty">
              <h2>No apps match these filters</h2>
              <p>Try a different search or clear the filters.</p>
            </div>
          )}

          <ShowcaseSubmissionGuide />
        </div>
      </section>
    </div>
  );
}

export default Showcase;
