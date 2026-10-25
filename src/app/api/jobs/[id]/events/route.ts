import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listStageEvents } from "@/lib/jobs";
import { toClientStageEvent } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await listStageEvents(user.id, id);
  return NextResponse.json({ events: events.map(toClientStageEvent) });
}
