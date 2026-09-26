import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reserveManualIngest, runIngest } from "@/lib/ingest";

export const maxDuration = 60;

function hasCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function handler(request: Request) {
  if (!hasCronSecret(request)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reservation = await reserveManualIngest(user.id);
    if (!reservation.ok) {
      const minutes = Math.ceil(reservation.retryAfter / 60);
      return NextResponse.json(
        {
          error: `refreshed recently — try again in ${minutes}m`,
          retryAfter: reservation.retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(reservation.retryAfter) } },
      );
    }
  }

  try {
    return NextResponse.json(await runIngest());
  } catch (error) {
    const message = error instanceof Error ? error.message : "ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = handler;
export const GET = handler;
