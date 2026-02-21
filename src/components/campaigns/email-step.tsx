"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, GripVertical } from "lucide-react";
import { EmailStep } from "@/lib/types";

interface EmailStepEditorProps {
  step: EmailStep;
  index: number;
  isLast: boolean;
  canRemove: boolean;
  onChange: (step: EmailStep) => void;
  onRemove: () => void;
}

export function EmailStepEditor({
  step,
  index,
  isLast,
  canRemove,
  onChange,
  onRemove,
}: EmailStepEditorProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-3.5 bg-muted/30">
        <div className="flex items-center gap-2.5">
          <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab" />
          <span className="text-[14px] font-semibold font-heading">
            Email {index + 1}
          </span>
          {index === 0 && (
            <span className="text-[12px] text-muted-foreground">(required)</span>
          )}
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Subject Line
          </Label>
          <Input
            value={step.subject}
            onChange={(e) => onChange({ ...step, subject: e.target.value })}
            placeholder={
              index === 0
                ? "e.g., Quick note on {{Company}}"
                : "e.g., Re: Quick note on {{Company}}"
            }
            className="h-9 text-[13px] rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Email Body
          </Label>
          <Textarea
            value={step.body}
            onChange={(e) => onChange({ ...step, body: e.target.value })}
            placeholder="Write the email body. Use {{First Name}}, {{Company}}, {{Title}} for personalization."
            rows={6}
            className="text-[13px] leading-relaxed resize-y font-mono rounded-lg"
          />
          <p className="text-[11px] text-muted-foreground">
            Variables: {"{{First Name}}"}, {"{{Last Name}}"},{" "}
            {"{{Company}}"}, {"{{Title}}"}
          </p>
        </div>

        {!isLast && (
          <div className="space-y-2 pt-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Wait Before Next Email
            </Label>
            <div className="flex items-center gap-2.5">
              <Input
                type="number"
                min={1}
                max={30}
                value={step.wait_days ?? 3}
                onChange={(e) =>
                  onChange({
                    ...step,
                    wait_days: parseInt(e.target.value) || 3,
                  })
                }
                className="h-9 w-20 text-[13px] tabular-nums font-mono rounded-lg"
              />
              <span className="text-[13px] text-muted-foreground">days</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
