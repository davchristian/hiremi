"use client";

import { signOut } from "@/lib/auth-actions";

export function Header({ email }: { email: string }) {
  return (
    <header className="flex items-center justify-between border-b border-hairline bg-panel px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2.5 font-mono text-sm">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rejected/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-interview/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-offer/70" />
        </span>
        <span className="text-text">job-tracker</span>
        <span className="hidden text-text-dim sm:inline">main</span>
      </div>

      <div className="flex items-center gap-4 font-mono text-xs text-text-muted">
        <span className="hidden sm:inline">{email}</span>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded border border-hairline px-2.5 py-1.5 transition-colors hover:border-rejected hover:text-rejected"
          >
            sign out
          </button>
        </form>
      </div>
    </header>
  );
}
