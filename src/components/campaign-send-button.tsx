"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { manualSendCampaign } from "@/lib/actions/sending";
import { toast } from "sonner";

interface CampaignSendButtonProps {
  campaignId: string;
  eligibleCount: number;
}

export function CampaignSendButton({
  campaignId,
  eligibleCount,
}: CampaignSendButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    startTransition(async () => {
      const res = await manualSendCampaign(campaignId);
      if (res.sent > 0) {
        toast.success(
          `${res.sent} email${res.sent === 1 ? "" : "s"} sent for this campaign`
        );
      } else {
        toast.info("No eligible emails to send for this campaign right now");
      }
    });
  };

  return (
    <Button
      onClick={handleSend}
      disabled={isPending || eligibleCount === 0}
      className="bg-amber text-amber-foreground hover:bg-amber/90 h-9 text-[13px] font-semibold rounded-lg"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5 mr-1.5" />
      )}
      Send Now
      {eligibleCount > 0 && (
        <span className="ml-1 font-mono tabular-nums opacity-70">
          ({eligibleCount})
        </span>
      )}
    </Button>
  );
}
