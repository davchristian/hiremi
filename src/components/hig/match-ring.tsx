import { cn } from "@/lib/utils";

export function MatchRing({
  value,
  size = 28,
  stroke,
  label,
  className,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const width = stroke ?? Math.max(2.5, size / 9);
  const radius = (size - width) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = value === null ? 0 : Math.min(1, Math.max(0.04, value));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 -rotate-90", className)}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(255 107 53 / 0.18)" strokeWidth={width} />
      {value !== null && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-tint)"
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={`${fraction * circumference} ${circumference}`}
          className="transition-[stroke-dasharray] duration-500 ease-standard"
        />
      )}
    </svg>
  );
}

export function percentileRanks<T extends { id: string; score: number | null }>(items: T[]): Map<string, number> {
  const scored = items.filter((item) => item.score !== null).map((item) => item.score as number);
  const ranks = new Map<string, number>();
  if (scored.length === 0) return ranks;
  for (const item of items) {
    if (item.score === null) continue;
    if (scored.length === 1) {
      ranks.set(item.id, 1);
      continue;
    }
    const below = scored.filter((score) => score < (item.score as number)).length;
    ranks.set(item.id, below / (scored.length - 1));
  }
  return ranks;
}

export function matchPhrase(rank: number | undefined): string | null {
  if (rank === undefined) return null;
  const percent = Math.round(rank * 100);
  if (percent >= 99) return "Best match in this list";
  if (percent >= 50) return `Better match than ${percent}% of this list`;
  return "A weaker match than most of this list";
}
