"use server";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
