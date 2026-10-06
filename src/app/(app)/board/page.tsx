import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listJobs } from "@/lib/jobs";
import { toClientJob } from "@/lib/types";
import { Pipeline } from "@/components/pipeline/Pipeline";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/board");

  const jobs = await listJobs(user.id);
  return <Pipeline initialJobs={jobs.map(toClientJob)} />;
}
