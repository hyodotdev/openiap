import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check localStorage and system preference
    const stored = localStorage.getItem("theme");
    if (stored) {
      setIsDark(stored === "dark");
      applyTheme(stored === "dark");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setIsDark(prefersDark);
      applyTheme(prefersDark);
    }
  }, []);

  const applyTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.backgroundColor = "#09090b";
      document.body.style.backgroundColor = "#09090b";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.backgroundColor = "#fefefe";
      document.body.style.backgroundColor = "#fefefe";
    }
  };

  const toggleDarkMode = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem("theme", newTheme ? "dark" : "light");
    applyTheme(newTheme);
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
        color: 'var(--text-primary)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-secondary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      aria-label="Toggle dark mode"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}