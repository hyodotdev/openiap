import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "auto" | "light" | "dark";

type UseThemeModeResult = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  isDarkMode: boolean;
};

const THEME_STORAGE_KEY = "theme";
const DARK_BACKGROUND = "#18181B";
const LIGHT_BACKGROUND = "#ffffff";

const isBrowser = typeof window !== "undefined";
const isDocumentAvailable = typeof document !== "undefined";

const getStoredTheme = (): ThemeMode => {
  if (!isBrowser) {
    return "auto";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }

  return "auto";
};

const resolveIsDark = (mode: ThemeMode): boolean => {
  if (mode === "auto") {
    if (!isBrowser) {
      return false;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  return mode === "dark";
};

const applyDocumentTheme = (isDark: boolean) => {
  if (!isDocumentAvailable) {
    return;
  }

  const root = document.documentElement;
  const backgroundColor = isDark ? DARK_BACKGROUND : LIGHT_BACKGROUND;

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  root.style.backgroundColor = backgroundColor;
  if (document.body) {
    document.body.style.backgroundColor = backgroundColor;
  }
};

export function useThemeMode(): UseThemeModeResult {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (!isDocumentAvailable) {
      return false;
    }

    return document.documentElement.classList.contains("dark");
  });

  const applyTheme = useCallback((mode: ThemeMode) => {
    const resolvedIsDark = resolveIsDark(mode);
    applyDocumentTheme(resolvedIsDark);
    setIsDarkMode(resolvedIsDark);
  }, []);

  // Ensure the initial stored preference is applied after hydration.
  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "auto") {
      setThemeState(stored);
    }
  }, []);

  // Apply the theme whenever it changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    if (!isDocumentAvailable) {
      return;
    }

    const observeTheme = () => {
      const dark = document.documentElement.classList.contains("dark");
      setIsDarkMode(dark);
    };

    observeTheme();

    const observer = new MutationObserver(observeTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Recompute theme when system preference changes in auto mode.
  useEffect(() => {
    if (!isBrowser || theme !== "auto") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme("auto");
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [theme, applyTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    if (isBrowser) {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  }, []);

  return { theme, setTheme, isDarkMode };
}
