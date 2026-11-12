import { THEMES, useTheme } from "../../theme/ThemeProvider";

/** Three swatches, one per theme, as a radio group. */
export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.name}
          type="button"
          role="radio"
          aria-checked={theme === t.name}
          title={t.label}
          className={`theme-swatch swatch-${t.name}`}
          onClick={() => setTheme(t.name)}
        >
          <span className="visually-hidden">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
