import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { executeSendBatch } from "@/lib/send-engine";

export const dynamic = "force-dynamic";

function verifySecret(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

function isBusinessHours(): boolean {
  const now = new Date();
  const est = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = est.getDay();
  const hour = est.getHours();
  return day >= 1 && day <= 5 && hour >= 7 && hour < 19;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET env var is not set — all requests will be rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (!verifySecret(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBusinessHours()) {
    return NextResponse.json({ message: "Outside business hours" });
  }

  // Check if auto-send is enabled
  const [settings] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1));

  if (!settings?.auto_send_enabled) {
    return NextResponse.json({ message: "Auto-send is disabled" });
  }

  // Advisory lock prevents concurrent batch executions (e.g. overlapping cron
  // invocations or cron + manual "Send Now" racing).  pg_try_advisory_lock is
  // non-blocking: if the lock is already held the call returns false and we
  // skip this run rather than queue up.
  const BATCH_LOCK_ID = 73901; // arbitrary unique id
  const [lockResult] = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${BATCH_LOCK_ID}) as acquired`
  );
  if (!lockResult?.acquired) {
    return NextResponse.json({ message: "Another batch is already running" });
  }

  try {
    const result = await executeSendBatch();

    return NextResponse.json({
      message: `Batch complete: ${result.sent} emails sent`,
      sent: result.sent,
      errors: result.errors,
    });
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${BATCH_LOCK_ID})`);
  }
}
