import { useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import StaticExamples from './StaticExamples';
import { useStaticExamples } from '../hooks/useStaticExamples';
import {
  CODE_LANGUAGES,
  DEFAULT_CODE_LANGUAGE,
  codeLanguageSignal,
  setCodeLanguage,
  type CodeLanguage,
} from '../lib/signals';

interface LanguageTabsProps {
  children: {
    swift?: ReactNode;
    kotlin?: ReactNode;
    typescript?: ReactNode;
    dart?: ReactNode;
    kmp?: ReactNode;
    gdscript?: ReactNode;
    csharp?: ReactNode;
  };
}

const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  swift: 'Swift',
  kotlin: 'Kotlin',
  typescript: 'TypeScript',
  dart: 'Dart',
  kmp: 'Kotlin (KMP)',
  gdscript: 'GDScript',
  csharp: 'C# (MAUI)',
};

const subscribeToCodeLanguage = (onStoreChange: () => void): (() => void) =>
  codeLanguageSignal.subscribe(onStoreChange);

const getCodeLanguageSnapshot = (): CodeLanguage => codeLanguageSignal.value;

const getCodeLanguageServerSnapshot = (): CodeLanguage => DEFAULT_CODE_LANGUAGE;

function LanguageTabs({ children }: LanguageTabsProps): ReactElement {
  const isStatic = useStaticExamples();
  const availableLanguages = CODE_LANGUAGES.filter(
    (lang) => children[lang] !== undefined
  );
  const preferredLanguage = useSyncExternalStore(
    subscribeToCodeLanguage,
    getCodeLanguageSnapshot,
    getCodeLanguageServerSnapshot
  );
  const activeTab = availableLanguages.includes(preferredLanguage)
    ? preferredLanguage
    : (availableLanguages[0] ?? 'swift');

  const examples = availableLanguages
    .filter((lang) => isStatic || lang !== activeTab)
    .map((lang) => (
      <details key={lang}>
        <summary>{LANGUAGE_LABELS[lang]} example</summary>
        {children[lang]}
      </details>
    ));

  if (isStatic) return <>{examples}</>;

  return (
    <div className="language-tabs">
      <div className="language-tabs-header">
        {availableLanguages.map((lang) => (
          <button
            key={lang}
            type="button"
            className={`language-tab ${activeTab === lang ? 'active' : ''}`}
            onClick={() => setCodeLanguage(lang)}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        ))}
      </div>
      <div className="language-tabs-content">{children[activeTab]}</div>
      <StaticExamples>{examples}</StaticExamples>
    </div>
  );
}

export default LanguageTabs;
