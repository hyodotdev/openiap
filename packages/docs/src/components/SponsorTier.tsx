interface SponsorTierProps {
  tier: string;
  className?: string;
}

/** Sponsor tier badge; `.sponsor-tier` in base.css styles each tier by name. */
function SponsorTier({ tier, className }: SponsorTierProps) {
  return (
    <span
      className={className ? `sponsor-tier ${className}` : 'sponsor-tier'}
      data-tier={tier.toLowerCase()}
    >
      {tier}
    </span>
  );
}

export default SponsorTier;
