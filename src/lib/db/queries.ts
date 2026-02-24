import { db } from ".";
import { appSettings, campaigns, leads, senderInboxes, sendLogs } from "./schema";
import { eq, and, gte, ne, sql, desc, isNotNull, isNull, inArray } from "drizzle-orm";
import type {
  Campaign,
  CampaignStats,
  InboxStats,
  Lead,
  SendLogEntry,
  SenderInbox,
} from "@/lib/types";

// ── Campaigns ──────────────────────────────────────────

export async function getCampaigns(): Promise<Campaign[]> {
  const rows = await db
    .select()
    .from(campaigns)
    .where(isNull(campaigns.deleted_at))
    .orderBy(desc(campaigns.created_at));
  return rows.map(rowToCampaign);
}

export async function getCampaignById(
  id: string
): Promise<Campaign | undefined> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  return row ? rowToCampaign(row) : undefined;
}

export async function getCampaignStats(): Promise<CampaignStats[]> {
  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      created_at: campaigns.created_at,
      total_leads: sql<number>`count(${leads.id})::int`,
      pending: sql<number>`count(*) filter (where ${leads.status} = 'pending')::int`,
      in_progress: sql<number>`count(*) filter (where ${leads.status} not in ('pending', 'completed', 'failed') and ${leads.status} is not null)::int`,
      completed: sql<number>`count(*) filter (where ${leads.status} = 'completed')::int`,
      responded: sql<number>`count(*) filter (where ${leads.response_received} = true)::int`,
    })
    .from(campaigns)
    .leftJoin(
      leads,
      and(eq(leads.campaign_id, campaigns.id), isNull(leads.deleted_at))
    )
    .where(isNull(campaigns.deleted_at))
    .groupBy(campaigns.id, campaigns.name, campaigns.created_at)
    .orderBy(desc(campaigns.created_at));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    total_leads: r.total_leads,
    pending: r.pending,
    in_progress: r.in_progress,
    completed: r.completed,
    responded: r.responded,
  }));
}

// ── Leads ──────────────────────────────────────────────

export async function getLeads(): Promise<Lead[]> {
  const settings = await getAppSettings();
  const rows = await db
    .select({
      lead: leads,
      campaign: campaigns,
      sender_email: senderInboxes.email,
    })
    .from(leads)
    .leftJoin(campaigns, eq(leads.campaign_id, campaigns.id))
    .leftJoin(senderInboxes, eq(leads.sender_inbox_id, senderInboxes.id))
    .where(isNull(leads.deleted_at))
    .orderBy(desc(leads.created_at));

  return rows.map((r) =>
    rowToLead(r.lead, r.campaign, r.sender_email, settings.test_mode)
  );
}

export async function getLeadsByCampaign(campaignId: string): Promise<Lead[]> {
  const settings = await getAppSettings();
  const rows = await db
    .select({
      lead: leads,
      campaign: campaigns,
      sender_email: senderInboxes.email,
    })
    .from(leads)
    .leftJoin(campaigns, eq(leads.campaign_id, campaigns.id))
    .leftJoin(senderInboxes, eq(leads.sender_inbox_id, senderInboxes.id))
    .where(and(eq(leads.campaign_id, campaignId), isNull(leads.deleted_at)))
    .orderBy(desc(leads.created_at));

  return rows.map((r) =>
    rowToLead(r.lead, r.campaign, r.sender_email, settings.test_mode)
  );
}

