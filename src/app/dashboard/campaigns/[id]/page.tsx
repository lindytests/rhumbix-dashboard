export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getCampaignById,
  getCampaignStats,
  getLeadsByCampaign,
  getEligibleLeadCount,
} from "@/lib/db/queries";
import { ArrowLeft, Pencil, Mail } from "lucide-react";
import { CampaignSendButton } from "@/components/campaign-send-button";
import { cn } from "@/lib/utils";

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

  const emailSteps: { subject: string; body: string; wait: number | null }[] =
    [];
  if (campaign.email_1_body)
    emailSteps.push({
      subject: campaign.email_1_subject,
      body: campaign.email_1_body,
      wait: campaign.wait_after_email_1,
    });
  if (campaign.email_2_body)
    emailSteps.push({
      subject: campaign.email_2_subject!,
      body: campaign.email_2_body,
      wait: campaign.wait_after_email_2,
    });
  if (campaign.email_3_body)
    emailSteps.push({
      subject: campaign.email_3_subject!,
      body: campaign.email_3_body,
      wait: campaign.wait_after_email_3,
    });
  if (campaign.email_4_body)
    emailSteps.push({
      subject: campaign.email_4_subject!,
      body: campaign.email_4_body,
      wait: campaign.wait_after_email_4,
    });
  if (campaign.email_5_body)
    emailSteps.push({
      subject: campaign.email_5_subject!,
      body: campaign.email_5_body,
      wait: null,
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-lg">
            <Link href="/dashboard/campaigns">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold font-heading tracking-[-0.02em]">
              {campaign.name}
            </h1>
            <p className="text-[14px] text-muted-foreground mt-0.5">
              {emailSteps.length} email sequence &middot; Created{" "}
              {new Date(campaign.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CampaignSendButton campaignId={id} eligibleCount={eligibleCount} />
          <Button variant="outline" asChild className="h-9 text-[13px] rounded-lg font-medium">
            <Link href={"/dashboard/campaigns/" + id + "/edit"}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5">
          {[
            { label: "Total Leads", value: stats.total_leads },
            { label: "Pending", value: stats.pending },
            { label: "In Progress", value: stats.in_progress },
            { label: "Replied", value: stats.responded, highlight: true },
          ].map((item) => (
            <Card key={item.label} className="bg-card rounded-xl border border-border">
              <CardContent className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <p
                  className={cn(
                    "mt-2 text-2xl font-semibold font-heading tabular-nums tracking-[-0.02em]",
                    item.highlight ? "text-amber" : "text-foreground"
                  )}
                >
                  {item.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Email sequence */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-[17px] font-semibold font-heading">
            Email Sequence
          </h2>
          {emailSteps.map((step, i) => (
            <Card key={i} className="bg-card rounded-xl border border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[12px] font-semibold text-muted-foreground">
                      Email {i + 1}
                    </span>
                  </div>
                  {step.wait !== null && (
                    <span className="text-[12px] text-muted-foreground">
                      then wait{" "}
                      <span className="font-semibold font-mono tabular-nums">
                        {step.wait}
                      </span>{" "}
                      days
                    </span>
                  )}
                </div>
                <p className="text-[15px] font-semibold mb-2.5 font-heading">
                  {step.subject}
                </p>
                <pre className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-sans">
                  {step.body}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Leads */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold font-heading">Leads</h2>
            <Link
              href={"/dashboard/leads?campaign=" + id}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {campaignLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5"
              >
                <div>
                  <p className="text-[13px] font-semibold">
                    {lead.first_name} {lead.last_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {lead.email}
                  </p>
                </div>
                <LeadStatusBadge status={lead.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Pending",
    email_1_sent: "Sent Email 1",
    email_2_sent: "Sent Email 2",
    email_3_sent: "Sent Email 3",
    email_4_sent: "Sent Email 4",
    email_5_sent: "Sent Email 5",
    completed: "Done",
    failed: "Failed",
  };

  const styles: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    email_1_sent: "bg-blue-50 text-blue-700 border-blue-100",
    email_2_sent: "bg-blue-50 text-blue-700 border-blue-100",
    email_3_sent: "bg-blue-50 text-blue-700 border-blue-100",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    failed: "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <Badge
      variant="outline"
      className={cn("text-[11px] font-medium", styles[status] || "")}
    >
      {labels[status] || status}
    </Badge>
  );
}
