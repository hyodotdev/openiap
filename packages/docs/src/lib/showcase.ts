import * as showcaseData from '../../showcase-apps.json';
import { LIBRARIES, type FrameworkLibraryName } from './images';

export interface ShowcaseApp {
  /** App name. */
  name: string;
  /** One-line description shown under the app name. */
  tagline: string;
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

/** How many apps the home page highlights before "See all". */
export const FEATURED_SHOWCASE_LIMIT = 5;

/** All apps share the same public Play install metric; unknown counts sort last. */
function byReach(apps: ShowcaseApp[]): ShowcaseApp[] {
  return apps.sort(
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

export const SHOWCASE_APPS = byReach([...submittedApps, ...githubApps]);

export const FEATURED_SHOWCASE_APPS = SHOWCASE_APPS.slice(
  0,
  FEATURED_SHOWCASE_LIMIT
);
