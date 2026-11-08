import { useLayoutEffect, type ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * The game has one dedicated dark presentation. Old `ofm-theme` and backend `theme` values are
 * deliberately ignored here; the settings schema keeps them readable during the UI migration.
 * Accessibility classes such as `high-contrast` are owned by App and must survive this effect.
 */
export function ThemeProvider({ children }: ThemeProviderProps): ReactNode {
  useLayoutEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return children;
}
