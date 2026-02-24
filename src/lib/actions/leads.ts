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
  campaign_id: string;
}) {
  const email = data.email.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    throw new Error("Please enter a valid email address");
  }
  if (!data.campaign_id) {
    throw new Error("Campaign is required");
  }

  // Block if this email is already in any active campaign
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.email, data.email.trim().toLowerCase()),
        ne(leads.status, "completed"),
        ne(leads.status, "failed"),
        isNull(leads.deleted_at)
      )
    );
  if ((existing?.count ?? 0) > 0) {
    throw new Error("This email is already in an active campaign");
  }

  const inboxId = await assignInbox();
  if (!inboxId) {
    throw new Error("No active sender inboxes. Please add and activate an inbox first.");
  }

  await db.insert(leads).values({
    first_name: data.first_name || null,
    last_name: data.last_name || null,
    email: data.email,
    company: data.company || null,
    title: data.title || null,
    campaign_id: data.campaign_id,
    sender_inbox_id: inboxId,
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
    campaign_id?: string;
  }
) {
  const now = new Date();
  const set: Record<string, unknown> = { updated_at: now };

  if (data.first_name !== undefined) set.first_name = data.first_name || null;
  if (data.last_name !== undefined) set.last_name = data.last_name || null;
  if (data.email !== undefined) set.email = data.email;
  if (data.company !== undefined) set.company = data.company || null;
  if (data.title !== undefined) set.title = data.title || null;
  if (data.campaign_id !== undefined) {
    const inboxId = await assignInbox();
    if (!inboxId) {
      throw new Error("No active sender inboxes. Please add and activate an inbox first.");
    }
    set.campaign_id = data.campaign_id;
    set.sender_inbox_id = inboxId;
  }

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
    campaign_id?: string;
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
    if (data.campaign_id !== undefined) {
      const inboxId = await assignInbox();
      if (!inboxId) {
        throw new Error("No active sender inboxes. Please add and activate an inbox first.");
      }
      set.campaign_id = data.campaign_id;
      set.sender_inbox_id = inboxId;
    }

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
  }[],
  campaignId: string
): Promise<{ imported: number; duplicates: number }> {
  // Get active inboxes for round-robin
  const activeInboxes = await db
    .select()
    .from(senderInboxes)
    .where(eq(senderInboxes.is_active, true));
  if (activeInboxes.length === 0) {
    throw new Error("No active sender inboxes. Please add and activate an inbox first.");
  }

  // Get existing lead emails across ALL active campaigns for dedup.
  // Prevents the same person from being in multiple campaigns simultaneously.
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

    // Round-robin: assign based on position in toInsert
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
      campaign_id: campaignId,
      sender_inbox_id: inboxId,
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
