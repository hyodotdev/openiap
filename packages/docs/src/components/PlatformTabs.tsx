import { useState, ReactNode } from 'react';

interface PlatformTabsProps {
  children: {
    ios?: ReactNode;
    android?: ReactNode;
  };
}

function PlatformTabs({ children }: PlatformTabsProps) {
  const [activeTab, setActiveTab] = useState<'ios' | 'android'>('ios');

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
