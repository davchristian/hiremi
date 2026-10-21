export type ThemePreference = "system" | "light" | "dark";

export const THEME_COOKIE = "theme";

export const THEME_COLORS = { light: "#f3eee2", dark: "#11130f" };

export function parseTheme(value: string | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
