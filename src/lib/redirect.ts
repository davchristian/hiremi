const DEFAULT_PATH = "/board";
const BASE = "http://localhost";

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return DEFAULT_PATH;

  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return DEFAULT_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_PATH;
  }
}
