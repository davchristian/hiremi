import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ChevronRight, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function GroupedSection({
  header,
  footer,
  children,
  className,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      {header && <h2 className="px-4 text-footnote font-semibold text-text-dim">{header}</h2>}
      <div className="overflow-hidden rounded-group bg-panel">{children}</div>
      {footer && <p className="px-4 text-footnote text-text-dim">{footer}</p>}
    </section>
  );
}

export function GroupedRow({
  label,
  value,
  leading,
  trailing,
  detail,
  href,
  external,
  onClick,
  className,
}: {
  label: ReactNode;
  value?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  detail?: ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3 border-b border-separator py-2.5 pr-4 group-last/row:border-b-0">
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 text-body text-text">{label}</span>
          {detail && <span className="truncate text-footnote text-text-muted">{detail}</span>}
        </span>
        {(value || trailing || href || onClick) && (
          <span className="flex shrink-0 items-center gap-2 text-body text-text-muted">
            {value}
            {trailing}
            {(href || onClick) && !trailing && <ChevronRight className="size-4 text-text-dim" strokeWidth={2} />}
          </span>
        )}
      </span>
    </>
  );

  const rowClass = cn(
    "group/row flex min-h-11 w-full items-center gap-3 pl-4 text-left",
    (href || onClick) && "transition-colors hover:bg-fill active:bg-fill-strong",
    className,
  );

  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noreferrer" className={rowClass}>
        {body}
      </a>
    ) : (
      <Link href={href} className={rowClass}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {body}
      </button>
    );
  }
  return <div className={rowClass}>{body}</div>;
}

const NOTICE_STYLES = {
  neutral: { box: "bg-fill", icon: <Info className="size-4 text-text-muted" strokeWidth={2} /> },
  warning: { box: "bg-warning-soft", icon: <AlertTriangle className="size-4 text-warning" strokeWidth={2} /> },
  error: { box: "bg-danger-soft", icon: <XCircle className="size-4 text-danger" strokeWidth={2} /> },
} as const;

export function Notice({
  tone = "neutral",
  title,
  children,
  action,
  icon,
  className,
}: {
  tone?: keyof typeof NOTICE_STYLES;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const style = NOTICE_STYLES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn("flex items-start gap-3 rounded-group px-3.5 py-3", style.box, className)}
    >
      <span className="mt-0.5 shrink-0">{icon ?? style.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && <p className="text-headline text-text">{title}</p>}
        {children && <div className="text-callout text-text-muted">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-16 text-center", className)}>
      <span className="text-text-dim [&_svg]:size-10 [&_svg]:stroke-[1.5]">{icon}</span>
      <div className="flex flex-col gap-1">
        <h2 className="text-headline text-[15px] text-text">{title}</h2>
        <p className="text-callout text-text-muted">{children}</p>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="text-large-title text-text">{title}</h1>
        {subtitle && <p className="text-callout text-text-muted tabular">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
