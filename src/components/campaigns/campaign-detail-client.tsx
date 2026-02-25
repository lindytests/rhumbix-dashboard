"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Lightbulb, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { CampaignSendButton } from "@/components/campaign-send-button";
import { CampaignDeleteButton } from "@/components/campaign-delete-button";
import { updateCampaignInline } from "@/lib/actions/campaigns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStats, Lead, EmailStep } from "@/lib/types";

interface CampaignDetailClientProps {
  campaign: Campaign;
  stats: CampaignStats | undefined;
  leads: Lead[];
  eligibleCount: number;
}

function campaignToSteps(campaign: Campaign): EmailStep[] {
  const steps: EmailStep[] = [];
  if (campaign.email_1_body)
    steps.push({
      subject: campaign.email_1_subject,
      body: campaign.email_1_body,
      wait_days: campaign.wait_after_email_1,
    });
  if (campaign.email_2_body)
    steps.push({
      subject: campaign.email_2_subject!,
      body: campaign.email_2_body,
      wait_days: campaign.wait_after_email_2,
    });
  if (campaign.email_3_body)
    steps.push({
      subject: campaign.email_3_subject!,
      body: campaign.email_3_body,
      wait_days: campaign.wait_after_email_3,
    });
  if (campaign.email_4_body)
    steps.push({
      subject: campaign.email_4_subject!,
      body: campaign.email_4_body,
      wait_days: campaign.wait_after_email_4,
    });
  if (campaign.email_5_body)
    steps.push({
      subject: campaign.email_5_subject!,
      body: campaign.email_5_body,
      wait_days: null,
    });
  return steps;
}

type EditingField =
  | { type: "name" }
  | { type: "subject"; step: number }
  | { type: "body"; step: number }
  | { type: "wait"; step: number }
  | null;

