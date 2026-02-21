"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
import { createLead } from "@/lib/actions/leads";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Campaign } from "@/lib/types";

interface NewLeadClientProps {
  campaigns: Campaign[];
}

export default function NewLeadClient({ campaigns }: NewLeadClientProps) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    company: "",
    title: "",
    campaign_id: "",
  });
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!form.campaign_id) {
      toast.error("Please select a campaign");
      return;
    }
    startTransition(async () => {
      await createLead(form);
    });
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-lg">
            <Link href="/dashboard/leads">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold font-heading tracking-[-0.02em]">
              Add Lead
            </h1>
            <p className="text-[14px] text-muted-foreground mt-0.5">
              Manually add a single lead
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
          Save Lead
        </Button>
      </div>

      <Card className="bg-card rounded-2xl border border-border">
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                First Name
              </Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
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
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="h-9 text-[13px] rounded-lg"
                placeholder="Chen"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Email *
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
              Campaign *
            </Label>
            <Select value={form.campaign_id} onValueChange={(v) => setForm({ ...form, campaign_id: v })}>
              <SelectTrigger className="h-9 text-[13px] rounded-lg">
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
