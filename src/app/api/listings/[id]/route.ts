import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobListings } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

const rowId = z.guid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rowId.safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [listing] = await db
    .select({ description: jobListings.description, department: jobListings.department, employmentType: jobListings.employmentType })
    .from(jobListings)
    .where(eq(jobListings.id, id));
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ listing });
}
