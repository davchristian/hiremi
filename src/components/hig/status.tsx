import { cn } from "@/lib/utils";

export function StatusDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export function StatusLabel({ color, children, className }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-callout text-text-muted", className)}>
      <StatusDot color={color} />
      {children}
    </span>
  );
}

const SPOKES = Array.from({ length: 8 }, (_, index) => index);

export function ActivityIndicator({ size = 16, label = "Loading", className }: { size?: number; label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {SPOKES.map((index) => (
        <span
          key={index}
          className="absolute left-1/2 top-0 rounded-full bg-current"
          style={{
            width: Math.max(1.5, size / 9),
            height: size * 0.3,
            marginLeft: -Math.max(1.5, size / 9) / 2,
            transformOrigin: `50% ${size / 2}px`,
            transform: `rotate(${index * 45}deg)`,
            animation: "spoke-fade 0.8s linear infinite",
            animationDelay: `${-0.8 + index * 0.1}s`,
          }}
        />
      ))}
    </span>
  );
}

export function IndeterminateProgress({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-busy="true"
      className={cn("relative h-1 w-full overflow-hidden rounded-full bg-fill", className)}
    >
      <span
        className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-tint"
        style={{ animation: "indeterminate 1.3s var(--ease-standard) infinite" }}
      />
    </div>
  );
}
