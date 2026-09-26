import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listJobs } from "@/lib/jobs";
import { toClientJob } from "@/lib/types";
import { Board } from "@/components/Board";
import { Header } from "@/components/Header";

export default async function BoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect=/board");
  }

  const jobs = await listJobs(user.id);
  const clientJobs = jobs.map(toClientJob);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-base">
      <Header email={user.email ?? ""} />
      <Board initialJobs={clientJobs} />
    </div>
  );
}
