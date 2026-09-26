"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseISODate, toISODate } from "@/lib/format";

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "pick a date",
}: {
  id?: string;
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
            onChange(date ? toISODate(date) : "");
            setOpen(false);
          }}
          className="font-mono"
        />
      </PopoverContent>
    </Popover>
  );
}