export async function getRecentActivity(limit: number): Promise<Lead[]> {
  const settings = await getAppSettings();
  const rows = await db
    .select({
      lead: leads,
      campaign: campaigns,
      sender_email: senderInboxes.email,
    })
    .from(leads)
    .leftJoin(campaigns, eq(leads.campaign_id, campaigns.id))
    .leftJoin(senderInboxes, eq(leads.sender_inbox_id, senderInboxes.id))
    .where(and(isNotNull(leads.contacted_at), isNull(leads.deleted_at)))
    .orderBy(desc(leads.contacted_at))
    .limit(limit);

  return rows.map((r) =>
    rowToLead(r.lead, r.campaign, r.sender_email, settings.test_mode)
  );
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
  let query = db
    .select({
      id: sendLogs.id,
      lead_id: sendLogs.lead_id,
      first_name: leads.first_name,
      last_name: leads.last_name,
      email: leads.email,
      company: leads.company,
      campaign_id: campaigns.id,
      campaign_name: campaigns.name,
      sender_email: senderInboxes.email,
      email_number: sendLogs.email_number,
      status: sendLogs.status,
      sent_at: sendLogs.sent_at,
    })
    .from(sendLogs)
    .innerJoin(leads, eq(sendLogs.lead_id, leads.id))
    .innerJoin(campaigns, eq(leads.campaign_id, campaigns.id))
    .innerJoin(senderInboxes, eq(sendLogs.sender_inbox_id, senderInboxes.id))
    .where(isNull(leads.deleted_at))
    .orderBy(desc(sendLogs.sent_at))
    .$dynamic();
  if (limit) {
    query = query.limit(limit);
  }
  const rows = await query;

  return rows.map((r) => ({
    id: r.id,
    lead_id: r.lead_id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    company: r.company,
    campaign_id: r.campaign_id,
    campaign_name: r.campaign_name,
    sender_email: r.sender_email,
    email_number: r.email_number,
    status: r.status,
    sent_at: r.sent_at.toISOString(),
  }));
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

// Statuses that have a next email to send (mirrors NEXT_EMAIL in send-engine)
const SENDABLE_STATUSES = [
  "pending",
  "email_1_sent",
  "email_2_sent",
  "email_3_sent",
  "email_4_sent",
] as const;

export async function getEligibleLeadCount(
  campaignId?: string
): Promise<number> {
  const now = new Date();
  // Daily limit resets at midnight ET
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const etMidnight = new Date(etNow);
  etMidnight.setHours(0, 0, 0, 0);
  const offsetMs = now.getTime() - etNow.getTime();
  const startOfDay = new Date(etMidnight.getTime() + offsetMs);

  const settings = await getAppSettings();
  const testMode = settings.test_mode;

  // Build per-inbox remaining capacity so we can exclude leads on maxed-out inboxes
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

  // Count leads that actually have a next email AND have passed their cooldown.
  // The cooldown logic is status-dependent so we use a CASE expression in SQL
  // to compute the wait-until date and compare it to now.
  const conditions = [
    inArray(leads.status, [...SENDABLE_STATUSES]),
    eq(leads.response_received, false),
    inArray(leads.sender_inbox_id, availableInboxIds),
    isNull(leads.deleted_at),
  ];
  if (campaignId) {
    conditions.push(eq(leads.campaign_id, campaignId));
  }

  // Wait-day cooldown: for non-pending leads, contacted_at + wait period must be <= now.
  // In test mode, wait values are treated as minutes instead of days.
  // Pending leads have no cooldown so they always pass.
  const intervalUnit = testMode ? "mins" : "days";
  const cooldownCheck = sql`(
    ${leads.status} = 'pending'
    OR ${leads.contacted_at} IS NULL
    OR (${leads.contacted_at} + make_interval(${sql.raw(intervalUnit)} => CASE ${leads.status}
      WHEN 'email_1_sent' THEN coalesce(${campaigns.wait_after_email_1}, 0)
      WHEN 'email_2_sent' THEN coalesce(${campaigns.wait_after_email_2}, 0)
      WHEN 'email_3_sent' THEN coalesce(${campaigns.wait_after_email_3}, 0)
      WHEN 'email_4_sent' THEN coalesce(${campaigns.wait_after_email_4}, 0)
      ELSE 0
    END)) <= ${now.toISOString()}
  )`;

  // Next email content must exist in the campaign
  const hasNextEmailContent = sql`CASE ${leads.status}
    WHEN 'pending'       THEN ${campaigns.email_1_subject} IS NOT NULL AND ${campaigns.email_1_body} IS NOT NULL
    WHEN 'email_1_sent'  THEN ${campaigns.email_2_subject} IS NOT NULL AND ${campaigns.email_2_body} IS NOT NULL
    WHEN 'email_2_sent'  THEN ${campaigns.email_3_subject} IS NOT NULL AND ${campaigns.email_3_body} IS NOT NULL
    WHEN 'email_3_sent'  THEN ${campaigns.email_4_subject} IS NOT NULL AND ${campaigns.email_4_body} IS NOT NULL
    WHEN 'email_4_sent'  THEN ${campaigns.email_5_subject} IS NOT NULL AND ${campaigns.email_5_body} IS NOT NULL
    ELSE false
  END`;

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .innerJoin(campaigns, eq(leads.campaign_id, campaigns.id))
    .where(and(...conditions, cooldownCheck, hasNextEmailContent));
  return result?.count ?? 0;
}

// ── Row mappers ────────────────────────────────────────

function rowToCampaign(row: typeof campaigns.$inferSelect): Campaign {
  return {
    id: row.id,
    name: row.name,
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
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Given a Date, return it unchanged if within business hours (Mon-Fri 9-17 ET),
 * otherwise return 9 AM ET on the next business day.
 */
function nextBusinessOpen(date: Date): Date {
  // Convert to ET via locale round-trip: the resulting Date's local-timezone
  // getters (getDay, getHours, etc.) reflect ET wall-clock values.
  const et = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = et.getDay();
  const hour = et.getHours();

  // Already within business hours
  if (day >= 1 && day <= 5 && hour >= 9 && hour < 17) {
    return date;
  }

  // Determine days to advance to reach the next weekday at 9 AM ET
  let daysToAdd = 0;
  if (day >= 1 && day <= 5 && hour < 9) {
    daysToAdd = 0; // Weekday before 9 AM — same day
  } else if (day === 5) {
    daysToAdd = 3; // Fri after hours → Mon
  } else if (day === 6) {
    daysToAdd = 2; // Sat → Mon
  } else if (day === 0) {
    daysToAdd = 1; // Sun → Mon
  } else {
    daysToAdd = 1; // Mon-Thu after hours → next day
  }

  // Target ET date components
  const targetYear = et.getFullYear();
  const targetMonth = et.getMonth();
  const targetDay = et.getDate() + daysToAdd; // Date.UTC handles overflow

  // Find the ET→UTC offset for the target date.
  // Use a noon-UTC probe (safely away from any 2 AM DST transition).
  const probe = new Date(Date.UTC(targetYear, targetMonth, targetDay, 12, 0, 0));
  const utcRepr = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  const etRepr = new Date(probe.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const offsetMs = utcRepr.getTime() - etRepr.getTime();

  // 9:00 AM ET = 09:00 UTC + offset
  return new Date(Date.UTC(targetYear, targetMonth, targetDay, 9, 0, 0) + offsetMs);
}

function addCalendarDaysSkipWeekends(start: Date, days: number): Date {
  const result = new Date(start);
  result.setDate(result.getDate() + days);
  const day = result.getDay();
  if (day === 0) result.setDate(result.getDate() + 1);
  if (day === 6) result.setDate(result.getDate() + 2);
  return result;
}

const WAIT_KEY: Record<string, keyof typeof campaigns.$inferSelect> = {
  email_1_sent: "wait_after_email_1",
  email_2_sent: "wait_after_email_2",
  email_3_sent: "wait_after_email_3",
  email_4_sent: "wait_after_email_4",
};

function computeNextSendDate(
  lead: typeof leads.$inferSelect,
  campaign: typeof campaigns.$inferSelect | null,
  testMode = false
): string | null {
  // Terminal statuses — no next email
  if (
    lead.status === "completed" ||
    lead.status === "failed" ||
    lead.status === "email_5_sent" ||
    lead.response_received
  )
    return null;

  // Pending leads are eligible at the next business hours window
  if (lead.status === "pending") {
    return nextBusinessOpen(new Date()).toISOString();
  }

  // For in-progress leads, compute contacted_at + wait period
  const waitKey = WAIT_KEY[lead.status];
  if (!waitKey || !campaign || !lead.contacted_at) return null;

  const waitValue = (campaign[waitKey] as number | null) ?? 0;

  if (testMode) {
    // In test mode, wait values are minutes
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
  campaign: typeof campaigns.$inferSelect | null,
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
    campaign_id: row.campaign_id,
    campaign_name: campaign?.name ?? undefined,
    sender_inbox_id: row.sender_inbox_id,
    sender_email: senderEmail ?? undefined,
    status: row.status,
    contacted_at: row.contacted_at?.toISOString() ?? null,
    response_received: row.response_received,
    next_send_date: computeNextSendDate(row, campaign, testMode),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
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
