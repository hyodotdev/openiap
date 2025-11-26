import { useState, useEffect, ReactNode } from 'react';

interface PlatformTabsProps {
  children: {
    ios?: ReactNode;
    android?: ReactNode;
  };
}

function PlatformTabs({ children }: PlatformTabsProps) {
  const [activeTab, setActiveTab] = useState<'ios' | 'android'>(() => {
    // Check URL hash to determine initial tab
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('android')) {
      return 'android';
    }
    return 'ios';
  });

  useEffect(() => {
    // Handle hash changes for tab switching
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('android')) {
        setActiveTab('android');
      } else if (hash.includes('ios')) {
        setActiveTab('ios');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="platform-tabs">
      <div className="platform-tabs-header">
        <button
          className={`platform-tab ${activeTab === 'ios' ? 'active' : ''}`}
          onClick={() => setActiveTab('ios')}
        >
          iOS
        </button>
        <button
          className={`platform-tab ${activeTab === 'android' ? 'active' : ''}`}
          onClick={() => setActiveTab('android')}
        >
          Android
        </button>
      </div>
      <div className="platform-tabs-content">
        {activeTab === 'ios' && children.ios}
        {activeTab === 'android' && children.android}
      </div>
    </div>
  );
}

export default PlatformTabs;
