"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { timeAgo } from "@/lib/format";
import type { ClientSource } from "@/lib/types";
import {
  acceptsSlug,
  SOURCE_KINDS,
  SOURCE_LABELS,
  SOURCE_NEEDS_SLUG,
  SOURCE_SLUG_HINTS,
  type JobSourceKind,
} from "@/lib/source-meta";

export function SourceManager({
  sources,
  onClose,
  onChange,
}: {
  sources: ClientSource[];
  onClose: () => void;
  onChange: (sources: ClientSource[]) => void;
}) {
  const [kind, setKind] = useState<JobSourceKind>("kalibrr");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsSlug = SOURCE_NEEDS_SLUG[kind];
  const slugEditable = acceptsSlug(kind);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (needsSlug && !slug.trim()) {
      setError("this source needs the company's board slug");
      return;
    }
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, slug: slugEditable ? slug.trim() : "", label: "" }),
      });
      if (!res.ok) throw new Error("request failed");
      const { source } = (await res.json()) as { source: ClientSource };
      onChange([...sources.filter((s) => s.id !== source.id), source]);
      setSlug("");
    } catch {
      setError("failed to add source");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    const previous = sources;
    onChange(sources.filter((s) => s.id !== id));
    setError(null);

    try {
      const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("request failed");
    } catch {
      onChange(previous);
      setError("failed to remove source");
    }
  }

  return (
    <Modal title="job sources" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs text-text-dim">
          Public job-board feeds to poll. Aggregate feeds work as-is; company boards need the
          slug from their careers URL.
        </p>

        {sources.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {sources.map((source) => (
              <li
                key={source.id}
                className="flex items-center justify-between gap-2 rounded border border-hairline bg-panel-alt px-2.5 py-1.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-xs text-text">
                    {SOURCE_LABELS[source.kind]}
                    {source.slug && <span className="text-text-muted"> · {source.slug}</span>}
                  </span>
                  {source.lastError ? (
                    <span
                      title={source.lastError}
                      className="truncate font-mono text-[10px] text-rejected"
                    >
                      {source.lastFetchedAt ? `failed ${timeAgo(source.lastFetchedAt)}: ` : ""}
                      {source.lastError}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-text-dim">
                      {source.lastFetchedAt
                        ? `fetched ${timeAgo(source.lastFetchedAt)}`
                        : "not fetched yet"}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => handleRemove(source.id)}
                  aria-label={`remove ${SOURCE_LABELS[source.kind]} ${source.slug}`}
                  className="font-mono text-[11px] text-text-muted hover:border-rejected hover:text-rejected"
                >
                  remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-col gap-2 border-t border-hairline pt-4">
          <Label htmlFor="source-kind" className="font-mono text-xs font-normal text-text-muted">
            add a source
          </Label>
          <div className="flex gap-2">
            <select
              id="source-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as JobSourceKind)}
              className="h-8 rounded-[min(var(--radius-md),12px)] border border-input bg-panel-alt px-2 font-mono text-xs text-text outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {SOURCE_KINDS.map((value) => (
                <option key={value} value={value}>
                  {SOURCE_LABELS[value]}
                </option>
              ))}
            </select>
            <Input
              value={slugEditable ? slug : ""}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!slugEditable}
              placeholder={
                needsSlug ? "board slug" : slugEditable ? "Indonesia" : "no slug needed"
              }
              aria-label="board slug"
              className="min-w-0 flex-1 bg-panel-alt font-mono text-xs"
            />
            <Button type="submit" size="sm" disabled={busy} className="font-mono text-xs">
              add
            </Button>
          </div>
          <p className="font-mono text-[11px] text-text-dim">{SOURCE_SLUG_HINTS[kind]}</p>
          {error && <p className="font-mono text-xs text-rejected">{error}</p>}
        </form>
      </div>
    </Modal>
  );
}
