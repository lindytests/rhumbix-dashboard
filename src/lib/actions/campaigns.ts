"use server";

import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EmailStep } from "@/lib/types";

export async function createCampaign(name: string, steps: EmailStep[]) {
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

export async function deleteCampaign(id: string) {
  await db.delete(campaigns).where(eq(campaigns.id, id));
  revalidatePath("/dashboard");
  redirect("/dashboard/campaigns");
}
