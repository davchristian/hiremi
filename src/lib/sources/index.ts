import { fetchGreenhouse } from "./greenhouse";
import { fetchLever } from "./lever";
import { fetchAshby } from "./ashby";
import { fetchRemoteOk } from "./remoteok";
import { fetchWeWorkRemotely } from "./weworkremotely";
import { fetchKalibrr } from "./kalibrr";
import type { JobSourceKind, NormalizedListing } from "./types";

export * from "./types";

const FETCHERS: Record<JobSourceKind, (slug: string) => Promise<NormalizedListing[]>> = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  remoteok: () => fetchRemoteOk(),
  weworkremotely: () => fetchWeWorkRemotely(),
  kalibrr: (country) => fetchKalibrr(country),
};

export function fetchSource(kind: JobSourceKind, slug: string): Promise<NormalizedListing[]> {
  return FETCHERS[kind](slug);
}
