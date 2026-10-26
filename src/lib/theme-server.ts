import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme, type ThemePreference } from "@/lib/theme";

export async function readTheme(): Promise<ThemePreference> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
