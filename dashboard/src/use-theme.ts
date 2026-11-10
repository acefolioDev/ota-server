import { useEffect, useState } from "preact/hooks";

const THEME_KEY = "ota-admin-theme";
export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.setAttribute("content", theme === "light" ? "#fafafa" : "#09090b");
  }, [theme]);

  return { theme, setTheme };
}

function readTheme(): Theme {
  const active = document.documentElement.dataset.theme;
  if (active === "light" || active === "dark") return active;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
