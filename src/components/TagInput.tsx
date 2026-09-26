"use client";

import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

export function TagInput({
  id,
  values,
  onChange,
  placeholder,
  accent = "applied",
}: {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  accent?: "applied" | "wishlist";
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const tag = raw.trim().replace(/,$/, "");
    if (!tag) return;
    if (!values.some((value) => value.toLowerCase() === tag.toLowerCase())) {
      onChange([...values, tag]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  const chipAccent =
    accent === "wishlist"
      ? "border-wishlist/40 text-wishlist"
      : "border-applied/40 text-applied";

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`remove ${value}`}
                className={`group flex items-center gap-1 rounded-full border bg-panel-alt px-2 py-0.5 font-mono text-[11px] transition-colors hover:border-rejected hover:text-rejected ${chipAccent}`}
              >
                {value}
                <span aria-hidden className="text-text-dim group-hover:text-rejected">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={placeholder}
        className="bg-panel-alt font-mono text-sm"
      />
    </div>
  );
}
