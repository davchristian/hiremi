import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createJob, createJobSchema, listJobs } from "@/lib/jobs";
import { toClientJob } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await listJobs(user.id);
  return NextResponse.json({ jobs: jobs.map(toClientJob) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const job = await createJob(user.id, parsed.data);
  return NextResponse.json({ job: toClientJob(job) }, { status: 201 });
}
