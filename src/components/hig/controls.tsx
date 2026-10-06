"use client";

import { useRef, type KeyboardEvent } from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex h-8 shrink-0 rounded-control bg-fill p-0.5", className)}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "min-w-0 flex-1 whitespace-nowrap rounded-[6px] px-3 text-callout font-medium transition-[background-color,color,box-shadow] duration-150 ease-standard",
              selected ? "bg-panel-raised text-text shadow-[0_1px_2px_rgb(0_0_0/0.4),inset_0_0_0_0.5px_rgb(245_240_230/0.12)]" : "text-text-muted hover:text-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(next) => onChange(next)}
      aria-label={label}
      className="relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full bg-fill-strong p-0.5 transition-colors duration-200 ease-standard data-checked:bg-tint disabled:opacity-40"
    >
      <SwitchPrimitive.Thumb className="block size-[18px] rounded-full bg-text shadow-[0_1px_3px_rgb(0_0_0/0.45)] transition-transform duration-200 ease-standard data-checked:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}
