"use client";

import { Discover } from "@/components/discover/Discover";
import { primeDescriptions } from "@/components/discover/PostingDetail";
import { PREVIEW_DESCRIPTIONS, PREVIEW_MATCHES } from "@/app/preview/fixtures";

primeDescriptions(PREVIEW_DESCRIPTIONS);

export function PreviewDiscover() {
  return <Discover initialMatches={PREVIEW_MATCHES} ranked hasProfile sourceCount={10} />;
}
