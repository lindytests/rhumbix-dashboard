"use server";

import { db } from "@/lib/db";
import { senderInboxes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateInboxData(data: {
  email: string;
  lindy_webhook_url: string;
  daily_limit: number;
  hourly_limit: number;
}) {
  if (!data.email.trim() || !EMAIL_RE.test(data.email.trim())) {
    throw new Error("Please enter a valid email address");
  }
  try {
    new URL(data.lindy_webhook_url);
  } catch {
    throw new Error("Please enter a valid webhook URL");
  }
  if (data.daily_limit < 1 || data.daily_limit > 10000) {
    throw new Error("Daily limit must be between 1 and 10,000");
  }
  if (data.hourly_limit < 1 || data.hourly_limit > 10000) {
    throw new Error("Hourly limit must be between 1 and 10,000");
  }
  if (data.hourly_limit > data.daily_limit) {
    throw new Error("Hourly limit cannot exceed daily limit");
  }
}

export async function createInbox(data: {
  email: string;
  display_name: string;
  lindy_webhook_url: string;
  lindy_webhook_secret?: string;
  daily_limit: number;
  hourly_limit: number;
}) {
  validateInboxData(data);
  await db.insert(senderInboxes).values(data);
  revalidatePath("/dashboard");
}

export async function updateInbox(
  id: string,
  data: {
    email: string;
    display_name: string;
    lindy_webhook_url: string;
    lindy_webhook_secret?: string;
    daily_limit: number;
    hourly_limit: number;
  }
) {
  validateInboxData(data);
  await db.update(senderInboxes).set(data).where(eq(senderInboxes.id, id));
  revalidatePath("/dashboard");
}

export async function toggleInbox(id: string, isActive: boolean) {
  await db
    .update(senderInboxes)
    .set({ is_active: isActive })
    .where(eq(senderInboxes.id, id));
  revalidatePath("/dashboard");
}

export async function deleteInbox(id: string) {
  await db.delete(senderInboxes).where(eq(senderInboxes.id, id));
  revalidatePath("/dashboard");
}
