export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCampaigns, getCampaignStats } from "@/lib/db/queries";
import { Plus } from "lucide-react";
import type { Campaign } from "@/lib/types";

function getSequenceLength(campaign: Campaign) {
  let count = 0;
  if (campaign.email_1_body) count++;
  if (campaign.email_2_body) count++;
  if (campaign.email_3_body) count++;
  if (campaign.email_4_body) count++;
  if (campaign.email_5_body) count++;
  return count;
}

export default async function CampaignsPage() {
  const [allCampaigns, stats] = await Promise.all([
    getCampaigns(),
    getCampaignStats(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-[-0.02em]">
            Campaigns
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Email sequences and templates
          </p>
        </div>
        <Button
          asChild
          className="bg-amber text-amber-foreground hover:bg-amber/90 h-9 text-[13px] font-semibold rounded-lg"
        >
          <Link href="/dashboard/campaigns/new">
            <Plus className="h-4 w-4 mr-1.5" />
            New Campaign
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {allCampaigns.map((campaign) => {
          const campaignStats = stats.find((s) => s.id === campaign.id);
          const emailCount = getSequenceLength(campaign);

          return (
            <Link
              key={campaign.id}
              href={"/dashboard/campaigns/" + campaign.id}
            >
              <Card className="bg-card rounded-2xl border border-border hover:bg-muted/30 transition-colors duration-150 cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <h3 className="text-[17px] font-semibold font-heading">
                          {campaign.name}
                        </h3>
                        <Badge variant="secondary" className="text-[11px] font-medium">
                          {emailCount} email{emailCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>

                    {campaignStats && (
                      <div className="flex items-center gap-5 text-[13px]">
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground tabular-nums font-mono">
                            {campaignStats.total_leads}
                          </span>{" "}
                          leads
                        </span>
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground tabular-nums font-mono">
                            {campaignStats.completed}
                          </span>{" "}
                          done
                        </span>
                        {campaignStats.responded > 0 && (
                          <span className="text-amber font-semibold tabular-nums font-mono">
                            {campaignStats.responded}{" "}
                            <span className="font-normal">replied</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
