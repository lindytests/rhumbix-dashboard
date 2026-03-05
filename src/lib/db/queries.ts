import { db } from ".";
import { appSettings, leads, senderInboxes, sendLogs } from "./schema";
import { eq, and, gte, sql, desc, isNotNull, isNull, inArray } from "drizzle-orm";
import type {
  InboxStats,
  Lead,
  SendLogEntry,
  SenderInbox,
} from "@/lib/types";

// ── Leads ──────────────────────────────────────────────

export async function getLeads(): Promise<Lead[]> {
  const settings = await getAppSettings();
  const rows = await db
    .select({
      lead: leads,
      sender_email: senderInboxes.email,
    })
    .from(leads)
    .leftJoin(senderInboxes, eq(leads.sender_inbox_id, senderInboxes.id))
    .where(isNull(leads.deleted_at))
    .orderBy(desc(leads.created_at));

  return rows.map((r) =>
    rowToLead(r.lead, r.sender_email, settings.test_mode)
  );
}

export async function getRecentActivity(limit: number): Promise<Lead[]> {
  const settings = await getAppSettings();
  const rows = await db
    .select({
      lead: leads,
      sender_email: senderInboxes.email,
    })
    .from(leads)
    .leftJoin(senderInboxes, eq(leads.sender_inbox_id, senderInboxes.id))
    .where(and(isNotNull(leads.contacted_at), isNull(leads.deleted_at)))
    .orderBy(desc(leads.contacted_at))
    .limit(limit);

  return rows.map((r) =>
    rowToLead(r.lead, r.sender_email, settings.test_mode)
  );
}

// ── Lead Stats (replaces campaign stats) ───────────────

export interface LeadStats {
  total_leads: number;
  pending: number;
  in_progress: number;
  completed: number;
  responded: number;
}

