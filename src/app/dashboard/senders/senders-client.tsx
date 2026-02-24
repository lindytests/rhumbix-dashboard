"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Inbox,
  Pencil,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  createInbox,
  updateInbox,
  toggleInbox as toggleInboxAction,
} from "@/lib/actions/inboxes";
import type { SenderInbox, InboxStats } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SendersClientProps {
  inboxes: SenderInbox[];
  inboxStats: InboxStats[];
}

export default function SendersClient({
  inboxes,
  inboxStats,
}: SendersClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInbox, setEditingInbox] = useState<SenderInbox | null>(null);
  const [form, setForm] = useState({
    email: "",
    display_name: "",
    lindy_webhook_url: "",
    lindy_webhook_secret: "",
    daily_limit: 80,
    hourly_limit: 10,
  });
  const [isPending, startTransition] = useTransition();

  const openNewDialog = () => {
    setEditingInbox(null);
    setForm({ email: "", display_name: "", lindy_webhook_url: "", lindy_webhook_secret: "", daily_limit: 80, hourly_limit: 10 });
    setDialogOpen(true);
  };

  const openEditDialog = (inbox: SenderInbox) => {
    setEditingInbox(inbox);
    setForm({
      email: inbox.email,
      display_name: inbox.display_name,
      lindy_webhook_url: inbox.lindy_webhook_url,
      lindy_webhook_secret: inbox.lindy_webhook_secret ?? "",
      daily_limit: inbox.daily_limit,
      hourly_limit: inbox.hourly_limit,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.email || !form.lindy_webhook_url) {
      toast.error("Email and webhook URL are required");
      return;
    }
    startTransition(async () => {
      if (editingInbox) {
        await updateInbox(editingInbox.id, form);
        toast.success("Inbox updated");
      } else {
        await createInbox(form);
        toast.success("Inbox added");
      }
      setDialogOpen(false);
    });
  };

  const handleToggle = (id: string, currentActive: boolean) => {
    startTransition(async () => {
      await toggleInboxAction(id, !currentActive);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-[-0.02em]">
            Senders
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            {inboxes.length} sender inbox{inboxes.length !== 1 ? "es" : ""} configured
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNewDialog}
              className="bg-amber text-white shadow-[0_1px_2px_0_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(255,255,255,0.15)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none h-9 text-[13px] font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Inbox
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[18px] font-semibold font-heading">
                {editingInbox ? "Edit Inbox" : "Add Sender Inbox"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Email Address
                </Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-9 text-[13px] rounded-lg"
                  placeholder="brett@rhumbix.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Display Name
                </Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="h-9 text-[13px] rounded-lg"
                  placeholder="Brett"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Lindy Webhook URL
                </Label>
                <Input
                  value={form.lindy_webhook_url}
                  onChange={(e) => setForm({ ...form, lindy_webhook_url: e.target.value })}
                  className="h-9 text-[13px] font-mono rounded-lg"
                  placeholder="https://public.lindy.ai/api/v1/webhooks/..."
                />
                <p className="text-[11px] text-muted-foreground">
                  The webhook trigger URL from the Lindy mailer agent for this inbox
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Webhook Secret
                </Label>
                <Input
                  type="password"
                  value={form.lindy_webhook_secret}
                  onChange={(e) => setForm({ ...form, lindy_webhook_secret: e.target.value })}
                  className="h-9 text-[13px] font-mono rounded-lg"
                  placeholder="Lindy webhook secret"
                />
                <p className="text-[11px] text-muted-foreground">
                  Found in the Lindy webhook trigger settings under &quot;Webhook Secret&quot;
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Daily Limit
                  </Label>
                  <Input
                    type="number"
                    value={form.daily_limit}
                    onChange={(e) => setForm({ ...form, daily_limit: parseInt(e.target.value, 10) || 80 })}
                    className="h-9 text-[13px] tabular-nums font-mono rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Hourly Limit
                  </Label>
                  <Input
                    type="number"
                    value={form.hourly_limit}
                    onChange={(e) => setForm({ ...form, hourly_limit: parseInt(e.target.value, 10) || 10 })}
                    className="h-9 text-[13px] tabular-nums font-mono rounded-lg"
                  />
                </div>
              </div>
              <Button
                onClick={handleSave}
                disabled={isPending}
                className="w-full bg-amber text-white shadow-[0_1px_2px_0_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(255,255,255,0.15)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none h-9 text-[13px] font-semibold mt-1"
              >
                {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {editingInbox ? "Save Changes" : "Add Inbox"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3 stagger-children">
        {inboxes.map((inbox) => {
          const stats = inboxStats.find((s) => s.id === inbox.id);
          return (
            <Card
              key={inbox.id}
              className={cn(
                "bg-card rounded-xl border border-border transition-[opacity,border-color,box-shadow]",
                inbox.is_active
                  ? "hover:border-amber/15 hover:shadow-sm"
                  : "opacity-50"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted mt-0.5">
                      <Inbox className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <p className="text-[15px] font-semibold font-heading">
                          {inbox.email}
                        </p>
                        <Badge
                          variant={inbox.is_active ? "secondary" : "outline"}
                          className="text-[11px]"
                        >
                          {inbox.is_active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-0.5">
                        {inbox.display_name} &middot;{" "}
                        <span className="font-mono tabular-nums">{inbox.daily_limit}</span>/day,{" "}
                        <span className="font-mono tabular-nums">{inbox.hourly_limit}</span>/hr
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" aria-label={`Edit ${inbox.email}`} className="h-8 w-8 p-0 rounded-lg" onClick={() => openEditDialog(inbox)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Switch
                      checked={inbox.is_active}
                      onCheckedChange={() => handleToggle(inbox.id, inbox.is_active)}
                    />
                  </div>
                </div>

                {stats && inbox.is_active && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted-foreground">
                        Today:{" "}
                        <span className="font-semibold font-mono tabular-nums text-foreground">
                          {stats.sent_today}
                        </span>{" "}
                        sent
                      </span>
                      <span className="text-muted-foreground font-mono tabular-nums">
                        This hour: {stats.sent_this_hour}/{inbox.hourly_limit}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber/80 transition-all duration-500"
                        style={{
                          width: `${Math.min((stats.sent_today / inbox.daily_limit) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {inboxes.length === 0 && (
          <Card className="bg-card rounded-xl border border-border">
            <CardContent className="p-16 text-center animate-fade-in">
              <p className="text-[14px] text-muted-foreground">
                No sender inboxes configured
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
