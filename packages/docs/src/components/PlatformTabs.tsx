import { useState, useEffect, useMemo, ReactNode } from 'react';
import StaticExamples from './StaticExamples';
import { useStaticExamples } from '../hooks/useStaticExamples';

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

function platformFromHash(availablePlatforms: Platform[]): Platform | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const hash = window.location.hash.toLowerCase();
  return availablePlatforms.find((platform) => hash.includes(platform)) ?? null;
}

function PlatformTabs({ children }: PlatformTabsProps) {
  const isStatic = useStaticExamples();
  // children is a new object each render; key the list on which platforms exist.
  const platformKey = PLATFORM_ORDER.filter(
    (platform) => children[platform] !== undefined
  ).join(' ');
  const availablePlatforms = useMemo(
    () =>
      PLATFORM_ORDER.filter((platform) =>
        platformKey.split(' ').includes(platform)
      ),
    [platformKey]
  );

  const [activeTab, setActiveTab] = useState<Platform>(
    () => availablePlatforms[0] ?? 'ios'
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleHashChange = () => {
      const next = platformFromHash(availablePlatforms);
      if (next) {
        setActiveTab(next);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [availablePlatforms]);

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
      <div className="platform-tabs-header">
        {availablePlatforms.map((platform) => (
          <button
            key={platform}
            className={`platform-tab ${activeTab === platform ? 'active' : ''}`}
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