export async function getLeadStats(): Promise<LeadStats> {
  const [row] = await db
    .select({
      total_leads: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${leads.status} = 'pending')::int`,
      in_progress: sql<number>`count(*) filter (where ${leads.status} not in ('pending', 'completed', 'failed') and ${leads.status} is not null)::int`,
      completed: sql<number>`count(*) filter (where ${leads.status} = 'completed')::int`,
      responded: sql<number>`count(*) filter (where ${leads.response_received} = true)::int`,
    })
    .from(leads)
    .where(isNull(leads.deleted_at));

  return {
    total_leads: row?.total_leads ?? 0,
    pending: row?.pending ?? 0,
    in_progress: row?.in_progress ?? 0,
    completed: row?.completed ?? 0,
    responded: row?.responded ?? 0,
  };
}

// ── Sender Inboxes ─────────────────────────────────────

export async function getSenderInboxes(): Promise<SenderInbox[]> {
  const rows = await db
    .select()
    .from(senderInboxes)
    .orderBy(senderInboxes.created_at);
  return rows.map(rowToSenderInbox);
}

export async function getInboxStats(): Promise<InboxStats[]> {
  const inboxes = await getSenderInboxes();
  const now = new Date();
  // Daily limit resets at midnight ET
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const etMidnight = new Date(etNow);
  etMidnight.setHours(0, 0, 0, 0);
  const offsetMs = now.getTime() - etNow.getTime();
  const startOfDay = new Date(etMidnight.getTime() + offsetMs);
  const startOfHour = new Date(now);
  startOfHour.setMinutes(0, 0, 0);

  const todayLogs = await db
    .select({
      sender_inbox_id: sendLogs.sender_inbox_id,
      count: sql<number>`count(*)::int`,
    })
    .from(sendLogs)
    .where(
      and(
        gte(sendLogs.sent_at, startOfDay),
        eq(sendLogs.status, "sent")
      )
    )
    .groupBy(sendLogs.sender_inbox_id);

  const hourLogs = await db
    .select({
      sender_inbox_id: sendLogs.sender_inbox_id,
      count: sql<number>`count(*)::int`,
    })
    .from(sendLogs)
    .where(
      and(
        gte(sendLogs.sent_at, startOfHour),
        eq(sendLogs.status, "sent")
      )
    )
    .groupBy(sendLogs.sender_inbox_id);

  const todayMap = new Map(todayLogs.map((r) => [r.sender_inbox_id, r.count]));
  const hourMap = new Map(hourLogs.map((r) => [r.sender_inbox_id, r.count]));

  return inboxes.map((inbox) => ({
    id: inbox.id,
    email: inbox.email,
    display_name: inbox.display_name,
    sent_today: todayMap.get(inbox.id) ?? 0,
    sent_this_hour: hourMap.get(inbox.id) ?? 0,
    daily_limit: inbox.daily_limit,
    hourly_limit: inbox.hourly_limit,
    is_active: inbox.is_active,
  }));
}

// ── Send Logs ─────────────────────────────────────────

export async function getSendLogs(limit?: number): Promise<SendLogEntry[]> {
  // Archival: no filter on leads.deleted_at so logs persist when leads are deleted
  let query = db
    .select({
      id: sendLogs.id,
      lead_id: sendLogs.lead_id,
      first_name: leads.first_name,
      last_name: leads.last_name,
      email: leads.email,
      company: leads.company,
      sender_email: senderInboxes.email,
      email_number: sendLogs.email_number,
      status: sendLogs.status,
      sent_at: sendLogs.sent_at,
      lead_deleted_at: leads.deleted_at,
      // Email content fields — we pick the right one based on email_number in the mapper
      email_1_subject: leads.email_1_subject,
      email_1_body: leads.email_1_body,
      email_2_subject: leads.email_2_subject,
      email_2_body: leads.email_2_body,
      email_3_subject: leads.email_3_subject,
      email_3_body: leads.email_3_body,
      email_4_subject: leads.email_4_subject,
      email_4_body: leads.email_4_body,
      email_5_subject: leads.email_5_subject,
      email_5_body: leads.email_5_body,
    })
    .from(sendLogs)
    .leftJoin(leads, eq(sendLogs.lead_id, leads.id))
    .leftJoin(senderInboxes, eq(sendLogs.sender_inbox_id, senderInboxes.id))
    .orderBy(desc(sendLogs.sent_at))
    .$dynamic();
  if (limit) {
    query = query.limit(limit);
  }
  const rows = await query;

  return rows.map((r) => {
    const contentMap: Record<number, { subject: string | null; body: string | null }> = {
      1: { subject: r.email_1_subject, body: r.email_1_body },
      2: { subject: r.email_2_subject, body: r.email_2_body },
      3: { subject: r.email_3_subject, body: r.email_3_body },
      4: { subject: r.email_4_subject, body: r.email_4_body },
      5: { subject: r.email_5_subject, body: r.email_5_body },
    };
    const content = contentMap[r.email_number];

    return {
      id: r.id,
      lead_id: r.lead_id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email ?? "unknown",
      company: r.company,
      sender_email: r.sender_email ?? "unknown",
      email_number: r.email_number,
      email_subject: content?.subject ?? null,
      email_body: content?.body ?? null,
      lead_deleted: r.lead_deleted_at !== null,
      status: r.status,
      sent_at: r.sent_at.toISOString(),
    };
  });
}

// ── App Settings ──────────────────────────────────────

export async function getAppSettings(): Promise<{
  auto_send_enabled: boolean;
  test_mode: boolean;
}> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1));
  return {
    auto_send_enabled: row?.auto_send_enabled ?? false,
    test_mode: row?.test_mode ?? false,
  };
}

// ── Eligible Lead Counts ──────────────────────────────

const SENDABLE_STATUSES = [
  "pending",
  "email_1_sent",
  "email_2_sent",
  "email_3_sent",
  "email_4_sent",
] as const;

export async function getEligibleLeadCount(): Promise<number> {
  const now = new Date();
  // Daily limit resets at midnight ET
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const etMidnight = new Date(etNow);
  etMidnight.setHours(0, 0, 0, 0);
  const offsetMs = now.getTime() - etNow.getTime();
  const startOfDay = new Date(etMidnight.getTime() + offsetMs);

  const settings = await getAppSettings();
  const testMode = settings.test_mode;

  // Build per-inbox remaining capacity
  const inboxCapacity = await db
    .select({
      id: senderInboxes.id,
      dailyLimit: senderInboxes.daily_limit,
      sentToday: sql<number>`coalesce(${sql`(
        select count(*)::int from send_logs
        where send_logs.sender_inbox_id = ${senderInboxes.id}
          and send_logs.sent_at >= ${startOfDay.toISOString()}
          and send_logs.status = 'sent'
      )`}, 0)`,
    })
    .from(senderInboxes)
    .where(eq(senderInboxes.is_active, true));

  const availableInboxIds = inboxCapacity
    .filter((i) => i.dailyLimit - i.sentToday > 0)
    .map((i) => i.id);

  if (availableInboxIds.length === 0) return 0;

  const conditions = [
    inArray(leads.status, [...SENDABLE_STATUSES]),
    eq(leads.response_received, false),
    inArray(leads.sender_inbox_id, availableInboxIds),
    isNull(leads.deleted_at),
  ];

  // Wait-day cooldown: reads from leads columns directly
  const intervalUnit = testMode ? "mins" : "days";
  const waitExpr = sql`${leads.contacted_at} + make_interval(${sql.raw(intervalUnit)} => CASE ${leads.status}
    WHEN 'email_1_sent' THEN coalesce(${leads.wait_after_email_1}, 0)
    WHEN 'email_2_sent' THEN coalesce(${leads.wait_after_email_2}, 0)
    WHEN 'email_3_sent' THEN coalesce(${leads.wait_after_email_3}, 0)
    WHEN 'email_4_sent' THEN coalesce(${leads.wait_after_email_4}, 0)
    ELSE 0
  END)`;
  const cooldownComparison = testMode
    ? sql`(${waitExpr}) <= ${now.toISOString()}`
    : sql`(${waitExpr})::date <= ${now.toISOString()}::date`;
  const cooldownCheck = sql`(
    ${leads.status} = 'pending'
    OR ${leads.contacted_at} IS NULL
    OR ${cooldownComparison}
  )`;

  // Next email content must exist on the lead
  const hasNextEmailContent = sql`CASE ${leads.status}
    WHEN 'pending'       THEN ${leads.email_1_subject} IS NOT NULL AND ${leads.email_1_body} IS NOT NULL
    WHEN 'email_1_sent'  THEN ${leads.email_2_subject} IS NOT NULL AND ${leads.email_2_body} IS NOT NULL
    WHEN 'email_2_sent'  THEN ${leads.email_3_subject} IS NOT NULL AND ${leads.email_3_body} IS NOT NULL
    WHEN 'email_3_sent'  THEN ${leads.email_4_subject} IS NOT NULL AND ${leads.email_4_body} IS NOT NULL
    WHEN 'email_4_sent'  THEN ${leads.email_5_subject} IS NOT NULL AND ${leads.email_5_body} IS NOT NULL
    ELSE false
  END`;

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(...conditions, cooldownCheck, hasNextEmailContent));
  return result?.count ?? 0;
}

// ── Row mappers ────────────────────────────────────────

/**
 * Given a Date, return it unchanged if within business hours (Mon-Fri 9-17 ET),
 * otherwise return 9 AM ET on the next business day.
 */
function nextBusinessOpen(date: Date): Date {
  const et = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = et.getDay();
  const hour = et.getHours();

  if (day >= 1 && day <= 5 && hour >= 7 && hour < 19) {
    return date;
  }

  let daysToAdd = 0;
  if (day >= 1 && day <= 5 && hour < 7) {
    daysToAdd = 0;
  } else if (day === 5) {
    daysToAdd = 3;
  } else if (day === 6) {
    daysToAdd = 2;
  } else if (day === 0) {
    daysToAdd = 1;
  } else {
    daysToAdd = 1;
  }

  const targetYear = et.getFullYear();
  const targetMonth = et.getMonth();
  const targetDay = et.getDate() + daysToAdd;

  const probe = new Date(Date.UTC(targetYear, targetMonth, targetDay, 12, 0, 0));
  const utcRepr = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  const etRepr = new Date(probe.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const probeOffsetMs = utcRepr.getTime() - etRepr.getTime();

  return new Date(Date.UTC(targetYear, targetMonth, targetDay, 7, 0, 0) + probeOffsetMs);
}

function addCalendarDaysSkipWeekends(start: Date, days: number): Date {
  const result = new Date(start);
  result.setDate(result.getDate() + days);
  const day = result.getDay();
  if (day === 0) result.setDate(result.getDate() + 1);
  if (day === 6) result.setDate(result.getDate() + 2);
  return result;
}

const WAIT_KEY: Record<string, keyof typeof leads.$inferSelect> = {
  email_1_sent: "wait_after_email_1",
  email_2_sent: "wait_after_email_2",
  email_3_sent: "wait_after_email_3",
  email_4_sent: "wait_after_email_4",
};

function computeNextSendDate(
  lead: typeof leads.$inferSelect,
  testMode = false
): string | null {
  if (
    lead.status === "completed" ||
    lead.status === "failed" ||
    lead.status === "email_5_sent" ||
    lead.response_received
  )
    return null;

  if (lead.status === "pending") {
    return nextBusinessOpen(new Date()).toISOString();
  }

  const waitKey = WAIT_KEY[lead.status];
  if (!waitKey || !lead.contacted_at) return null;

  const waitValue = (lead[waitKey] as number | null) ?? 0;

  if (testMode) {
    const nextDate = new Date(lead.contacted_at);
    nextDate.setMinutes(nextDate.getMinutes() + waitValue);
    return nextDate.toISOString();
  }

  const nextDate = addCalendarDaysSkipWeekends(
    new Date(lead.contacted_at),
    waitValue
  );
  return nextBusinessOpen(nextDate).toISOString();
}

function rowToLead(
  row: typeof leads.$inferSelect,
  senderEmail: string | null,
  testMode = false
): Lead {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    company: row.company,
    title: row.title,
    sender_inbox_id: row.sender_inbox_id,
    sender_email: senderEmail ?? undefined,
    status: row.status,
    contacted_at: row.contacted_at?.toISOString() ?? null,
    response_received: row.response_received,
    next_send_date: computeNextSendDate(row, testMode),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    email_1_subject: row.email_1_subject,
    email_1_body: row.email_1_body,
    wait_after_email_1: row.wait_after_email_1,
    email_2_subject: row.email_2_subject,
    email_2_body: row.email_2_body,
    wait_after_email_2: row.wait_after_email_2,
    email_3_subject: row.email_3_subject,
    email_3_body: row.email_3_body,
    wait_after_email_3: row.wait_after_email_3,
    email_4_subject: row.email_4_subject,
    email_4_body: row.email_4_body,
    wait_after_email_4: row.wait_after_email_4,
    email_5_subject: row.email_5_subject,
    email_5_body: row.email_5_body,
  };
}

function rowToSenderInbox(
  row: typeof senderInboxes.$inferSelect
): SenderInbox {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    lindy_webhook_url: row.lindy_webhook_url,
    lindy_webhook_secret: row.lindy_webhook_secret,
    daily_limit: row.daily_limit,
    hourly_limit: row.hourly_limit,
    is_active: row.is_active,
    created_at: row.created_at.toISOString(),
  };
}
