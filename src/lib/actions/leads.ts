"use server";

import { db } from "@/lib/db";
import { leads, senderInboxes } from "@/lib/db/schema";
import { eq, and, ne, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function assignInbox(): Promise<string | null> {
  const activeInboxes = await db
    .select()
    .from(senderInboxes)
    .where(eq(senderInboxes.is_active, true));
  if (activeInboxes.length === 0) return null;

  // Count leads per inbox and pick the one with fewest
  const counts = await Promise.all(
    activeInboxes.map(async (inbox) => {
      const inboxLeads = await db
        .select()
        .from(leads)
        .where(and(eq(leads.sender_inbox_id, inbox.id), isNull(leads.deleted_at)));
      return { id: inbox.id, count: inboxLeads.length };
    })
  );

  counts.sort((a, b) => a.count - b.count);
  return counts[0].id;
}

export async function createLead(data: {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  title: string;
  campaign_id: string;
}) {
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
