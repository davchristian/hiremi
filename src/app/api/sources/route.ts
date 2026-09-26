import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSource, createSourceSchema, listSources } from "@/lib/job-sources";
import { toClientSource } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await listSources(user.id);
  return NextResponse.json({ sources: sources.map(toClientSource) });
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
  const parsed = createSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const source = await createSource(user.id, parsed.data);
  return NextResponse.json({ source: toClientSource(source) }, { status: 201 });
}
