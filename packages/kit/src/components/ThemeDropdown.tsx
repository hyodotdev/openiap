import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Sun, Moon, Wand2 } from "lucide-react";

import { useThemeMode, type ThemeMode } from "@/hooks/useThemeMode";

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: React.ReactNode;
}

const themeOptions: ThemeOption[] = [
  {
    value: "auto",
    label: "Auto",
    icon: <Wand2 className="w-4 h-4" />,
  },
  {
    value: "light",
    label: "Light",
    icon: <Sun className="w-4 h-4" />,
  },
  {
    value: "dark",
    label: "Dark",
    icon: <Moon className="w-4 h-4" />,
  },
];

export function ThemeDropdown() {
  const { theme, setTheme, isDarkMode } = useThemeMode();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = themeOptions.find((opt) => opt.value === theme);

  // Use explicit background color for dropdown to ensure visibility
  const dropdownBg = isDarkMode
    ? "rgba(24, 24, 31, 0.98)"
    : "rgba(255, 255, 255, 0.98)";

  const menuId = "theme-dropdown-menu";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-background rounded hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition-colors text-foreground"
        aria-label="Select theme"
        // Use the generic "listbox" semantic rather than "menu" — we
        // don't implement full WAI-ARIA menu keyboard navigation
        // (arrow keys, type-ahead, escape-to-close focus cycling),
        // and a labeled button-triggered popup of toggleable options
        // is closer to a listbox than a menu.
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
      >
        {selectedOption?.icon}
        <span className="text-sm">{selectedOption?.label}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="listbox"
          aria-label="Theme options"
          className="absolute z-50 right-0 mt-2 w-36 rounded-xl border border-border/60 shadow-xl backdrop-blur"
          style={{ backgroundColor: dropdownBg }}
        >
          <div className="py-2">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={theme === option.value}
                onClick={() => handleThemeChange(option.value)}
                className={`
                  w-full px-3 py-2 text-left
                  flex items-center gap-2
                  hover:bg-muted transition-colors
                  ${
                    theme === option.value
                      ? "bg-muted text-primary"
                      : "text-foreground"
                  }
                `}
              >
                {option.icon}
                <span className="text-sm">{option.label}</span>
                {theme === option.value && (
                  <Check className="w-4 h-4 text-primary ml-auto" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
