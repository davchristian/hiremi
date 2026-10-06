"use client";

import { LoadError } from "@/components/shell/LoadError";

export default function DiscoverError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LoadError what="postings" reset={reset} />;
}
