"use server";

import { db } from "@/lib/db";
import { leads, senderInboxes } from "@/lib/db/schema";
import { eq, and, ne, sql, isNull, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function assignInbox(): Promise<string | null> {
  const activeInboxes = await db
    .select({ id: senderInboxes.id })
    .from(senderInboxes)
    .where(eq(senderInboxes.is_active, true));
  if (activeInboxes.length === 0) return null;

  // Single aggregation query to count leads per inbox
  const activeIds = activeInboxes.map((i) => i.id);
  const counts = await db
    .select({
      sender_inbox_id: leads.sender_inbox_id,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(
      and(
        inArray(leads.sender_inbox_id, activeIds),
        isNull(leads.deleted_at)
      )
    )
    .groupBy(leads.sender_inbox_id);

  const countMap = new Map(counts.map((c) => [c.sender_inbox_id, c.count]));

  // Pick inbox with fewest leads
  let minId = activeIds[0];
  let minCount = countMap.get(minId) ?? 0;
  for (const id of activeIds) {
    const c = countMap.get(id) ?? 0;
    if (c < minCount) {
      minId = id;
      minCount = c;
    }
  }
  return minId;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createLead(data: {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  title: string;
  email_1_subject: string;
  email_1_body: string;
  wait_after_email_1?: number;
  email_2_subject?: string;
  email_2_body?: string;
  wait_after_email_2?: number;
  email_3_subject?: string;
  email_3_body?: string;
  wait_after_email_3?: number;
  email_4_subject?: string;
  email_4_body?: string;
  wait_after_email_4?: number;
  email_5_subject?: string;
  email_5_body?: string;
}) {
  const email = data.email.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    throw new Error("Please enter a valid email address");
  }
  if (!data.email_1_subject || !data.email_1_body) {
    throw new Error("At least Email 1 subject and body are required");
  }

  // Block if this email is already active
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.email, email),
        ne(leads.status, "completed"),
        ne(leads.status, "failed"),
        isNull(leads.deleted_at)
      )
    );
  if ((existing?.count ?? 0) > 0) {
    throw new Error("This email already has an active sequence");
  }

  const inboxId = await assignInbox();
  if (!inboxId) {
    throw new Error("No active sender inboxes. Please add and activate an inbox first.");
  }

  await db.insert(leads).values({
    first_name: data.first_name || null,
    last_name: data.last_name || null,
    email,
    company: data.company || null,
    title: data.title || null,
    sender_inbox_id: inboxId,
    email_1_subject: data.email_1_subject,
    email_1_body: data.email_1_body,
    wait_after_email_1: data.wait_after_email_1 ?? null,
    email_2_subject: data.email_2_subject || null,
    email_2_body: data.email_2_body || null,
    wait_after_email_2: data.wait_after_email_2 ?? null,
    email_3_subject: data.email_3_subject || null,
    email_3_body: data.email_3_body || null,
    wait_after_email_3: data.wait_after_email_3 ?? null,
    email_4_subject: data.email_4_subject || null,
    email_4_body: data.email_4_body || null,
    wait_after_email_4: data.wait_after_email_4 ?? null,
    email_5_subject: data.email_5_subject || null,
    email_5_body: data.email_5_body || null,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard/leads");
}

export async function deleteLeads(ids: string[]) {
  if (ids.length === 0) return;
  const now = new Date();
  for (const id of ids) {
    await db
      .update(leads)
      .set({ deleted_at: now, updated_at: now })
      .where(eq(leads.id, id));
  }
  revalidatePath("/dashboard");
}

export async function updateLead(
  id: string,
  data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    company?: string;
    title?: string;
  }
) {
  const now = new Date();
  const set: Record<string, unknown> = { updated_at: now };

  if (data.first_name !== undefined) set.first_name = data.first_name || null;
  if (data.last_name !== undefined) set.last_name = data.last_name || null;
  if (data.email !== undefined) set.email = data.email;
  if (data.company !== undefined) set.company = data.company || null;
  if (data.title !== undefined) set.title = data.title || null;

  await db.update(leads).set(set).where(eq(leads.id, id));
  revalidatePath("/dashboard");
}

export async function updateLeads(
  ids: string[],
  data: {
    first_name?: string;
    last_name?: string;
    company?: string;
    title?: string;
  }
) {
  if (ids.length === 0) return;
  const now = new Date();

  for (const id of ids) {
    const set: Record<string, unknown> = { updated_at: now };

    if (data.first_name !== undefined) set.first_name = data.first_name || null;
    if (data.last_name !== undefined) set.last_name = data.last_name || null;
    if (data.company !== undefined) set.company = data.company || null;
    if (data.title !== undefined) set.title = data.title || null;

    await db.update(leads).set(set).where(eq(leads.id, id));
  }

  revalidatePath("/dashboard");
}

export async function importLeads(
  rows: {
    email: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    title?: string;
    email_1_subject?: string;
    email_1_body?: string;
    wait_after_email_1?: number;
    email_2_subject?: string;
    email_2_body?: string;
    wait_after_email_2?: number;
    email_3_subject?: string;
    email_3_body?: string;
    wait_after_email_3?: number;
    email_4_subject?: string;
    email_4_body?: string;
    wait_after_email_4?: number;
    email_5_subject?: string;
    email_5_body?: string;
  }[]
): Promise<{ imported: number; duplicates: number }> {
  // Get active inboxes for round-robin
  const activeInboxes = await db
    .select()
    .from(senderInboxes)
    .where(eq(senderInboxes.is_active, true));
  if (activeInboxes.length === 0) {
    throw new Error("No active sender inboxes. Please add and activate an inbox first.");
  }

  // Get existing active lead emails for dedup
  const existingLeads = await db
    .select({ email: leads.email })
    .from(leads)
    .where(
      and(
        ne(leads.status, "completed"),
        ne(leads.status, "failed"),
        isNull(leads.deleted_at)
      )
    );
  const existingEmails = new Set(
    existingLeads.map((l) => l.email.toLowerCase())
  );

  const toInsert: (typeof leads.$inferInsert)[] = [];
  let duplicates = 0;
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (existingEmails.has(email) || seenEmails.has(email)) {
      duplicates++;
      continue;
    }
    seenEmails.add(email);

    // Round-robin inbox assignment
    const inboxId =
      activeInboxes.length > 0
        ? activeInboxes[toInsert.length % activeInboxes.length].id
        : null;

    toInsert.push({
      email: row.email.trim(),
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      company: row.company || null,
      title: row.title || null,
      sender_inbox_id: inboxId,
      email_1_subject: row.email_1_subject || null,
      email_1_body: row.email_1_body || null,
      wait_after_email_1: row.wait_after_email_1 ?? null,
      email_2_subject: row.email_2_subject || null,
      email_2_body: row.email_2_body || null,
      wait_after_email_2: row.wait_after_email_2 ?? null,
      email_3_subject: row.email_3_subject || null,
      email_3_body: row.email_3_body || null,
      wait_after_email_3: row.wait_after_email_3 ?? null,
      email_4_subject: row.email_4_subject || null,
      email_4_body: row.email_4_body || null,
      wait_after_email_4: row.wait_after_email_4 ?? null,
      email_5_subject: row.email_5_subject || null,
      email_5_body: row.email_5_body || null,
    });
  }

  if (toInsert.length > 0) {
    // Insert in batches of 100
    for (let i = 0; i < toInsert.length; i += 100) {
      await db.insert(leads).values(toInsert.slice(i, i + 100));
    }
  }

  revalidatePath("/dashboard");
  return { imported: toInsert.length, duplicates };
}
