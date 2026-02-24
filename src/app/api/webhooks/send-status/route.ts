import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { leads, sendLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface WebhookPayload {
  lead_id: string;
  sender_inbox_id: string;
  email_number: number;
  status: "bounced" | "replied" | "stop_requested";
}

function verifySecret(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret (timing-safe)
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[webhook] WEBHOOK_SECRET env var is not set — all requests will be rejected");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const authHeader = request.headers.get("authorization");
    if (!verifySecret(authHeader, webhookSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: WebhookPayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { lead_id, sender_inbox_id, email_number, status } = payload;

    if (!lead_id || !status) {
      return NextResponse.json(
        { error: "Missing lead_id or status" },
        { status: 400 }
      );
    }

    const now = new Date();

    if (status === "bounced") {
      // Update send log
      await db
        .update(sendLogs)
        .set({ status: "bounced" })
        .where(
          and(
            eq(sendLogs.lead_id, lead_id),
            eq(sendLogs.sender_inbox_id, sender_inbox_id),
            eq(sendLogs.email_number, email_number)
          )
        );

      // Mark lead as failed
      await db
        .update(leads)
        .set({ status: "failed", updated_at: now })
        .where(eq(leads.id, lead_id));
    }

    if (status === "replied" || status === "stop_requested") {
      // Mark lead as responded and completed (stops the sequence)
      await db
        .update(leads)
        .set({
          response_received: true,
          status: "completed",
          updated_at: now,
        })
        .where(eq(leads.id, lead_id));
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
