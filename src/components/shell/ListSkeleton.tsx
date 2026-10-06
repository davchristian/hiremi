export function ListSkeleton({ title, rows = 6, split = false }: { title: string; rows?: number; split?: boolean }) {
  const list = (
    <div className="overflow-hidden rounded-group bg-panel" style={{ animation: "shimmer 1.6s ease-in-out infinite" }}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-separator py-3 pl-4 pr-4 last:border-b-0">
          <span className="size-2 rounded-full bg-fill-strong" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3 w-2/5 rounded bg-fill-strong" />
            <span className="h-2.5 w-3/5 rounded bg-fill" />
          </span>
          <span className="h-2.5 w-14 rounded bg-fill" />
        </div>
      ))}
    </div>
  );

  return (
    <div role="status" aria-label={`Loading ${title}`} className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 py-6 desk:px-8 desk:py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-large-title text-text">{title}</h1>
        <span className="h-3 w-48 rounded bg-fill" />
      </div>
      {split ? <div className="grid gap-6 desk:grid-cols-[minmax(0,380px)_1fr]">{list}<div className="hidden h-96 rounded-group bg-panel desk:block" /></div> : list}
    </div>
  );
}
