export type ThemePreference = "system" | "light" | "dark";

export const THEME_COOKIE = "theme";

export function parseTheme(value: string | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
