"use client";

import { LoadError } from "@/components/shell/LoadError";

export default function SourcesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LoadError what="your sources" reset={reset} />;
}
