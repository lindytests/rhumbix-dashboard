"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Zap, ZapOff, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { manualSendBatch, toggleAutoSend } from "@/lib/actions/sending";
import { toast } from "sonner";

interface SendControlStripProps {
  autoSendEnabled: boolean;
  eligibleCount: number;
  testMode?: boolean;
}

export function SendControlStrip({
  autoSendEnabled,
  eligibleCount,
  testMode,
}: SendControlStripProps) {
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<{
    sent: number;
    errors: number;
  } | null>(null);

  const handleSend = () => {
    setLastResult(null);
    startTransition(async () => {
      const res = await manualSendBatch();
      setLastResult(res);
      if (res.sent > 0) {
        toast.success(
          `${res.sent} email${res.sent === 1 ? "" : "s"} sent`
        );
      } else {
        toast.info("No eligible emails to send right now");
      }
    });
  };

  const handleToggleAutoSend = () => {
    startTransition(async () => {
      await toggleAutoSend(!autoSendEnabled);
      toast.success(
        autoSendEnabled
          ? "Automatic sending disabled"
          : "Automatic sending enabled"
      );
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {testMode && (
        <Badge
          variant="outline"
          className="border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 text-[11px] font-semibold gap-1"
        >
          <FlaskConical className="h-3 w-3" />
          Test Mode
        </Badge>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleToggleAutoSend}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground cursor-pointer rounded-md px-2 py-1 hover:bg-muted/80 transition-colors"
          >
            {autoSendEnabled ? (
              <>
                <Zap className="h-3.5 w-3.5 text-amber" />
                <span className="font-medium">Auto-send on</span>
              </>
            ) : (
              <>
                <ZapOff className="h-3.5 w-3.5" />
                <span>Auto-send off</span>
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 p-3">
          {autoSendEnabled
            ? "Auto-send is ON \u2014 eligible emails are sent automatically every hour during business hours (weekdays 9\u20135 EST). Click to turn off."
            : "Auto-send is OFF \u2014 no emails will be sent unless you manually click \u201cSend Now.\u201d Click to turn on automatic hourly sending (weekdays 9\u20135 EST)."}
        </TooltipContent>
      </Tooltip>

      <div className="h-4 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleSend}
            disabled={isPending || eligibleCount === 0}
            size="sm"
            className="bg-amber text-amber-foreground hover:bg-amber/90 h-8 text-[12px] font-semibold rounded-lg gap-1.5"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send Now
            {eligibleCount > 0 && (
              <span className="ml-0.5 font-mono tabular-nums opacity-70">
                ({eligibleCount})
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 p-3 space-y-2">
          <p className="font-medium">Manually send emails right now</p>
          <p>
            Immediately sends the next email in each eligible lead&apos;s
            sequence. The count ({eligibleCount}) is how many leads are ready
            {" \u2014 "}past their wait-day cooldown and within today&apos;s
            inbox sending limit.
          </p>
          {autoSendEnabled ? (
            <p className="text-muted-foreground border-t border-white/10 pt-2">
              Auto-send is on, so this also happens automatically every hour
              during business hours. Use this button to send between cycles.
            </p>
          ) : (
            <p className="text-muted-foreground border-t border-white/10 pt-2">
              Auto-send is off, so this is the only way emails get sent. Turn on
              auto-send for automatic hourly sending during business hours.
            </p>
          )}
        </TooltipContent>
      </Tooltip>

      {lastResult && lastResult.sent > 0 && (
        <span className="text-[12px] text-emerald-600 font-medium">
          {lastResult.sent} sent
          {lastResult.errors > 0 && (
            <span className="text-red-500 ml-1.5">
              {lastResult.errors} failed
            </span>
          )}
        </span>
      )}
    </div>
  );
}
