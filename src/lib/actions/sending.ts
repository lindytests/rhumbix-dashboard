"use server";

import { db } from "@/lib/db";
import { appSettings, leads, senderInboxes, sendLogs, leadStatusEnum } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { executeSendBatch } from "@/lib/send-engine";

export async function toggleAutoSend(enabled: boolean) {
  const [existing] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1));

  if (existing) {
    await db
      .update(appSettings)
      .set({ auto_send_enabled: enabled, updated_at: new Date() })
      .where(eq(appSettings.id, 1));
  } else {
    await db
      .insert(appSettings)
      .values({ id: 1, auto_send_enabled: enabled });
  }
  revalidatePath("/dashboard");
}

export async function toggleTestMode(enabled: boolean) {
  const [existing] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1));

  if (existing) {
    await db
      .update(appSettings)
      .set({ test_mode: enabled, updated_at: new Date() })
      .where(eq(appSettings.id, 1));
  } else {
    await db
      .insert(appSettings)
      .values({ id: 1, test_mode: enabled });
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function manualSendBatch(): Promise<{
  sent: number;
  errors: number;
}> {
  const result = await executeSendBatch();
  revalidatePath("/dashboard");
  return result;
}

type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
type LeadRow = typeof leads.$inferSelect;

const NEXT_EMAIL: Record<string, { emailNum: number; nextStatus: LeadStatus }> = {
  pending: { emailNum: 1, nextStatus: "email_1_sent" },
  email_1_sent: { emailNum: 2, nextStatus: "email_2_sent" },
  email_2_sent: { emailNum: 3, nextStatus: "email_3_sent" },
  email_3_sent: { emailNum: 4, nextStatus: "email_4_sent" },
  email_4_sent: { emailNum: 5, nextStatus: "email_5_sent" },
};

const EMAIL_FIELDS: Record<number, { subject: keyof LeadRow; body: keyof LeadRow }> = {
  1: { subject: "email_1_subject", body: "email_1_body" },
  2: { subject: "email_2_subject", body: "email_2_body" },
  3: { subject: "email_3_subject", body: "email_3_body" },
  4: { subject: "email_4_subject", body: "email_4_body" },
  5: { subject: "email_5_subject", body: "email_5_body" },
};

function getEmailContent(
  lead: LeadRow,
  emailNum: number
): { subject: string; body: string } | null {
  const fields = EMAIL_FIELDS[emailNum];
  if (!fields) return null;
  const subject = lead[fields.subject] as string | null;
  const body = lead[fields.body] as string | null;
  if (!subject || !body) return null;
  return { subject, body };
}

export async function sendSingleLead(
  leadId: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();

  // Fetch lead + sender inbox (no campaign join needed)
  const [row] = await db
    .select({ lead: leads, inbox: senderInboxes })
    .from(leads)
    .innerJoin(senderInboxes, eq(leads.sender_inbox_id, senderInboxes.id))
    .where(eq(leads.id, leadId));

  if (!row) {
    return { success: false, error: "Lead not found or no sender assigned" };
  }

  const { lead, inbox } = row;

  if (lead.status === "completed" || lead.status === "failed") {
    return { success: false, error: "Lead is already completed or failed" };
  }
  if (lead.response_received) {
    return { success: false, error: "Lead has already responded" };
  }

  const next = NEXT_EMAIL[lead.status];
  if (!next) {
    return { success: false, error: "No more emails in the sequence" };
  }

  const content = getEmailContent(lead, next.emailNum);
  if (!content) {
    await db
      .update(leads)
      .set({ status: "completed", updated_at: now })
      .where(eq(leads.id, lead.id));
    revalidatePath("/dashboard/leads");
    return { success: false, error: "No email content configured for next step; lead marked completed" };
  }

  // GUARD 1: Dedup check
  const [alreadySent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sendLogs)
    .where(
      and(
        eq(sendLogs.lead_id, lead.id),
        eq(sendLogs.email_number, next.emailNum),
        eq(sendLogs.status, "sent")
      )
    );
  if ((alreadySent?.count ?? 0) > 0) {
    return { success: false, error: "This email was already sent" };
  }

  // GUARD 2: Bounce check
  const [hasBounce] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sendLogs)
    .where(
      and(
        eq(sendLogs.lead_id, lead.id),
        eq(sendLogs.status, "bounced")
      )
    );
  if ((hasBounce?.count ?? 0) > 0) {
    await db
      .update(leads)
      .set({ status: "failed", updated_at: now })
      .where(eq(leads.id, lead.id));
    revalidatePath("/dashboard/leads");
    return { success: false, error: "Previous email bounced; lead marked failed" };
  }

  // GUARD 3: Optimistic claim
  const claimed = await db
    .update(leads)
    .set({
      status: next.nextStatus,
      contacted_at: now,
      updated_at: now,
    })
    .where(
      and(eq(leads.id, lead.id), eq(leads.status, lead.status))
    )
    .returning({ id: leads.id });
  if (claimed.length === 0) {
    return { success: false, error: "Lead status changed concurrently, please refresh" };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (inbox.lindy_webhook_secret) {
      headers["Authorization"] = `Bearer ${inbox.lindy_webhook_secret}`;
    }

    const res = await fetch(inbox.lindy_webhook_url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: lead.email,
        subject: content.subject,
        body: content.body,
        lead_id: lead.id,
        sender_inbox_id: inbox.id,
        email_number: next.emailNum,
        lead_data: {
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          company: lead.company,
          title: lead.title,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}`);
    }

    await db.insert(sendLogs).values({
      lead_id: lead.id,
      sender_inbox_id: inbox.id,
      email_number: next.emailNum,
      status: "sent",
    });

    revalidatePath("/dashboard/leads");
    return { success: true };
  } catch {
    await db
      .update(leads)
      .set({
        status: lead.status,
        contacted_at: lead.contacted_at,
        updated_at: now,
      })
      .where(eq(leads.id, lead.id));

    await db.insert(sendLogs).values({
      lead_id: lead.id,
      sender_inbox_id: inbox.id,
      email_number: next.emailNum,
      status: "failed",
    });

    revalidatePath("/dashboard/leads");
    return { success: false, error: "Failed to send email via webhook" };
  }
}
