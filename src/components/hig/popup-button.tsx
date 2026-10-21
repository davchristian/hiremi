"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/hig/status";

export type PopUpOption<T extends string> = {
  value: T;
  label: string;
  color?: string;
  disabled?: boolean;
};

export function PopUpButton<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  variant = "gray",
  className,
  id,
  disabled,
}: {
  value: T;
  options: PopUpOption<T>[];
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  variant?: "gray" | "plain";
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  const current = options.find((option) => option.value === value);

  return (
    <Select.Root
      items={options.map((option) => ({ value: option.value, label: option.label }))}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null && next !== value) onChange(next as T);
      }}
    >
      <Select.Trigger
        id={id}
        aria-label={label}
        className={cn(
          "inline-flex min-w-0 select-none items-center justify-between gap-2 rounded-control font-medium transition-[background-color,transform] duration-150 ease-standard active:scale-[0.97] data-popup-open:bg-fill-strong disabled:opacity-40",
          size === "sm" ? "h-7 pl-2.5 pr-1.5 text-callout" : "h-8 pl-3 pr-2 text-body",
          variant === "gray" ? "bg-fill-strong text-text hover:bg-fill-hover" : "text-text-muted hover:bg-fill hover:text-text",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.color && <StatusDot color={current.color} />}
          <Select.Value className="truncate">{() => current?.label ?? label}</Select.Value>
        </span>
        <Select.Icon className="text-text-dim">
          <ChevronsUpDown className="size-3.5" strokeWidth={2} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} className="z-[60] select-none outline-none">
          <Select.Popup className="material-menu min-w-[max(var(--anchor-width),11rem)] origin-[var(--transform-origin)] rounded-[10px] border border-separator p-1 text-body text-text shadow-2xl shadow-shade/50 outline-none transition-[transform,opacity] duration-100 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-starting-style:opacity-100">
            <Select.List className="max-h-[var(--available-height)] overflow-y-auto">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-1.5 rounded-[6px] py-1.5 pl-1.5 pr-3 outline-none select-none data-disabled:opacity-40 data-highlighted:bg-tint data-highlighted:text-on-tint"
                >
                  <Select.ItemIndicator className="col-start-1">
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </Select.ItemIndicator>
                  <Select.ItemText className="col-start-2 flex items-center gap-2">
                    {option.color && <StatusDot color={option.color} />}
                    {option.label}
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
