"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Parses "YYYY-MM-DD" as a local date (new Date(string) would shift it via UTC). */
function parseISODate(value: string): Date | undefined {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Formats a Date as local "YYYY-MM-DD". */
function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "pick a date",
}: {
  id?: string;
  /** "YYYY-MM-DD" or "" when unset. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISODate(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className="w-full justify-between bg-panel-alt px-2.5 font-mono text-sm font-normal"
          />
        }
      >
        <span className={selected ? "text-text" : "text-text-dim"}>{value || placeholder}</span>
        <CalendarIcon className="text-text-muted" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto border border-hairline bg-panel-alt p-1">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            // Re-clicking the selected day passes undefined, which clears the date.
            onChange(date ? toISODate(date) : "");
            setOpen(false);
          }}
          className="font-mono"
        />
      </PopoverContent>
    </Popover>
  );
}
