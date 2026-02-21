"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmailStepEditor } from "./email-step";
import { EmailStep, Campaign } from "@/lib/types";
import { createCampaign, updateCampaign } from "@/lib/actions/campaigns";
import { Plus, Save, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface CampaignFormProps {
  campaign?: Campaign;
}

function campaignToSteps(campaign: Campaign): EmailStep[] {
  const steps: EmailStep[] = [];
  if (campaign.email_1_body) {
    steps.push({
      subject: campaign.email_1_subject,
      body: campaign.email_1_body,
      wait_days: campaign.wait_after_email_1,
    });
  }
  if (campaign.email_2_body) {
    steps.push({
      subject: campaign.email_2_subject!,
      body: campaign.email_2_body,
      wait_days: campaign.wait_after_email_2,
    });
  }
  if (campaign.email_3_body) {
    steps.push({
      subject: campaign.email_3_subject!,
      body: campaign.email_3_body,
      wait_days: campaign.wait_after_email_3,
    });
  }
  if (campaign.email_4_body) {
    steps.push({
      subject: campaign.email_4_subject!,
      body: campaign.email_4_body,
      wait_days: campaign.wait_after_email_4,
    });
  }
  if (campaign.email_5_body) {
    steps.push({
      subject: campaign.email_5_subject!,
      body: campaign.email_5_body,
      wait_days: null,
    });
  }
  return steps;
}

export function CampaignForm({ campaign }: CampaignFormProps) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [steps, setSteps] = useState<EmailStep[]>(
    campaign
      ? campaignToSteps(campaign)
      : [{ subject: "", body: "", wait_days: 3 }]
  );
  const [isPending, startTransition] = useTransition();

  const addStep = () => {
    if (steps.length >= 5) return;
    setSteps([...steps, { subject: "", body: "", wait_days: 3 }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, step: EmailStep) => {
    setSteps(steps.map((s, i) => (i === index ? step : s)));
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    if (!steps[0].subject.trim() || !steps[0].body.trim()) {
      toast.error("Email 1 subject and body are required");
      return;
    }
    startTransition(async () => {
      if (campaign) {
        await updateCampaign(campaign.id, name, steps);
      } else {
        await createCampaign(name, steps);
      }
    });
  };

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
              {campaign ? "Edit Campaign" : "New Campaign"}
            </h1>
            <p className="text-[14px] text-muted-foreground mt-0.5">
              Define the email sequence for this campaign
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="bg-amber text-amber-foreground hover:bg-amber/90 h-9 text-[13px] font-semibold rounded-lg"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          {campaign ? "Save Changes" : "Create Campaign"}
        </Button>
      </div>

      <Card className="bg-card rounded-2xl border border-border">
        <CardContent className="p-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Campaign Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Feb 2026 - Construction Ops"
              className="h-10 text-[16px] font-semibold font-heading rounded-lg"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold font-heading">
            Email Sequence
          </h2>
          <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
            {steps.length} of 5 emails
          </span>
        </div>

        {steps.map((step, index) => (
          <EmailStepEditor
            key={index}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
            canRemove={index > 0}
            onChange={(updated) => updateStep(index, updated)}
            onRemove={() => removeStep(index)}
          />
        ))}

        {steps.length < 5 && (
          <Button
            variant="outline"
            onClick={addStep}
            className="w-full h-10 text-[13px] border-dashed rounded-xl font-medium"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Email {steps.length + 1}
          </Button>
        )}
      </div>
    </div>
  );
}
