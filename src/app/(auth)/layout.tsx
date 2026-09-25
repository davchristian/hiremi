export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 font-mono text-sm text-text-muted">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rejected/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-interview/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-offer/70" />
          </span>
          <span>~/job-tracker</span>
        </div>
        <div className="rounded-md border border-hairline bg-panel p-6 shadow-lg shadow-black/20">
          {children}
        </div>
      </div>
    </div>
  );
}
