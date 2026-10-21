import type { Metadata, Viewport } from "next";
import { THEME_COLORS } from "@/lib/theme";
import { readTheme } from "@/lib/theme-server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Hiremi", template: "%s · Hiremi" },
  description: "Find software internships you can actually take, and track every application.",
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await readTheme();
  if (theme !== "system") return { themeColor: THEME_COLORS[theme], colorScheme: theme };
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
      { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
    ],
    colorScheme: "light dark",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await readTheme();

  return (
    <html lang="en" className="h-full" data-theme={theme === "system" ? undefined : theme}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
