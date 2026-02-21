import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, sendLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface WebhookPayload {
  lead_id: string;
  sender_inbox_id: string;
  email_number: number;
  status: "bounced" | "replied";
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload: WebhookPayload = await request.json();
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

  if (status === "replied") {
    // Mark lead as responded and completed
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
}
