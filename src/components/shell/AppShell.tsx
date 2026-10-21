"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BriefcaseBusiness, Compass, ListChecks, LogOut, Rss, UserRound, type LucideIcon } from "lucide-react";
import { signOut } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/hig/tooltip";
import { ToastProvider } from "@/components/hig/toast";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/feed", label: "Discover", icon: Compass },
  { href: "/board", label: "Pipeline", icon: ListChecks },
  { href: "/sources", label: "Sources", icon: Rss },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppIcon({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[28%] bg-tint text-on-tint shadow-[inset_0_1px_0_rgb(255_255_255/0.22)]"
      style={{ width: size, height: size }}
    >
      <BriefcaseBusiness style={{ width: size * 0.56, height: size * 0.56 }} strokeWidth={2} />
    </span>
  );
}

export function AppShell({ email, children, activePath }: { email: string; children: ReactNode; activePath?: string }) {
  const routerPath = usePathname();
  const pathname = activePath ?? routerPath;

  return (
    <TooltipProvider>
      <ToastProvider>
        <div className="min-h-dvh">
          <aside className="material-chrome fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col border-r border-separator desk:flex">
            <div className="flex h-14 items-center gap-2.5 px-4">
              <AppIcon size={26} />
              <span className="text-headline text-[15px] text-text">Hiremi</span>
            </div>
            <nav aria-label="Sections" className="flex flex-1 flex-col gap-0.5 px-2.5 pt-2">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-8 items-center gap-2.5 rounded-[7px] px-2.5 text-body transition-colors",
                      active ? "bg-fill-strong font-medium text-text" : "text-text-muted hover:bg-fill hover:text-text",
                    )}
                  >
                    <Icon className={cn("size-4", active ? "text-tint" : "text-text-dim")} strokeWidth={2} />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-col gap-1 border-t border-separator px-4 py-3">
              <span className="truncate text-footnote text-text-dim" title={email}>
                {email}
              </span>
              <form action={signOut}>
                <button type="submit" className="inline-flex items-center gap-1.5 text-callout text-text-muted hover:text-text">
                  <LogOut className="size-3.5" strokeWidth={2} />
                  Sign out
                </button>
              </form>
            </div>
          </aside>

          <main className="min-h-dvh pb-[calc(64px+env(safe-area-inset-bottom))] desk:pb-0 desk:pl-[220px]">{children}</main>

          <nav
            aria-label="Sections"
            className="material-chrome fixed inset-x-0 bottom-0 z-40 flex border-t border-separator pb-[env(safe-area-inset-bottom)] desk:hidden"
          >
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-caption font-medium transition-colors",
                    active ? "text-tint" : "text-text-dim",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
}
