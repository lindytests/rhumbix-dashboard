"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLead } from "@/lib/actions/leads";
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface EmailStep {
  subject: string;
  body: string;
  wait: number;
}

export default function NewLeadClient() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    company: "",
    title: "",
  });
  const [emailSteps, setEmailSteps] = useState<EmailStep[]>([
    { subject: "", body: "", wait: 1 },
  ]);
  const [isPending, startTransition] = useTransition();

  const addEmailStep = () => {
    if (emailSteps.length >= 5) return;
    setEmailSteps([...emailSteps, { subject: "", body: "", wait: 1 }]);
  };

  const removeEmailStep = (index: number) => {
    if (emailSteps.length <= 1) return;
    setEmailSteps(emailSteps.filter((_, i) => i !== index));
  };

  const updateEmailStep = (
    index: number,
    field: keyof EmailStep,
    value: string | number
  ) => {
    setEmailSteps(
      emailSteps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step
      )
    );
  };

  const handleSave = () => {
    if (isPending) return;
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!emailSteps[0].subject.trim() || !emailSteps[0].body.trim()) {
      toast.error("Email 1 subject and body are required");
      return;
    }

    const data: Record<string, unknown> = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      company: form.company,
      title: form.title,
      email_1_subject: emailSteps[0].subject,
      email_1_body: emailSteps[0].body,
      wait_after_email_1: emailSteps[0].wait,
    };

    for (let i = 1; i < emailSteps.length; i++) {
      const step = emailSteps[i];
      if (step.subject.trim() && step.body.trim()) {
        data[`email_${i + 1}_subject`] = step.subject;
        data[`email_${i + 1}_body`] = step.body;
        if (i < emailSteps.length - 1) {
          data[`wait_after_email_${i + 1}`] = step.wait;
        }
      }
    }

    startTransition(async () => {
      await createLead(data as Parameters<typeof createLead>[0]);
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
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
              Manually add a single lead with email sequence
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="bg-amber text-white shadow-[0_1px_4px_-2px_rgba(0,0,0,0.025),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none h-9 text-[13px] font-semibold"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save Lead
        </Button>
      </div>

      {/* Lead Info */}
      <Card className="bg-card rounded-xl border border-border">
        <CardContent className="p-6 space-y-5">
          <h2 className="text-[14px] font-medium text-foreground">
            Lead Information
          </h2>
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
        </CardContent>
      </Card>

      {/* Email Sequence */}
      <Card className="bg-card rounded-xl border border-border">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-foreground">
              Email Sequence *
            </h2>
            <span className="text-[12px] text-muted-foreground">
              {emailSteps.length} of 5 emails
            </span>
          </div>

          <div className="space-y-5">
            {emailSteps.map((step, i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 border-l-2 border-amber pl-3">
                    <span className="text-[13px] font-semibold text-foreground">
                      Email {i + 1}
                    </span>
                    {i === 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        (required)
                      </span>
                    )}
                  </div>
                  {i > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEmailStep(i)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="space-y-3 pl-5">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Subject {i === 0 ? "*" : ""}
                    </Label>
                    <Input
                      value={step.subject}
                      onChange={(e) => updateEmailStep(i, "subject", e.target.value)}
                      className="h-9 text-[13px] rounded-lg"
                      placeholder={`Email ${i + 1} subject line`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Body {i === 0 ? "*" : ""}
                    </Label>
                    <textarea
                      value={step.body}
                      onChange={(e) => updateEmailStep(i, "body", e.target.value)}
                      className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-[13px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] min-h-[120px] resize-y"
                      placeholder={`Email ${i + 1} body content`}
                    />
                  </div>
                  {i < emailSteps.length - 1 && (
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Wait before next email
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={step.wait}
                          onChange={(e) =>
                            updateEmailStep(i, "wait", parseInt(e.target.value) || 1)
                          }
                          className="h-9 w-20 text-[13px] rounded-lg text-center"
                        />
                        <span className="text-[12px] text-muted-foreground">
                          days
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {emailSteps.length < 5 && (
            <Button
              variant="ghost"
              onClick={addEmailStep}
              className="h-9 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Email {emailSteps.length + 1}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
