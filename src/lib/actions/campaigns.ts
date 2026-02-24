"use server";

import { db } from "@/lib/db";
import { campaigns, leads } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EmailStep } from "@/lib/types";

function validateSteps(steps: EmailStep[]) {
  if (!steps.length || !steps[0].subject?.trim() || !steps[0].body?.trim()) {
    throw new Error("Email 1 subject and body are required");
  }
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    const hasSubject = !!step.subject?.trim();
    const hasBody = !!step.body?.trim();
    if (hasSubject !== hasBody) {
      throw new Error(`Email ${i + 1} must have both subject and body, or neither`);
    }
    if (step.wait_days !== null && step.wait_days !== undefined) {
      if (step.wait_days < 1 || step.wait_days > 365) {
        throw new Error("Wait days must be between 1 and 365");
      }
    }
  }
}

export async function createCampaign(name: string, steps: EmailStep[]) {
  if (!name.trim()) {
    throw new Error("Campaign name is required");
  }
  validateSteps(steps);

  const data: typeof campaigns.$inferInsert = {
    name,
    email_1_subject: steps[0].subject,
    email_1_body: steps[0].body,
    wait_after_email_1: steps[0].wait_days,
    email_2_subject: steps[1]?.subject ?? null,
    email_2_body: steps[1]?.body ?? null,
    wait_after_email_2: steps[1]?.wait_days ?? null,
    email_3_subject: steps[2]?.subject ?? null,
    email_3_body: steps[2]?.body ?? null,
    wait_after_email_3: steps[2]?.wait_days ?? null,
    email_4_subject: steps[3]?.subject ?? null,
    email_4_body: steps[3]?.body ?? null,
    wait_after_email_4: steps[3]?.wait_days ?? null,
    email_5_subject: steps[4]?.subject ?? null,
    email_5_body: steps[4]?.body ?? null,
  };

  await db.insert(campaigns).values(data);
  revalidatePath("/dashboard");
  redirect("/dashboard/campaigns");
}

export async function updateCampaign(
  id: string,
  name: string,
  steps: EmailStep[]
) {
  if (!name.trim()) {
    throw new Error("Campaign name is required");
  }
  validateSteps(steps);

  await db
    .update(campaigns)
    .set({
      name,
      email_1_subject: steps[0].subject,
      email_1_body: steps[0].body,
      wait_after_email_1: steps[0].wait_days,
      email_2_subject: steps[1]?.subject ?? null,
      email_2_body: steps[1]?.body ?? null,
      wait_after_email_2: steps[1]?.wait_days ?? null,
      email_3_subject: steps[2]?.subject ?? null,
      email_3_body: steps[2]?.body ?? null,
      wait_after_email_3: steps[2]?.wait_days ?? null,
      email_4_subject: steps[3]?.subject ?? null,
      email_4_body: steps[3]?.body ?? null,
      wait_after_email_4: steps[3]?.wait_days ?? null,
      email_5_subject: steps[4]?.subject ?? null,
      email_5_body: steps[4]?.body ?? null,
      updated_at: new Date(),
    })
    .where(eq(campaigns.id, id));

  revalidatePath("/dashboard");
  redirect("/dashboard/campaigns/" + id);
}

export async function updateCampaignInline(
  id: string,
  name: string,
  steps: EmailStep[]
) {
  if (!name.trim()) {
    throw new Error("Campaign name is required");
  }
  validateSteps(steps);

  await db
    .update(campaigns)
    .set({
      name,
      email_1_subject: steps[0].subject,
      email_1_body: steps[0].body,
      wait_after_email_1: steps[0].wait_days,
      email_2_subject: steps[1]?.subject ?? null,
      email_2_body: steps[1]?.body ?? null,
      wait_after_email_2: steps[1]?.wait_days ?? null,
      email_3_subject: steps[2]?.subject ?? null,
      email_3_body: steps[2]?.body ?? null,
      wait_after_email_3: steps[2]?.wait_days ?? null,
      email_4_subject: steps[3]?.subject ?? null,
      email_4_body: steps[3]?.body ?? null,
      wait_after_email_4: steps[3]?.wait_days ?? null,
      email_5_subject: steps[4]?.subject ?? null,
      email_5_body: steps[4]?.body ?? null,
      updated_at: new Date(),
    })
    .where(eq(campaigns.id, id));

  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteCampaign(id: string) {
  const now = new Date();
  // Soft-delete all leads in the campaign first
  await db
    .update(leads)
    .set({ deleted_at: now, updated_at: now })
    .where(and(eq(leads.campaign_id, id), isNull(leads.deleted_at)));
  // Soft-delete the campaign itself
  await db
    .update(campaigns)
    .set({ deleted_at: now, updated_at: now })
    .where(eq(campaigns.id, id));
  revalidatePath("/dashboard");
  redirect("/dashboard/campaigns");
}
