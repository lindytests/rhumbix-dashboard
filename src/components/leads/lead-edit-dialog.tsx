"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { updateLead } from "@/lib/actions/leads";
import { toast } from "sonner";
import type { Lead, Campaign } from "@/lib/types";

interface LeadEditDialogProps {
  lead: Lead | null;
  campaigns: Campaign[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadEditDialog({
  lead,
  campaigns,
  open,
  onOpenChange,
}: LeadEditDialogProps) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    company: "",
    title: "",
    campaign_id: "",
  });
  const [isPending, startTransition] = useTransition();

  // Sync form when lead changes
  const [prevLeadId, setPrevLeadId] = useState<string | null>(null);
  if (lead && lead.id !== prevLeadId) {
    setPrevLeadId(lead.id);
    setForm({
      first_name: lead.first_name ?? "",
      last_name: lead.last_name ?? "",
      email: lead.email,
      company: lead.company ?? "",
      title: lead.title ?? "",
      campaign_id: lead.campaign_id,
    });
  }
  if (!lead && prevLeadId !== null) {
    setPrevLeadId(null);
  }

  const handleSave = () => {
    if (!lead) return;
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!form.campaign_id) {
      toast.error("Please select a campaign");
      return;
    }
    startTransition(async () => {
      await updateLead(lead.id, {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        company: form.company,
        title: form.title,
        campaign_id: form.campaign_id,
      });
      toast.success("Lead updated");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold font-heading">
            Edit Lead
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                First Name
              </Label>
              <Input
                value={form.first_name}
                onChange={(e) =>
                  setForm({ ...form, first_name: e.target.value })
                }
                className="h-9 text-[13px] rounded-lg"
                placeholder="Jamie"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Last Name
              </Label>
              <Input
                value={form.last_name}
                onChange={(e) =>
                  setForm({ ...form, last_name: e.target.value })
                }
                className="h-9 text-[13px] rounded-lg"
                placeholder="Chen"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Email
            </Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-9 text-[13px] rounded-lg"
              placeholder="jamie@constructco.com"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Company
            </Label>
            <Input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="h-9 text-[13px] rounded-lg"
              placeholder="ConstructCo"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Title
            </Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-9 text-[13px] rounded-lg"
              placeholder="VP of Operations"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Campaign
            </Label>
            <Select
              value={form.campaign_id}
              onValueChange={(v) => setForm({ ...form, campaign_id: v })}
            >
              <SelectTrigger className="h-9 text-[13px] rounded-lg">
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSave}
            disabled={isPending}
            className="w-full bg-amber text-white shadow-[0_1px_4px_-2px_rgba(0,0,0,0.025),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none h-9 text-[13px] font-semibold mt-1"
          >
            {isPending && (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
