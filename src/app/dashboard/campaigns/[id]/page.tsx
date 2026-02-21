export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  getCampaignById,
  getCampaignStats,
  getLeadsByCampaign,
  getEligibleLeadCount,
} from "@/lib/db/queries";
import { CampaignDetailClient } from "@/components/campaigns/campaign-detail-client";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const [allStats, campaignLeads, eligibleCount] = await Promise.all([
    getCampaignStats(),
    getLeadsByCampaign(id),
    getEligibleLeadCount(id),
  ]);
  const stats = allStats.find((s) => s.id === id);

  return (
    <CampaignDetailClient
      campaign={campaign}
      stats={stats}
      leads={campaignLeads}
      eligibleCount={eligibleCount}
    />
  );
}
