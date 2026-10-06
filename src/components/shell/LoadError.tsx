"use client";

import { CloudOff } from "lucide-react";
import { Button } from "@/components/hig/button";
import { EmptyState } from "@/components/hig/layout";

export function LoadError({ what, reset }: { what: string; reset: () => void }) {
  return (
    <EmptyState
      icon={<CloudOff />}
      title={`Couldn't load ${what}`}
      className="py-24"
      action={
        <Button variant="accent" onClick={reset}>
          Try again
        </Button>
      }
    >
      The database didn&apos;t respond. Check your connection, then try again. If it keeps failing, the Supabase project may be paused.
    </EmptyState>
  );
}
