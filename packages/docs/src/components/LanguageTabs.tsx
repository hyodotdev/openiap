import { useState, type ReactNode } from 'react';

type Language = 'typescript' | 'swift' | 'kotlin' | 'dart' | 'gdscript';

interface LanguageTabsProps {
  children: {
    typescript?: ReactNode;
    swift?: ReactNode;
    kotlin?: ReactNode;
    dart?: ReactNode;
    gdscript?: ReactNode;
  };
}

const LANGUAGE_LABELS: Record<Language, string> = {
  typescript: 'TypeScript',
  swift: 'Swift',
  kotlin: 'Kotlin',
  dart: 'Dart',
  gdscript: 'GDScript',
};

function LanguageTabs({ children }: LanguageTabsProps) {
  const [activeTab, setActiveTab] = useState<Language>('typescript');

  const availableLanguages = (Object.keys(children) as Language[]).filter(
    (lang) => children[lang] !== undefined
  );

  return (
    <div className="language-tabs">
      <div className="language-tabs-header">
        {availableLanguages.map((lang) => (
          <button
            key={lang}
            className={`language-tab ${activeTab === lang ? 'active' : ''}`}
            onClick={() => setActiveTab(lang)}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        ))}
      </div>
      <div className="language-tabs-content">
        {children[activeTab]}
      </div>
    </div>
  );
}

export default LanguageTabs;
