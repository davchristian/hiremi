"use client";

import { LoadError } from "@/components/shell/LoadError";

export default function ProfileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LoadError what="your profile" reset={reset} />;
}
