export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { getCampaignById } from "@/lib/db/queries";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  return <CampaignForm campaign={campaign} />;
}
