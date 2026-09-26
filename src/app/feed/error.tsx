"use client";

export default function FeedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-base px-4 text-center">
      <p className="font-mono text-sm text-rejected">$ error: failed to load feed</p>
      <p className="max-w-sm text-sm text-text-muted">
        Something went wrong reaching the database. If this is the first run, the feed migration
        may not have been applied yet.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded border border-hairline px-3 py-1.5 font-mono text-xs text-text-muted transition-colors hover:border-applied hover:text-applied"
      >
        retry
      </button>
    </div>
  );
}
