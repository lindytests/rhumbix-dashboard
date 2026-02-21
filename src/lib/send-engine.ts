import { db } from "@/lib/db";
import { appSettings, campaigns, leads, senderInboxes, sendLogs } from "@/lib/db/schema";
import { eq, and, gte, ne, sql, isNull } from "drizzle-orm";

const NEXT_EMAIL: Record<string, { emailNum: number; nextStatus: string }> = {
  pending: { emailNum: 1, nextStatus: "email_1_sent" },
  email_1_sent: { emailNum: 2, nextStatus: "email_2_sent" },
  email_2_sent: { emailNum: 3, nextStatus: "email_3_sent" },
  email_3_sent: { emailNum: 4, nextStatus: "email_4_sent" },
  email_4_sent: { emailNum: 5, nextStatus: "email_5_sent" },
};

function getWaitDays(
  campaign: {
    wait_after_email_1: number | null;
    wait_after_email_2: number | null;
    wait_after_email_3: number | null;
    wait_after_email_4: number | null;
  },
  currentStatus: string
): number | null {
  const map: Record<string, number | null> = {
    email_1_sent: campaign.wait_after_email_1,
    email_2_sent: campaign.wait_after_email_2,
    email_3_sent: campaign.wait_after_email_3,
    email_4_sent: campaign.wait_after_email_4,
  };
  return map[currentStatus] ?? null;
}

function addCalendarDaysSkipWeekends(start: Date, days: number): Date {
  const result = new Date(start);
  result.setDate(result.getDate() + days);
  // If it lands on a weekend, roll forward to Monday
  const day = result.getDay();
  if (day === 0) result.setDate(result.getDate() + 1); // Sunday → Monday
  if (day === 6) result.setDate(result.getDate() + 2); // Saturday → Monday
  return result;
}

function getEmailContent(
  campaign: Record<string, unknown>,
  emailNum: number
): { subject: string; body: string } | null {
  const subject = campaign[`email_${emailNum}_subject`] as string | null;
  const body = campaign[`email_${emailNum}_body`] as string | null;
  if (!subject || !body) return null;
  return { subject, body };
}

export interface SendBatchOptions {
  campaignId?: string;
}

export interface SendBatchResult {
  sent: number;
  errors: number;
}

export async function executeSendBatch(
  options: SendBatchOptions = {}
): Promise<SendBatchResult> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfHour = new Date(now);
  startOfHour.setMinutes(0, 0, 0);

  const [settingsRow] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1));
  const testMode = settingsRow?.test_mode ?? false;

  const activeInboxes = await db
    .select()
    .from(senderInboxes)
    .where(eq(senderInboxes.is_active, true));

  let totalSent = 0;
  let totalErrors = 0;

  for (const inbox of activeInboxes) {
    const [dailyCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sendLogs)
      .where(
        and(
          eq(sendLogs.sender_inbox_id, inbox.id),
          gte(sendLogs.sent_at, startOfDay),
          eq(sendLogs.status, "sent")
        )
      );

    const [hourlyCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sendLogs)
      .where(
        and(
          eq(sendLogs.sender_inbox_id, inbox.id),
          gte(sendLogs.sent_at, startOfHour),
          eq(sendLogs.status, "sent")
        )
      );

    const dailyRemaining = inbox.daily_limit - (dailyCount?.count ?? 0);
    const hourlyRemaining = inbox.hourly_limit - (hourlyCount?.count ?? 0);
    const batchSize = Math.min(dailyRemaining, hourlyRemaining);

    if (batchSize <= 0) continue;

    const conditions = [
      eq(leads.sender_inbox_id, inbox.id),
      ne(leads.status, "completed"),
      ne(leads.status, "failed"),
      eq(leads.response_received, false),
      isNull(leads.deleted_at),
    ];

    if (options.campaignId) {
      conditions.push(eq(leads.campaign_id, options.campaignId));
    }

    const eligibleLeads = await db
      .select({
        lead: leads,
        campaign: campaigns,
      })
      .from(leads)
      .innerJoin(campaigns, eq(leads.campaign_id, campaigns.id))
      .where(and(...conditions))
      .limit(batchSize);

    for (const { lead, campaign } of eligibleLeads) {
      if (lead.status !== "pending") {
        const waitDays = getWaitDays(campaign, lead.status);
        if (waitDays !== null && lead.contacted_at) {
          let waitUntil: Date;
          if (testMode) {
            waitUntil = new Date(lead.contacted_at);
            waitUntil.setMinutes(waitUntil.getMinutes() + waitDays);
          } else {
            waitUntil = addCalendarDaysSkipWeekends(new Date(lead.contacted_at), waitDays);
          }
          if (now < waitUntil) continue;
        }
      }

      const next = NEXT_EMAIL[lead.status];
      if (!next) {
        await db
          .update(leads)
          .set({ status: "completed", updated_at: now })
          .where(eq(leads.id, lead.id));
        continue;
      }

      const content = getEmailContent(
        campaign as unknown as Record<string, unknown>,
        next.emailNum
      );
      if (!content) {
        await db
          .update(leads)
          .set({ status: "completed", updated_at: now })
          .where(eq(leads.id, lead.id));
        continue;
      }

      // GUARD 1: Check send_logs across ALL leads (including soft-deleted)
      // with the same email + campaign. This prevents duplicate sends when a
      // lead is deleted and re-added to the same campaign.
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
      if ((alreadySent?.count ?? 0) > 0) continue;

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
        continue;
      }

      // GUARD 2: Optimistic claim — atomically advance status before sending.
      // If another concurrent run already claimed this lead, 0 rows update and we skip.
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
      if (claimed.length === 0) continue;

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

        totalSent++;
      } catch {
        // Webhook failed — roll back the optimistic claim
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
        totalErrors++;
      }
    }
  }

  return { sent: totalSent, errors: totalErrors };
}
