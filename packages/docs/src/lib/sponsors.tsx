import type { ComponentType, ReactElement } from 'react';
import * as sponsorRegistry from '../../sponsor-registry.json';

interface SponsorWordmarkProps {
  className?: string;
}

interface SponsorLogo {
  src: string;
  darkSrc?: string;
  height: number;
}

interface RegistrySupporter {
  id: string;
  name: string;
  url: string;
  logo: SponsorLogo;
}

interface RegistrySponsor extends RegistrySupporter {
  shortName: string;
  tier: string;
}

export interface Supporter extends RegistrySupporter {
  Wordmark: ComponentType<SponsorWordmarkProps>;
}

export interface InKindSupporter extends Supporter {
  program: string;
  contribution: string;
  /** Both dates are absent for open-ended support. */
  since?: string;
  until?: string;
  /** Compact support window, e.g. "Jul 2026 – Jan 2027". */
  period?: string;
}

export interface PastSupporter extends RegistrySupporter {
  tier: string;
  supported: string;
}

export interface Sponsor extends Supporter {
  shortName: string;
  tier: string;
}

function createWordmark(
  supporter: RegistrySupporter
): ComponentType<SponsorWordmarkProps> {
  function SponsorWordmark({ className }: SponsorWordmarkProps): ReactElement {
    const classes = ['sponsor-wordmark', `${supporter.id}-wordmark`, className]
      .filter(Boolean)
      .join(' ');

    return (
      <span className={classes} role="img" aria-label={supporter.name}>
        <img
          className={supporter.logo.darkSrc ? 'sponsor-wordmark-light' : ''}
          src={supporter.logo.src}
          alt=""
          aria-hidden="true"
        />
        {supporter.logo.darkSrc ? (
          <img
            className="sponsor-wordmark-dark"
            src={supporter.logo.darkSrc}
            alt=""
            aria-hidden="true"
          />
        ) : null}
      </span>
    );
  }

  SponsorWordmark.displayName = `${supporter.name}Wordmark`;
  return SponsorWordmark;
}

function toSponsor(entry: RegistrySponsor): Sponsor {
  return { ...entry, Wordmark: createWordmark(entry) };
}

export const CURRENT_SPONSORS: readonly Sponsor[] =
  sponsorRegistry.currentSponsors.map(toSponsor);

function formatNameList(names: readonly string[]): string {
  if (names.length < 3) {
    return names.join(' and ');
  }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Sponsor names as a sentence list, e.g. "Meta, Amazon Developer, and Codemagic". */
export const CURRENT_SPONSOR_NAMES = formatNameList(
  CURRENT_SPONSORS.map((sponsor) => sponsor.name)
);

function formatSupportMonth(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export const IN_KIND_SUPPORTERS: readonly InKindSupporter[] =
  sponsorRegistry.inKindSupporters.map((entry) => ({
    ...entry,
    period:
      entry.since && entry.until
        ? `${formatSupportMonth(entry.since)} – ${formatSupportMonth(entry.until)}`
        : undefined,
    Wordmark: createWordmark(entry),
  }));

export const PAST_SUPPORTERS: readonly PastSupporter[] =
  sponsorRegistry.pastSupporters;

function requireSupporter(id: string): Supporter {
  const supporter = CURRENT_SPONSORS.find((entry) => entry.id === id);

  if (!supporter) {
    throw new Error(`Missing supporter: ${id}`);
  }

  return supporter;
}

export const AMAZON_SUPPORTER = requireSupporter('amazon');
export const CODEMAGIC_SUPPORTER = requireSupporter('codemagic');
export const META_SUPPORTER = requireSupporter('meta');

export interface SponsorTier {
  name: string;
  usd: number;
  includes: string;
}

/** Mirrors the tiers on GitHub Sponsors (`tiers.source`). */
export const SPONSOR_TIERS: {
  source: string;
  monthly: readonly SponsorTier[];
  oneTime: readonly SponsorTier[];
} = sponsorRegistry.funding.tiers;

export const FUNDING_LINKS = {
  ...sponsorRegistry.funding,
  companyContactUrl: `mailto:${sponsorRegistry.funding.companyContactEmail}`,
  githubUrl: `https://github.com/sponsors/${sponsorRegistry.funding.githubHandle}`,
} as const;
