import { useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import StaticExamples from './StaticExamples';
import { useStaticExamples } from '../hooks/useStaticExamples';
import { declaresId } from '../lib/elementIds';

type Platform = 'ios' | 'android' | 'amazon' | 'horizon';

interface PlatformTabsProps {
  children: {
    ios?: ReactNode;
    android?: ReactNode;
    amazon?: ReactNode;
    horizon?: ReactNode;
  };
}

const PLATFORM_LABELS: Record<Platform, string> = {
  ios: 'iOS',
  android: 'Android',
  amazon: 'Fire OS',
  horizon: 'Horizon OS',
};

const PLATFORM_ORDER: Platform[] = ['ios', 'android', 'horizon', 'amazon'];

// The tab that holds the linked anchor, else the platform the hash names.
function platformForHash(
  hash: string,
  children: PlatformTabsProps['children'],
  availablePlatforms: Platform[]
): Platform | null {
  const id = hash.slice(1);
  if (!id) return null;
  return (
    availablePlatforms.find((platform) => declaresId(children[platform], id)) ??
    availablePlatforms.find((platform) =>
      id.toLowerCase().includes(platform)
    ) ??
    null
  );
}

function PlatformTabs({ children }: PlatformTabsProps) {
  const isStatic = useStaticExamples();
  const availablePlatforms = PLATFORM_ORDER.filter(
    (platform) => children[platform] !== undefined
  );
  const location = useLocation();
  const hashPlatform = platformForHash(
    location.hash,
    children,
    availablePlatforms
  );
  const [activeTab, setActiveTab] = useState<Platform>(
    () => hashPlatform ?? availablePlatforms[0] ?? 'ios'
  );

  // Every navigation re-applies the hash, including same-page router links.
  useEffect(() => {
    if (hashPlatform) setActiveTab(hashPlatform);
  }, [location.key, hashPlatform]);

  const examples = availablePlatforms
    .filter((platform) => isStatic || platform !== activeTab)
    .map((platform) => (
      <details key={platform}>
        <summary>{PLATFORM_LABELS[platform]} example</summary>
        {children[platform]}
      </details>
    ));

  if (isStatic) return <>{examples}</>;

  return (
    <div className="platform-tabs">
      <div className="platform-tabs-header" role="group" aria-label="Platform">
        {availablePlatforms.map((platform) => (
          <button
            key={platform}
            type="button"
            className={`platform-tab ${activeTab === platform ? 'active' : ''}`}
            aria-pressed={activeTab === platform}
            onClick={() => setActiveTab(platform)}
          >
            {PLATFORM_LABELS[platform]}
          </button>
        ))}
      </div>
      <div className="platform-tabs-content">{children[activeTab]}</div>
      <StaticExamples>{examples}</StaticExamples>
    </div>
  );
}

export default PlatformTabs;
