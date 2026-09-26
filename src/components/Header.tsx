"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/board", label: "board" },
  { href: "/feed", label: "feed" },
] as const;

export function Header({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between gap-3 border-b border-hairline bg-panel px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 font-mono text-sm">
        <span className="flex shrink-0 gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rejected/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-interview/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-offer/70" />
        </span>
        <span className="hidden text-text sm:inline">job-tracker</span>

        <nav aria-label="sections" className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded px-2 py-1 font-mono text-xs transition-colors ${
                  active
                    ? "bg-panel-alt text-text"
                    : "text-text-muted hover:bg-panel-alt/60 hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4 font-mono text-xs text-text-muted">
        <span className="hidden truncate sm:inline">{email}</span>
        <form action={signOut}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="font-mono text-xs text-text-muted hover:border-rejected hover:text-rejected"
          >
            sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
