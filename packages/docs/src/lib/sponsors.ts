import type { ComponentType } from 'react';
import AmazonWordmark from '../components/AmazonWordmark';
import MetaWordmark from '../components/MetaWordmark';

interface SponsorWordmarkProps {
  className?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  shortName: string;
  tier: string;
  url: string;
  Wordmark: ComponentType<SponsorWordmarkProps>;
}

export const CURRENT_SPONSORS = [
  {
    id: 'meta',
    name: 'Meta',
    shortName: 'Meta',
    tier: 'Angel',
    url: 'https://meta.com',
    Wordmark: MetaWordmark,
  },
  {
    id: 'amazon',
    name: 'Amazon Developer',
    shortName: 'Amazon',
    tier: 'Angel',
    url: 'https://developer.amazon.com/',
    Wordmark: AmazonWordmark,
  },
] as const satisfies readonly Sponsor[];
