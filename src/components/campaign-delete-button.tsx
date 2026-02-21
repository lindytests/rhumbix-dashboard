"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Trash2, Loader2 } from "lucide-react";
import { deleteCampaign } from "@/lib/actions/campaigns";
import { toast } from "sonner";

interface CampaignDeleteButtonProps {
  campaignId: string;
  campaignName: string;
  leadCount: number;
}

export function CampaignDeleteButton({
  campaignId,
  campaignName,
  leadCount,
}: CampaignDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      toast.success(`Campaign "${campaignName}" deleted`);
      await deleteCampaign(campaignId);
    });
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 text-[13px] rounded-lg font-medium text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-[-0.02em]">
              Delete campaign
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed">
              This will permanently delete <span className="font-semibold text-foreground">{campaignName}</span>
              {leadCount > 0 && (
                <> and its {leadCount} associated lead{leadCount !== 1 ? "s" : ""}</>
              )}
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="h-9 text-[13px] rounded-lg font-medium"
                disabled={isPending}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleDelete}
              disabled={isPending}
              className="h-9 text-[13px] rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-[0_1px_2px_0_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(255,255,255,0.1)]"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Delete Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
