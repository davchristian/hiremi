import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { matchListings } from "@/lib/feed";
import { getProfile } from "@/lib/profile";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const profile = await getProfile(user.id);

  const matches = await matchListings(user.id, profile, {
    limit: Math.min(Number(params.get("limit")) || 40, 100),
    query: params.get("q") ?? undefined,
    remoteOnly: params.get("remote") === "1",
    hideTracked: params.get("hideTracked") === "1",
    indonesiaOnly: params.get("indonesia") === "1",
  });

  return NextResponse.json({
    matches,
    ranked: Boolean(profile?.embedding),
    hasProfile: Boolean(profile),
  });
}
