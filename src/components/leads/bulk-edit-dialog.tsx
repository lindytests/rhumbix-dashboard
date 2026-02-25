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
import { updateLeads } from "@/lib/actions/leads";
import { toast } from "sonner";
import type { Lead, Campaign } from "@/lib/types";

interface BulkEditDialogProps {
  leads: Lead[];
  selectedIds: Set<string>;
  campaigns: Campaign[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getSharedValue(
  selectedLeads: Lead[],
  field: keyof Lead
): string | null {
  if (selectedLeads.length === 0) return null;
  const first = selectedLeads[0][field] ?? "";
  const allSame = selectedLeads.every((l) => (l[field] ?? "") === first);
  return allSame ? String(first) : null;
}

export function BulkEditDialog({
  leads,
  selectedIds,
  campaigns,
  open,
  onOpenChange,
}: BulkEditDialogProps) {
  const selectedLeads = leads.filter((l) => selectedIds.has(l.id));
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    company: "",
    title: "",
    campaign_id: "",
  });
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Re-initialize form when dialog opens with new selection
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    const newForm = {
      first_name: getSharedValue(selectedLeads, "first_name") ?? "",
      last_name: getSharedValue(selectedLeads, "last_name") ?? "",
      company: getSharedValue(selectedLeads, "company") ?? "",
      title: getSharedValue(selectedLeads, "title") ?? "",
      campaign_id: getSharedValue(selectedLeads, "campaign_id") ?? "",
    };
    setForm(newForm);
    setTouched(new Set());
  }
  if (open !== prevOpen) setPrevOpen(open);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => new Set(prev).add(field));
  };

  const placeholder = (field: keyof Lead) => {
    const shared = getSharedValue(selectedLeads, field);
    return shared === null ? "Multiple values" : undefined;
  };

  const handleSave = () => {
    if (touched.size === 0) {
      onOpenChange(false);
      return;
    }

    const data: Record<string, string> = {};
    for (const field of touched) {
      data[field] = form[field as keyof typeof form];
    }

    const count = selectedIds.size;
    startTransition(async () => {
      await updateLeads(Array.from(selectedIds), data);
      toast.success(`${count} lead${count === 1 ? "" : "s"} updated`);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold font-heading">
            Edit {selectedIds.size} Lead{selectedIds.size !== 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>
        <p className="text-[12px] text-muted-foreground -mt-1">
          Only changed fields will be applied.
        </p>
        <div className="space-y-4 mt-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                First Name
              </Label>
              <Input
                value={form.first_name}
                onChange={(e) => updateField("first_name", e.target.value)}
                className="h-9 text-[13px] rounded-lg"
                placeholder={placeholder("first_name") ?? "First name"}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Last Name
              </Label>
              <Input
                value={form.last_name}
                onChange={(e) => updateField("last_name", e.target.value)}
                className="h-9 text-[13px] rounded-lg"
                placeholder={placeholder("last_name") ?? "Last name"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Company
            </Label>
            <Input
              value={form.company}
              onChange={(e) => updateField("company", e.target.value)}
              className="h-9 text-[13px] rounded-lg"
              placeholder={placeholder("company") ?? "Company"}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Title
            </Label>
            <Input
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="h-9 text-[13px] rounded-lg"
              placeholder={placeholder("title") ?? "Title"}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Campaign
            </Label>
            <Select
              value={form.campaign_id}
              onValueChange={(v) => updateField("campaign_id", v)}
            >
              <SelectTrigger className="h-9 text-[13px] rounded-lg">
                <SelectValue
                  placeholder={
                    getSharedValue(selectedLeads, "campaign_id") === null
                      ? "Multiple campaigns"
                      : "Select campaign"
                  }
                />
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
            {touched.size === 0 ? "No Changes" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
