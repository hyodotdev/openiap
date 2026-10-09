import * as showcaseData from '../../showcase-apps.json';
import { showcaseIdentities } from '@hyodotdev/openiap-mcp-server/showcase-schema';
import { LIBRARIES, type FrameworkLibraryName } from './images';

export interface ShowcaseApp {
  /** App name. */
  name: string;
  /** One-line description shown under the app name. */
  tagline: string;
  /** App purpose used by showcase filters. */
  category: string;
  /** Path under packages/docs/public (e.g. `/showcase/app.webp`) or an https URL. */
  logo: string;
  /** Which OpenIAP library the app ships with. */
  library: FrameworkLibraryName | FrameworkLibraryName[];
  /** Whether the app uses IAPKit. */
  iapkit?: boolean;
  ios?: string;
  android?: string;
  web?: string;
  github?: string;
  stars?: number;
  /** Combined App Store and Google Play review counts. */
  ratings?: number;
  /** Google Play install floor ("1K+" → 1000); absent when unavailable. */
  installs?: number;
}

export const SHOWCASE_GITHUB = showcaseData.github;
export const GITHUB_DEPENDENTS_TOTAL = SHOWCASE_GITHUB.sources.reduce(
  (total, source) => total + source.dependents,
  0
);
export function formatShowcaseCount(count: number): string {
  const precision = SHOWCASE_GITHUB.countPrecision;
  return count < precision
    ? count.toLocaleString('en-US')
    : `${(Math.floor(count / precision) * precision).toLocaleString('en-US')}+`;
}

export const GITHUB_DEPENDENTS_LABEL = `${formatShowcaseCount(GITHUB_DEPENDENTS_TOTAL)} public GitHub dependents`;
export const GITHUB_DEPENDENTS_URL = SHOWCASE_GITHUB.sources.find(
  (source) => source.package === SHOWCASE_GITHUB.linkPackage
)?.url;
export const GITHUB_DEPENDENTS_DESCRIPTION = `GitHub's publicly visible estimates, summed by package. Shared repositories may count more than once. Checked ${SHOWCASE_GITHUB.checkedAt}.`;

/** How many apps Community Resources highlights before "See all". */
export const FEATURED_SHOWCASE_LIMIT = 5;

/** All apps share the same public Play install metric; unknown counts sort last. */
export function sortShowcaseApps(apps: readonly ShowcaseApp[]): ShowcaseApp[] {
  return [...apps].sort(
    (a, b) =>
      (b.installs ?? -1) - (a.installs ?? -1) ||
      a.name.localeCompare(b.name, 'en')
  );
}

const submittedApps = (showcaseData.apps as ShowcaseApp[]).filter(
  (app) =>
    app.name && app.logo && (app.ios || app.android || app.web || app.github)
);

const githubApps = SHOWCASE_GITHUB.apps.flatMap((app): ShowcaseApp[] => {
  const repository = SHOWCASE_GITHUB.repositories.find(
    (entry) => entry.name.toLowerCase() === app.repository.toLowerCase()
  );
  if (!repository) return [];
  const { repository: name, ...details } = app;
  return [
    {
      ...details,
      library: LIBRARIES.filter((library) =>
        repository.packages.includes(library.name)
      ).map((library) => library.name),
      github: `https://github.com/${name}`,
      stars: repository.stars,
    },
  ];
});

export const SHOWCASE_APPS = sortShowcaseApps([
  ...submittedApps,
  ...githubApps,
]);

export function mergeShowcaseApps(
  apps: readonly ShowcaseApp[],
  additions: readonly ShowcaseApp[]
): ShowcaseApp[] {
  const identities = new Set(apps.flatMap(showcaseIdentities));
  const fresh = additions.filter((app) => {
    const aliases = showcaseIdentities(app);
    if (aliases.some((identity) => identities.has(identity))) return false;
    aliases.forEach((identity) => identities.add(identity));
    return true;
  });
  return sortShowcaseApps([...apps, ...fresh]);
}

export function getShowcaseAppLibraries(
  app: ShowcaseApp
): FrameworkLibraryName[] {
  return Array.isArray(app.library) ? app.library : [app.library];
}

export const SHOWCASE_CATEGORIES = [
  ...new Set(SHOWCASE_APPS.map((app) => app.category)),
].sort((a, b) => a.localeCompare(b, 'en'));

export interface ShowcaseFilters {
  query: string;
  category: string;
  library: FrameworkLibraryName | '';
}

export function filterShowcaseApps(
  apps: readonly ShowcaseApp[],
  { query, category, library }: ShowcaseFilters
): ShowcaseApp[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return apps.filter((app) => {
    const libraries = getShowcaseAppLibraries(app);
    if (category && app.category !== category) return false;
    if (library && !libraries.includes(library)) return false;

    const searchText = [
      app.name,
      app.tagline,
      app.category,
      app.github ?? '',
      app.iapkit ? 'IAPKit' : '',
      ...LIBRARIES.filter((entry) => libraries.includes(entry.name)).flatMap(
        (entry) => [entry.name, entry.frameworkName]
      ),
    ]
      .join(' ')
      .toLowerCase();

    return terms.every((term) => searchText.includes(term));
  });
}
