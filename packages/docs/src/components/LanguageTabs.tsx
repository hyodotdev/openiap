import { useState, type ReactNode } from 'react';

type Language = 'swift' | 'kotlin' | 'typescript' | 'dart' | 'kmp' | 'gdscript';

interface LanguageTabsProps {
  children: {
    swift?: ReactNode;
    kotlin?: ReactNode;
    typescript?: ReactNode;
    dart?: ReactNode;
    kmp?: ReactNode;
    gdscript?: ReactNode;
  };
}

const LANGUAGE_LABELS: Record<Language, string> = {
  swift: 'Swift',
  kotlin: 'Kotlin',
  typescript: 'TypeScript',
  dart: 'Dart',
  kmp: 'Kotlin (KMP)',
  gdscript: 'GDScript',
};

const LANGUAGE_ORDER: Language[] = [
  'swift',
  'kotlin',
  'typescript',
  'dart',
  'kmp',
  'gdscript',
];

function LanguageTabs({ children }: LanguageTabsProps) {
  const availableLanguages = LANGUAGE_ORDER.filter(
    (lang) => children[lang] !== undefined
  );

  const [activeTab, setActiveTab] = useState<Language>(
    availableLanguages[0] ?? 'swift'
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
      <div className="language-tabs-content">{children[activeTab]}</div>
    </div>
  );
}

export default LanguageTabs;
