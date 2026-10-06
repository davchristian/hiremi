"use client";

import { LoadError } from "@/components/shell/LoadError";

export default function PipelineError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LoadError what="your pipeline" reset={reset} />;
}
