import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { ashby } from "./ashby";
import { smartrecruiters } from "./smartrecruiters";
import { workable } from "./workable";
import { catapa } from "./catapa";
import { themuse } from "./themuse";
import { himalayas } from "./himalayas";
import type { JobSourceKind, NormalizedListing, SourceAdapter, SourceRef } from "./types";

export * from "./types";

const ADAPTERS: Partial<Record<JobSourceKind, SourceAdapter>> = {
  greenhouse,
  lever,
  ashby,
  smartrecruiters,
  workable,
  catapa,
  themuse,
  himalayas,
};

export function adapterFor(kind: JobSourceKind): SourceAdapter {
  const adapter = ADAPTERS[kind];
  if (!adapter) throw new Error(`No adapter for ${kind}`);
  return adapter;
}

export function fetchSource(source: SourceRef): Promise<NormalizedListing[]> {
  return adapterFor(source.kind).list(source);
}
