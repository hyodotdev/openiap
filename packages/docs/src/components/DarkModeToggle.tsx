import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { savePreference } from '../lib/storage';

// index.html applies the saved or system theme before the first paint.
const isDarkTheme = (): boolean =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('dark');

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(isDarkTheme);

  const toggleDarkMode = () => {
    const dark = !isDark;
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    savePreference('theme', dark ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleDarkMode}
      style={{
        padding: '0.5rem',
        background: 'transparent',
        border: 'none',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s',
        color: 'var(--text-primary)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-secondary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
