import type { ComponentType, ReactElement } from 'react';
import * as sponsorRegistry from '../../sponsors.json';

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

function toSupporter(entry: RegistrySupporter): Supporter {
  return { ...entry, Wordmark: createWordmark(entry) };
}

function toSponsor(entry: RegistrySponsor): Sponsor {
  return { ...entry, Wordmark: createWordmark(entry) };
}

export const CURRENT_SPONSORS: readonly Sponsor[] =
  sponsorRegistry.currentSponsors.map(toSponsor);

export const PAST_SUPPORTERS: readonly Supporter[] =
  sponsorRegistry.pastSupporters.map(toSupporter);

const ALL_SUPPORTERS: readonly Supporter[] = [
  ...CURRENT_SPONSORS,
  ...PAST_SUPPORTERS,
];

function requireSupporter(id: string): Supporter {
  const supporter = ALL_SUPPORTERS.find((entry) => entry.id === id);

  if (!supporter) {
    throw new Error(`Missing supporter: ${id}`);
  }

  return supporter;
}

export const AMAZON_SUPPORTER = requireSupporter('amazon');
export const META_SUPPORTER = requireSupporter('meta');

const openCollectiveUrl = `https://opencollective.com/${sponsorRegistry.funding.openCollectiveSlug}`;

export const FUNDING_LINKS = {
  ...sponsorRegistry.funding,
  companyContactUrl: `mailto:${sponsorRegistry.funding.companyContactEmail}`,
  githubUrl: `https://github.com/sponsors/${sponsorRegistry.funding.githubHandle}`,
  openCollectiveUrl,
} as const;
