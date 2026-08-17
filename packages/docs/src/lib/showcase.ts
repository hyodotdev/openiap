// =============================================================================
// Showcase Apps
// =============================================================================
// Apps shipped with OpenIAP libraries, rendered in the "Who uses OpenIAP?"
// section on the home page and in full on /showcase.
//
// To add an app, edit `showcase-apps.json` at the root of packages/docs and
// open a pull request. See SHOWCASE.md for the submission guide.
// =============================================================================

import * as showcaseData from '../../showcase-apps.json';
import type { FrameworkLibraryName } from './images';

export type ShowcaseApp = {
  /** App name as it appears on the stores. */
  name: string;
  /** One-line description shown under the app name. */
  tagline: string;
  /** Path under packages/docs/public (e.g. `/showcase/app.webp`) or an https URL. */
  logo: string;
  /** Which OpenIAP library the app ships with. */
  library: FrameworkLibraryName;
  /** Whether the app uses IAPKit for receipt validation. */
  iapkit?: boolean;
  ios?: string;
  android?: string;
  web?: string;
  /**
   * App Store + Google Play review counts combined. Primary ordering key —
   * neither store publishes download totals, so this is the one verifiable
   * signal both platforms share.
   */
  ratings?: number;
  /** Google Play install floor ("1K+" → 1000). Tiebreaker when ratings match. */
  installs?: number;
};

/** How many apps the home page highlights before "See all". */
export const FEATURED_SHOWCASE_LIMIT = 5;

function hasLink(app: ShowcaseApp): boolean {
  return Boolean(app.ios ?? app.android ?? app.web);
}

/**
 * Orders by combined review count (desc), falling back to Play installs, then
 * submission order. Refresh the numbers with `bun run showcase:metrics`.
 */
function byReach(apps: ShowcaseApp[]): ShowcaseApp[] {
  return apps
    .map((app, index) => ({ app, index }))
    .sort((a, b) => {
      const ratings = (b.app.ratings ?? 0) - (a.app.ratings ?? 0);
      if (ratings !== 0) return ratings;
      const installs = (b.app.installs ?? 0) - (a.app.installs ?? 0);
      if (installs !== 0) return installs;
      return a.index - b.index;
    })
    .map((entry) => entry.app);
}

export const SHOWCASE_APPS: ShowcaseApp[] = byReach(
  (showcaseData.apps as ShowcaseApp[]).filter(
    (app) => Boolean(app.name && app.logo) && hasLink(app)
  )
);

export const FEATURED_SHOWCASE_APPS: ShowcaseApp[] = SHOWCASE_APPS.slice(
  0,
  FEATURED_SHOWCASE_LIMIT
);
