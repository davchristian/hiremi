import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { addListingsToBoard } from "@/lib/feed";
import { toClientJob } from "@/lib/types";

const addSchema = z.object({
  listingIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const created = await addListingsToBoard(user.id, parsed.data.listingIds);
  return NextResponse.json({ jobs: created.map(toClientJob), added: created.length }, { status: 201 });
}
