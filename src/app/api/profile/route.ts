import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile, profileSchema, upsertProfile } from "@/lib/profile";
import { toClientProfile } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getProfile(user.id);
  return NextResponse.json({ profile: profile ? toClientProfile(profile) : null });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const profile = await upsertProfile(user.id, parsed.data);
    return NextResponse.json({ profile: toClientProfile(profile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to save profile";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
