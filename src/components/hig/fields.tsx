"use client";

import { forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from "react";
import { CalendarDays, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseISODate, toISODate } from "@/lib/format";

const CONTROL =
  "w-full rounded-control border border-hairline bg-panel-alt px-3 text-body text-text placeholder:text-text-dim transition-[border-color,box-shadow] duration-150 outline-none focus:border-tint focus:shadow-[0_0_0_3px_var(--color-tint-ring)] aria-invalid:border-danger disabled:opacity-50";

export function Field({
  label,
  htmlFor,
  helper,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  helper?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-callout font-medium text-text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-footnote text-danger">
          {error}
        </p>
      ) : (
        helper && <p className="text-footnote text-text-dim">{helper}</p>
      )}
    </div>
  );
}

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(CONTROL, "h-9", className)} {...props} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(CONTROL, "min-h-24 resize-y py-2 leading-5", className)} {...props} />;
});

export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (value: string) => void; label: string }
>(function SearchField({ value, onChange, label, className, ...props }, ref) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <Search aria-hidden className="pointer-events-none absolute left-2.5 size-3.5 text-text-dim" strokeWidth={2.25} />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
        className="h-8 w-full rounded-control bg-fill pl-8 pr-8 text-body text-text placeholder:text-text-dim outline-none transition-shadow focus:shadow-[0_0_0_3px_var(--color-tint-ring)] [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 flex size-4 items-center justify-center rounded-full bg-text-dim text-panel"
        >
          <X className="size-3" strokeWidth={3} />
        </button>
      )}
    </div>
  );
});

export function TokenField({
  id,
  values,
  onChange,
  placeholder,
  label,
}: {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const token = raw.trim().replace(/,$/, "").trim();
    if (token && !values.some((value) => value.toLowerCase() === token.toLowerCase())) {
      onChange([...values, token]);
    }
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-control border border-hairline bg-panel-alt px-1.5 py-1.5 transition-[border-color,box-shadow] focus-within:border-tint focus-within:shadow-[0_0_0_3px_var(--color-tint-ring)]">
      {values.map((value) => (
        <span key={value} className="inline-flex items-center gap-1 rounded-[6px] bg-tint-soft py-0.5 pl-2 pr-1 text-callout text-text">
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => onChange(values.filter((entry) => entry !== value))}
            className="flex size-4 items-center justify-center rounded-full text-text-muted hover:bg-fill-strong hover:text-text"
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-label={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={values.length ? "" : placeholder}
        className="h-6 min-w-24 flex-1 bg-transparent px-1.5 text-body text-text placeholder:text-text-dim outline-none"
      />
    </div>
  );
}

export function DateField({
  id,
  value,
  onChange,
  placeholder = "None",
  clearable = true,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISODate(value) : undefined;
  const label = selected
    ? selected.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : placeholder;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              id={id}
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-control bg-fill-strong px-3 text-body text-text transition-[background-color,transform] active:scale-[0.97] hover:bg-fill-hover"
            />
          }
        >
          <CalendarDays className="size-4 text-text-muted" strokeWidth={2} />
          <span className={cn("tabular", !selected && "text-text-muted")}>{label}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="material-menu w-auto rounded-[10px] border border-separator p-1">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              onChange(date ? toISODate(date) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <button type="button" onClick={() => onChange("")} className="text-callout text-tint hover:underline">
          Clear
        </button>
      )}
    </div>
  );
}
