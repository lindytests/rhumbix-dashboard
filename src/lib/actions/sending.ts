"use server";

import { db } from "@/lib/db";
import { appSettings, campaigns, leads, senderInboxes, sendLogs } from "@/lib/db/schema";
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

export async function manualSendCampaign(
  campaignId: string
): Promise<{ sent: number; errors: number }> {
  const result = await executeSendBatch({ campaignId });
  revalidatePath("/dashboard");
  return result;
}

const NEXT_EMAIL: Record<string, { emailNum: number; nextStatus: string }> = {
  pending: { emailNum: 1, nextStatus: "email_1_sent" },
  email_1_sent: { emailNum: 2, nextStatus: "email_2_sent" },
  email_2_sent: { emailNum: 3, nextStatus: "email_3_sent" },
  email_3_sent: { emailNum: 4, nextStatus: "email_4_sent" },
  email_4_sent: { emailNum: 5, nextStatus: "email_5_sent" },
};

function getEmailContent(
  campaign: Record<string, unknown>,
  emailNum: number
): { subject: string; body: string } | null {
  const subject = campaign[`email_${emailNum}_subject`] as string | null;
  const body = campaign[`email_${emailNum}_body`] as string | null;
  if (!subject || !body) return null;
  return { subject, body };
}

export async function sendSingleLead(
  leadId: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();

  // Fetch lead + campaign + sender inbox
  const [row] = await db
    .select({ lead: leads, campaign: campaigns, inbox: senderInboxes })
    .from(leads)
    .innerJoin(campaigns, eq(leads.campaign_id, campaigns.id))
    .innerJoin(senderInboxes, eq(leads.sender_inbox_id, senderInboxes.id))
    .where(eq(leads.id, leadId));

  if (!row) {
    return { success: false, error: "Lead not found or no sender assigned" };
  }

  const { lead, campaign, inbox } = row;

  // Validate status
  if (lead.status === "completed" || lead.status === "failed") {
    return { success: false, error: "Lead is already completed or failed" };
  }
  if (lead.response_received) {
    return { success: false, error: "Lead has already responded" };
  }

  // Determine next email in sequence
  const next = NEXT_EMAIL[lead.status];
  if (!next) {
    return { success: false, error: "No more emails in the sequence" };
  }

  const content = getEmailContent(
    campaign as unknown as Record<string, unknown>,
    next.emailNum
  );
  if (!content) {
    // No email content configured for this step — mark completed
    await db
      .update(leads)
      .set({ status: "completed", updated_at: now })
      .where(eq(leads.id, lead.id));
    revalidatePath("/dashboard/leads");
    return { success: false, error: "No email content configured for next step; lead marked completed" };
  }

  // GUARD 1: Duplicate check across all leads (including soft-deleted)
  const [alreadySent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sendLogs)
    .innerJoin(leads, eq(sendLogs.lead_id, leads.id))
    .where(
      and(
        eq(leads.email, lead.email),
        eq(leads.campaign_id, lead.campaign_id),
        eq(sendLogs.email_number, next.emailNum),
        eq(sendLogs.status, "sent")
      )
    );
  if ((alreadySent?.count ?? 0) > 0) {
    return { success: false, error: "This email was already sent to this address" };
  }

  // GUARD 2: Bounce check
  const [hasBounce] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sendLogs)
    .innerJoin(leads, eq(sendLogs.lead_id, leads.id))
    .where(
      and(
        eq(leads.email, lead.email),
        eq(leads.campaign_id, lead.campaign_id),
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
      status: next.nextStatus as typeof lead.status,
      contacted_at: now,
      updated_at: now,
    })
    .where(
      and(eq(leads.id, lead.id), eq(leads.status, lead.status as typeof lead.status))
    )
    .returning({ id: leads.id });
  if (claimed.length === 0) {
    return { success: false, error: "Lead status changed concurrently, please refresh" };
  }

  // Send via webhook (skip cooldown — manual override)
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
    // Roll back optimistic claim
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
