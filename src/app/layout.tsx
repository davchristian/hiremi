import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Hiremi", template: "%s · Hiremi" },
  description: "Find software internships you can actually take, and track every application.",
};

export const viewport: Viewport = {
  themeColor: "#12100e",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