export function CampaignDetailClient({
  campaign,
  stats,
  leads: campaignLeads,
  eligibleCount,
}: CampaignDetailClientProps) {
  const initialSteps = campaignToSteps(campaign);
  const [name, setName] = useState(campaign.name);
  const [steps, setSteps] = useState<EmailStep[]>(initialSteps);
  const [savedName, setSavedName] = useState(campaign.name);
  const [savedSteps, setSavedSteps] = useState<EmailStep[]>(initialSteps);
  const [editing, setEditing] = useState<EditingField>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isDirty =
    name !== savedName || JSON.stringify(steps) !== JSON.stringify(savedSteps);

  // Focus input/textarea when editing starts
  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => {
      if (editing.type === "body") {
        textareaRef.current?.focus();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    });
  }, [editing]);

  // Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // beforeunload warning
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const commitEditing = useCallback(() => {
    if (!editing) return;
    const value = editBuffer;
    if (editing.type === "name") {
      if (value.trim()) setName(value);
    } else if (editing.type === "subject") {
      setSteps((prev) =>
        prev.map((s, i) =>
          i === editing.step ? { ...s, subject: value } : s
        )
      );
    } else if (editing.type === "body") {
      setSteps((prev) =>
        prev.map((s, i) =>
          i === editing.step ? { ...s, body: value } : s
        )
      );
    } else if (editing.type === "wait") {
      const num = parseInt(value, 10);
      if (num >= 1 && num <= 30) {
        setSteps((prev) =>
          prev.map((s, i) =>
            i === editing.step ? { ...s, wait_days: num } : s
          )
        );
      }
    }
    setEditing(null);
  }, [editing, editBuffer]);

  const cancelEditing = useCallback(() => {
    setEditing(null);
  }, []);

  const startEditing = useCallback(
    (field: EditingField) => {
      // Commit any current edit first
      if (editing) commitEditing();
      if (!field) return;
      if (field.type === "name") {
        setEditBuffer(name);
      } else if (field.type === "subject") {
        setEditBuffer(steps[field.step].subject);
      } else if (field.type === "body") {
        setEditBuffer(steps[field.step].body);
      } else if (field.type === "wait") {
        setEditBuffer(String(steps[field.step].wait_days ?? 3));
      }
      setEditing(field);
    },
    [editing, commitEditing, name, steps]
  );

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    if (!steps[0]?.subject.trim() || !steps[0]?.body.trim()) {
      toast.error("Email 1 subject and body are required");
      return;
    }
    // Ensure wait_days invariant: last step has null, others have a value
    const normalizedSteps = steps.map((s, i) => ({
      ...s,
      wait_days: i < steps.length - 1 ? (s.wait_days ?? 3) : null,
    }));
    startTransition(async () => {
      const res = await updateCampaignInline(
        campaign.id,
        name,
        normalizedSteps
      );
      if (res.success) {
        setSavedName(name);
        setSteps(normalizedSteps);
        setSavedSteps(normalizedSteps);
        toast.success("Campaign saved");
      }
    });
  };

  const handleDiscard = () => {
    setName(savedName);
    setSteps(savedSteps);
    setEditing(null);
  };

  const addStep = () => {
    if (steps.length >= 5) return;
    // Give current last step a wait_days
    const updated = steps.map((s, i) => ({
      ...s,
      wait_days: i === steps.length - 1 ? (s.wait_days ?? 3) : s.wait_days,
    }));
    const newSteps = [
      ...updated,
      { subject: "", body: "", wait_days: null },
    ];
    setSteps(newSteps);
    // Auto-open the new step's subject for editing
    requestAnimationFrame(() => {
      startEditing({ type: "subject", step: newSteps.length - 1 });
    });
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const updated = steps.filter((_, i) => i !== index);
    // Fix last step's wait_days to null
    const fixed = updated.map((s, i) => ({
      ...s,
      wait_days: i === updated.length - 1 ? null : (s.wait_days ?? 3),
    }));
    setSteps(fixed);
    if (
      editing &&
      editing.type !== "name" &&
      "step" in editing &&
      editing.step === index
    ) {
      setEditing(null);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    isTextarea = false
  ) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    } else if (e.key === "Enter" && !isTextarea) {
      e.preventDefault();
      commitEditing();
    }
  };

  return (
    <>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 w-8 p-0 rounded-lg"
          >
            <Link href="/dashboard/campaigns">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            {editing?.type === "name" ? (
              <input
                ref={inputRef}
                value={editBuffer}
                onChange={(e) => setEditBuffer(e.target.value)}
                onBlur={commitEditing}
                onKeyDown={(e) => handleKeyDown(e)}
                className="text-2xl font-semibold font-heading tracking-[-0.02em] bg-transparent border-0 border-b-2 border-amber outline-none w-full min-w-[200px] p-0"
              />
            ) : (
              <h1
                onClick={() => startEditing({ type: "name" })}
                className="text-2xl font-semibold font-heading tracking-[-0.02em] cursor-text rounded px-1 -mx-1 hover:bg-muted/40 transition-colors truncate max-w-[500px]"
                title={name}
              >
                {name}
              </h1>
            )}
            <p className="text-[14px] text-muted-foreground mt-0.5">
              {steps.length} email sequence &middot; Created{" "}
              {new Date(campaign.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CampaignDeleteButton
            campaignId={campaign.id}
            campaignName={name}
            leadCount={campaignLeads.length}
          />
          <CampaignSendButton
            campaignId={campaign.id}
            eligibleCount={eligibleCount}
          />
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 stagger-children">
          {[
            { label: "Total Leads", value: stats.total_leads },
            { label: "Pending", value: stats.pending },
            { label: "In Progress", value: stats.in_progress },
            { label: "Replied", value: stats.responded, highlight: true },
          ].map((item) => (
            <Card
              key={item.label}
              className="bg-card rounded-xl border border-border"
            >
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

          {/* Placeholder tip */}
          <div className="rounded-xl border border-amber/20 bg-amber/[0.04] px-5 py-4">
            <div className="flex gap-3">
              <Lightbulb className="h-4 w-4 text-amber shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-[13px] font-semibold text-foreground leading-snug">
                  Use placeholders in your email copy
                </p>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Wrap any instruction in{" "}
                  <code className="text-[11px] bg-amber/10 text-amber-foreground px-1 py-px rounded font-mono">{"{{"}...{"}}"}</code>{" "}
                  and AI will fill it in per lead. Use data fields like{" "}
                  <code className="text-[11px] bg-amber/10 text-amber-foreground px-1 py-px rounded font-mono">{"{{first_name}}"}</code>{" "}
                  or natural language like{" "}
                  <code className="text-[11px] bg-amber/10 text-amber-foreground px-1 py-px rounded font-mono">{"{{2-3 sentence outro that leaves the door open}}"}</code>.
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                  Note: The referenced data must be available to the agent (e.g. imported as lead fields).
                  <br />
                  Placeholders referencing unavailable data will be skipped.
                </p>
              </div>
            </div>
          </div>

          {steps.map((step, i) => (
            <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
              <Card className="bg-card rounded-xl border border-border overflow-hidden group">
                <div className="flex items-center justify-between border-b border-border px-5 py-2.5 bg-muted/30">
                  <span className="text-[13px] font-semibold text-foreground">
                    Email {i + 1}
                  </span>
                  {i > 0 && (
                    <button
                      onClick={() => removeStep(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600 p-0.5 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <CardContent className="p-5 space-y-3">
                  {/* Subject */}
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Subject
                    </p>
                    {editing?.type === "subject" &&
                    editing.step === i ? (
                      <input
                        ref={inputRef}
                        value={editBuffer}
                        onChange={(e) => setEditBuffer(e.target.value)}
                        onBlur={commitEditing}
                        onKeyDown={(e) => handleKeyDown(e)}
                        placeholder="Email subject line..."
                        className="text-[14px] font-semibold font-heading bg-transparent border-0 border-b-2 border-amber outline-none w-full p-0"
                      />
                    ) : (
                      <p
                        onClick={() =>
                          startEditing({ type: "subject", step: i })
                        }
                        className={cn(
                          "text-[14px] font-semibold font-heading cursor-text rounded px-1 -mx-1 hover:bg-muted/40 transition-colors",
                          !step.subject && "text-muted-foreground/50 italic"
                        )}
                      >
                        {step.subject || "Click to add subject..."}
                      </p>
                    )}
                  </div>

                  {/* Body */}
                  <div className="border-t border-border pt-3">
                    {editing?.type === "body" && editing.step === i ? (
                      <textarea
                        ref={textareaRef}
                        value={editBuffer}
                        onChange={(e) => setEditBuffer(e.target.value)}
                        onBlur={commitEditing}
                        onKeyDown={(e) => handleKeyDown(e, true)}
                        placeholder="Email body..."
                        className="text-[13px] leading-relaxed text-muted-foreground bg-transparent border-0 border-b-2 border-amber outline-none w-full p-0 resize-none min-h-[80px]"
                        style={{ fieldSizing: "content" } as React.CSSProperties}
                      />
                    ) : (
                      <p
                        onClick={() =>
                          startEditing({ type: "body", step: i })
                        }
                        className={cn(
                          "text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap cursor-text rounded px-1 -mx-1 hover:bg-muted/40 transition-colors",
                          !step.body && "text-muted-foreground/50 italic"
                        )}
                      >
                        {step.body || "Click to add body..."}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Wait pill - only for non-last steps */}
              {i < steps.length - 1 && (
                <div className="flex items-center justify-center pt-3">
                  <div className="flex items-center gap-2.5 border border-dashed border-border bg-muted/40 px-4 py-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Wait{" "}
                      {editing?.type === "wait" && editing.step === i ? (
                        <input
                          ref={inputRef}
                          type="number"
                          min={1}
                          max={30}
                          value={editBuffer}
                          onChange={(e) => setEditBuffer(e.target.value)}
                          onBlur={commitEditing}
                          onKeyDown={(e) => handleKeyDown(e)}
                          className="w-8 text-center text-[11px] font-mono tabular-nums font-semibold text-foreground bg-white border border-amber rounded outline-none p-0 inline-block [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      ) : (
                        <button
                          onClick={() =>
                            startEditing({ type: "wait", step: i })
                          }
                          className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-foreground cursor-text border border-dashed border-muted-foreground/30 rounded bg-white/80 px-1.5 py-px hover:border-amber hover:bg-amber/5 transition-colors"
                        >
                          {step.wait_days ?? 3}
                          <Pencil className="h-2 w-2 text-muted-foreground/40" />
                        </button>
                      )}{" "}
                      {(step.wait_days ?? 3) === 1 ? "day" : "days"}
                    </span>
                  </div>
                </div>
              )}
            </div>
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

        {/* Leads */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold font-heading">Leads</h2>
            <Link
              href={"/dashboard/leads?campaign=" + campaign.id}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2 stagger-children">
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

      {/* Spacer when save bar is visible so content isn't hidden behind it */}
      {isDirty && <div className="h-14" />}
    </div>

    {/* Floating save bar -- outside space-y-8 to avoid layout interference */}
    <div
      className={cn(
        "fixed bottom-0 left-0 lg:left-60 right-0 z-50 transition-all duration-300 ease-out",
        isDirty
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none"
      )}
    >
      <div className="border-t border-border bg-background/95 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <p className="text-[13px] text-muted-foreground font-medium">
            You have unsaved changes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDiscard}
              disabled={isPending}
              className="h-8 text-[13px] rounded-lg font-medium"
            >
              Discard
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="h-8 text-[13px] rounded-lg font-semibold bg-amber text-white shadow-[0_1px_4px_-2px_rgba(0,0,0,0.025),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : null}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
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
