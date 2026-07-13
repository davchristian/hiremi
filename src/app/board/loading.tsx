import { STAGE_ORDER, STAGE_CONFIG } from "@/lib/stage";

export default function BoardLoading() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-base">
      <div className="h-[52px] shrink-0 border-b border-hairline bg-panel" />
      <div className="h-[45px] shrink-0 border-b border-hairline bg-panel" />
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden px-4 py-4 sm:px-6">
        {STAGE_ORDER.map((stage) => (
          <div key={stage} className="flex w-[280px] shrink-0 flex-col gap-3 sm:w-[300px]">
            <div className="flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${STAGE_CONFIG[stage].dotClass} opacity-50`} />
              <span className="font-mono text-xs uppercase tracking-wider text-text-dim">
                {STAGE_CONFIG[stage].label}
              </span>
            </div>
            <div className="flex-1 animate-pulse rounded-md border border-hairline bg-panel" />
          </div>
        ))}
      </div>
    </div>
  );
}
