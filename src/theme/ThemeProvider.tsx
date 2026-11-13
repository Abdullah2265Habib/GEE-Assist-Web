import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** The three themes the desktop app offers in View → Theme, plus two website-only ones. */
export type ThemeName = "light" | "dark-green" | "dark-grey" | "earth" | "navy";

export const THEMES: { name: ThemeName; label: string; icon: string; inApp: boolean }[] = [
  { name: "light", label: "Light", icon: "/media/icon-light-64.png", inApp: true },
  { name: "dark-green", label: "Dark blue-green", icon: "/media/icon-dark-green-64.png", inApp: true },
  { name: "dark-grey", label: "Dark grey", icon: "/media/icon-dark-grey-64.png", inApp: true },
  { name: "earth", label: "Ocean, forest & sand", icon: "/media/icon-light-64.png", inApp: false },
  { name: "navy", label: "Navy & sand", icon: "/media/icon-dark-green-64.png", inApp: false },
];

const THEME_NAMES = THEMES.map((t) => t.name) as string[];

const STORAGE_KEY = "gee-assist-theme";

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEME_NAMES.includes(saved)) return saved as ThemeName;
  } catch {
    /* storage unavailable: fall through */
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark-green";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) icon.href = THEMES.find((t) => t.name === theme)?.icon ?? icon.href;
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
