"use server";

import { db } from "@/lib/db";
import { senderInboxes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createInbox(data: {
  email: string;
  display_name: string;
  lindy_webhook_url: string;
  lindy_webhook_secret?: string;
  daily_limit: number;
  hourly_limit: number;
}) {
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
