import { db } from "@/lib/db";
import { appSettings, leads, senderInboxes, sendLogs } from "@/lib/db/schema";
import { eq, and, gte, ne, sql, isNull, inArray, asc } from "drizzle-orm";

type LeadStatus = (typeof leads.$inferSelect)["status"];
type LeadRow = typeof leads.$inferSelect;

const NEXT_EMAIL: Record<string, { emailNum: number; nextStatus: LeadStatus }> = {
  pending: { emailNum: 1, nextStatus: "email_1_sent" },
  email_1_sent: { emailNum: 2, nextStatus: "email_2_sent" },
  email_2_sent: { emailNum: 3, nextStatus: "email_3_sent" },
  email_3_sent: { emailNum: 4, nextStatus: "email_4_sent" },
  email_4_sent: { emailNum: 5, nextStatus: "email_5_sent" },
};

const SENDABLE_STATUSES: LeadStatus[] = [
  "pending",
  "email_1_sent",
  "email_2_sent",
  "email_3_sent",
  "email_4_sent",
];

function getWaitDays(
  lead: LeadRow,
  currentStatus: string
): number | null {
  const map: Record<string, number | null> = {
    email_1_sent: lead.wait_after_email_1,
    email_2_sent: lead.wait_after_email_2,
    email_3_sent: lead.wait_after_email_3,
    email_4_sent: lead.wait_after_email_4,
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

async function rebalanceLeads(
  activeInboxes: { id: string }[]
) {
  if (activeInboxes.length === 0) return;

  const activeIds = activeInboxes.map((i) => i.id);

  // Phase 1: Rescue orphaned in-progress leads on inactive/null inboxes
  const orphanedLeads = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        ne(leads.status, "pending"),
        ne(leads.status, "completed"),
        ne(leads.status, "failed"),
        isNull(leads.deleted_at),
        sql`(${leads.sender_inbox_id} IS NULL OR ${leads.sender_inbox_id} NOT IN (${sql.join(activeIds.map(id => sql`${id}`), sql`, `)}))`
      )
    );

  // Phase 2: Get all pending leads for rebalancing
  const pendingLeads = await db
    .select({ id: leads.id, sender_inbox_id: leads.sender_inbox_id })
    .from(leads)
    .where(and(eq(leads.status, "pending"), isNull(leads.deleted_at)));

  const allLeadsToAssign = [
    ...orphanedLeads.map((l) => l.id),
    ...pendingLeads.map((l) => l.id),
  ];

  if (allLeadsToAssign.length === 0) return;

  // Count in-progress leads already on active inboxes (these stay put)
  const lockedCounts = await db
    .select({
      sender_inbox_id: leads.sender_inbox_id,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(
      and(
        ne(leads.status, "pending"),
        ne(leads.status, "completed"),
        ne(leads.status, "failed"),
        isNull(leads.deleted_at),
        inArray(leads.sender_inbox_id, activeIds)
      )
    )
    .groupBy(leads.sender_inbox_id);

  // Build load map
  const load = new Map<string, number>();
  for (const id of activeIds) load.set(id, 0);
  for (const row of lockedCounts) {
    if (row.sender_inbox_id) load.set(row.sender_inbox_id, row.count);
  }

  // Greedily assign each lead to the least-loaded inbox
  const assignments = new Map<string, string[]>();
  for (const id of activeIds) assignments.set(id, []);

  for (const leadId of allLeadsToAssign) {
    let minInbox = activeIds[0];
    let minLoad = load.get(minInbox)!;
    for (const id of activeIds) {
      const l = load.get(id)!;
      if (l < minLoad) {
        minInbox = id;
        minLoad = l;
      }
    }
    assignments.get(minInbox)!.push(leadId);
    load.set(minInbox, minLoad + 1);
  }

  // Batch update per inbox
  const now = new Date();
  for (const [inboxId, leadIds] of assignments) {
    if (leadIds.length === 0) continue;
    await db
      .update(leads)
      .set({ sender_inbox_id: inboxId, updated_at: now })
      .where(inArray(leads.id, leadIds));
  }
}

export interface SendBatchResult {
  sent: number;
  errors: number;
}

export async function executeSendBatch(): Promise<SendBatchResult> {
  const now = new Date();
  // Daily limit resets at midnight ET (consistent with business hours enforcement)
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const etMidnight = new Date(etNow);
  etMidnight.setHours(0, 0, 0, 0);
  // Convert ET midnight back to UTC
  const offsetMs = now.getTime() - etNow.getTime();
  const startOfDay = new Date(etMidnight.getTime() + offsetMs);
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

  await rebalanceLeads(activeInboxes);

  // Cleanup: auto-complete any email_5_sent leads (sequence finished).
  await db
    .update(leads)
    .set({ status: "completed", updated_at: now })
    .where(and(eq(leads.status, "email_5_sent"), isNull(leads.deleted_at)));

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

    const eligibleLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.sender_inbox_id, inbox.id),
          inArray(leads.status, [...SENDABLE_STATUSES]),
          eq(leads.response_received, false),
          isNull(leads.deleted_at),
        )
      )
      .orderBy(asc(leads.contacted_at))
      .limit(batchSize);

    for (const lead of eligibleLeads) {
      if (lead.status !== "pending") {
        // In-progress lead with missing contacted_at is in a broken state — skip
        if (!lead.contacted_at) continue;

        const waitDays = getWaitDays(lead, lead.status);
        if (waitDays !== null) {
          let waitUntil: Date;
          if (testMode) {
            waitUntil = new Date(lead.contacted_at);
            waitUntil.setMinutes(waitUntil.getMinutes() + waitDays);
          } else {
            waitUntil = addCalendarDaysSkipWeekends(new Date(lead.contacted_at), waitDays);
            // Truncate to start of day so any business-hours cron on this date
            // processes the lead.
            waitUntil.setUTCHours(0, 0, 0, 0);
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

      const content = getEmailContent(lead, next.emailNum);
      if (!content) {
        await db
          .update(leads)
          .set({ status: "completed", updated_at: now })
          .where(eq(leads.id, lead.id));
        continue;
      }

      // GUARD 1: Dedup — check if this exact email number was already sent for this lead
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
      if ((alreadySent?.count ?? 0) > 0) continue;

      // Bounce check
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
        continue;
      }

      // GUARD 2: Optimistic claim
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
