"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Clock, Lightbulb, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { createCampaign } from "@/lib/actions/campaigns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EmailStep } from "@/lib/types";

export function CampaignForm() {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<EmailStep[]>([
    { subject: "", body: "", wait_days: null },
  ]);
  const [isPending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus name on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleCreate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Campaign name is required");
      nameRef.current?.focus();
      return;
    }
    if (!steps[0].subject.trim() || !steps[0].body.trim()) {
      toast.error("Email 1 subject and body are required");
      return;
    }
    const normalizedSteps = steps.map((s, i) => ({
      ...s,
      wait_days: i < steps.length - 1 ? (s.wait_days ?? 3) : null,
    }));
    startTransition(async () => {
      await createCampaign(name, normalizedSteps);
    });
  };

  const updateStep = (index: number, partial: Partial<EmailStep>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...partial } : s))
    );
  };

  const addStep = () => {
    if (steps.length >= 5) return;
    const updated = steps.map((s, i) => ({
      ...s,
      wait_days: i === steps.length - 1 ? (s.wait_days ?? 3) : s.wait_days,
    }));
    setSteps([...updated, { subject: "", body: "", wait_days: null }]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const updated = steps.filter((_, i) => i !== index);
    const fixed = updated.map((s, i) => ({
      ...s,
      wait_days: i === updated.length - 1 ? null : (s.wait_days ?? 3),
    }));
    setSteps(fixed);
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
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign name..."
              className="text-2xl font-semibold font-heading tracking-[-0.02em] bg-transparent border-0 border-b-2 border-transparent focus:border-amber outline-none w-full min-w-[200px] p-0 placeholder:text-muted-foreground/40 placeholder:font-normal"
            />
            <p className="text-[14px] text-muted-foreground mt-0.5">
              New campaign
            </p>
          </div>
        </div>
      </div>

      {/* Email sequence -- single column for creation */}
      <div className="max-w-2xl space-y-3">
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
                  <input
                    value={step.subject}
                    onChange={(e) =>
                      updateStep(i, { subject: e.target.value })
                    }
                    placeholder={
                      i === 0
                        ? "e.g., Quick note on {{Company}}"
                        : "e.g., Following up on {{Company}}"
                    }
                    className="text-[14px] font-semibold font-heading bg-transparent border-0 border-b-2 border-transparent focus:border-amber outline-none w-full p-0 placeholder:text-muted-foreground/40 placeholder:font-normal placeholder:not-italic"
                  />
                </div>

                {/* Body */}
                <div className="border-t border-border pt-3">
                  <textarea
                    value={step.body}
                    onChange={(e) =>
                      updateStep(i, { body: e.target.value })
                    }
                    placeholder="Write your email body..."
                    className="text-[13px] leading-relaxed text-muted-foreground bg-transparent border-0 border-b-2 border-transparent focus:border-amber outline-none w-full p-0 resize-none min-h-[80px] placeholder:text-muted-foreground/40"
                    style={{ fieldSizing: "content" } as React.CSSProperties}
                  />
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
                    <span className="inline-flex items-center">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={step.wait_days ?? 3}
                        onChange={(e) =>
                          updateStep(i, {
                            wait_days: parseInt(e.target.value, 10) || 3,
                          })
                        }
                        className="w-8 text-center text-[11px] font-mono tabular-nums font-semibold text-foreground bg-white/80 border border-dashed border-muted-foreground/30 rounded outline-none p-0 hover:border-amber focus:border-amber focus:bg-white transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </span>{" "}
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

      {/* Spacer for bottom bar */}
      <div className="h-14" />
    </div>

    {/* Floating create bar */}
    <div className="fixed bottom-0 left-0 lg:left-60 right-0 z-50">
      <div className="border-t border-border bg-background/95 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <p className="text-[13px] text-muted-foreground font-medium">
            {steps.length} email{steps.length !== 1 ? "s" : ""} in sequence
          </p>
          <Button
            onClick={handleCreate}
            disabled={isPending}
            className="h-8 text-[13px] rounded-lg font-semibold bg-amber text-white shadow-[0_1px_4px_-2px_rgba(0,0,0,0.025),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : null}
            Create Campaign
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
