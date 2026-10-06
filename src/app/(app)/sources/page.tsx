import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listSources } from "@/lib/job-sources";
import { refreshOverview } from "@/lib/refresh";
import { toClientSource } from "@/lib/types";
import { Sources } from "@/components/sources/Sources";

export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/sources");

  const [sources, overview] = await Promise.all([listSources(user.id), refreshOverview()]);
  return <Sources initialSources={sources.map(toClientSource)} overview={overview} />;
}
