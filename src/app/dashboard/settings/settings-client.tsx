"use client";

import { useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Settings2,
  Clock,
  FlaskConical,
} from "lucide-react";
import { toggleAutoSend, toggleTestMode } from "@/lib/actions/sending";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface SettingsClientProps {
  autoSendEnabled: boolean;
  testMode: boolean;
}

export default function SettingsClient({
  autoSendEnabled,
  testMode,
}: SettingsClientProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold font-heading tracking-[-0.02em]">
          Settings
        </h1>
        <p className="text-[14px] text-muted-foreground mt-1">
          Outreach configuration
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-[17px] font-semibold font-heading">
          Automatic Sending
        </h2>
        <Card className="bg-card rounded-xl border border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                  autoSendEnabled ? "bg-amber/10" : "bg-muted"
                )}
              >
                <Clock
                  className={cn(
                    "h-5 w-5 transition-colors",
                    autoSendEnabled ? "text-amber" : "text-muted-foreground"
                  )}
                />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold font-heading">
                  Weekdays, 9 AM - 5 PM EST
                </p>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Batch sends every hour during business hours, respecting per-inbox rate limits.
                </p>
              </div>
              <Switch
                checked={autoSendEnabled}
                disabled={isPending}
                onCheckedChange={(val) => {
                  startTransition(async () => {
                    await toggleAutoSend(val);
                    toast.success(
                      val
                        ? "Automatic sending enabled"
                        : "Automatic sending disabled"
                    );
                  });
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-[17px] font-semibold font-heading">
          Delivery Mode
        </h2>
        <Card className="bg-card rounded-xl border border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber/10">
                <Settings2 className="h-5 w-5 text-amber" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold font-heading">
                  Send to Drafts
                </p>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Emails are saved as drafts for QA review before sending.
                  Toggle off for fully autonomous sending.
                </p>
              </div>
              <Badge className="bg-amber/15 text-amber-foreground border-amber/20 text-[11px]">
                Drafts Mode
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-[17px] font-semibold font-heading">Developer</h2>
        <Card
          className={cn(
            "rounded-xl border-dashed",
            testMode
              ? "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20"
              : "border-border bg-card"
          )}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                  testMode ? "bg-orange-100 dark:bg-orange-900/30" : "bg-muted"
                )}
              >
                <FlaskConical
                  className={cn(
                    "h-5 w-5 transition-colors",
                    testMode
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-muted-foreground"
                  )}
                />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold font-heading">
                  Test Mode
                </p>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Wait periods use minutes instead of days. A &quot;wait 3
                  days&quot; campaign step becomes 3 minutes.
                </p>
              </div>
              <Switch
                checked={testMode}
                disabled={isPending}
                activeClass="bg-orange-500"
                onCheckedChange={(val) => {
                  startTransition(async () => {
                    await toggleTestMode(val);
                    toast.success(
                      val ? "Test mode enabled" : "Test mode disabled"
                    );
                  });
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
