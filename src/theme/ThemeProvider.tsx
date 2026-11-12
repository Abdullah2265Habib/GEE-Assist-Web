import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** The same three themes the desktop app offers in View → Theme. */
export type ThemeName = "light" | "dark-green" | "dark-grey";

export const THEMES: { name: ThemeName; label: string; icon: string }[] = [
  { name: "light", label: "Light", icon: "/media/icon-light-64.png" },
  { name: "dark-green", label: "Dark blue-green", icon: "/media/icon-dark-green-64.png" },
  { name: "dark-grey", label: "Dark grey", icon: "/media/icon-dark-grey-64.png" },
];

const STORAGE_KEY = "gee-assist-theme";

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark-green" || saved === "dark-grey") return saved;
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
