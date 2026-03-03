export const dynamic = "force-dynamic";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getLeadStats,
  getInboxStats,
  getSendLogs,
  getAppSettings,
  getEligibleLeadCount,
} from "@/lib/db/queries";
import { SendControlStrip } from "@/components/send-control-strip";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LocalTime } from "@/components/local-time";

function getStatusColor(sent: number, limit: number) {
  const ratio = sent / limit;
  if (ratio >= 0.9) return "text-red-700";
  if (ratio >= 0.7) return "text-amber";
  return "text-emerald-600";
}

const logStatusStyles: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-100",
  failed: "bg-red-50 text-red-700 border-red-100",
  bounced: "bg-orange-50 text-orange-700 border-orange-100",
};

const logStatusLabels: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  bounced: "Bounced",
};

export default async function DashboardPage() {
  const [leadStats, inboxStats, recentLogs, settings, eligibleCount] =
    await Promise.all([
      getLeadStats(),
      getInboxStats(),
      getSendLogs(5),
      getAppSettings(),
      getEligibleLeadCount(),
    ]);

  const totalSentToday = inboxStats.reduce(
    (sum: number, i) => sum + i.sent_today,
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-[-0.02em]">
            Dashboard
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Outreach overview for today
          </p>
        </div>
        <SendControlStrip
          autoSendEnabled={settings.auto_send_enabled}
          eligibleCount={eligibleCount}
          testMode={settings.test_mode}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 stagger-children">
        {[
          { label: "Sent Today", value: totalSentToday },
          { label: "Pending", value: leadStats.pending },
          { label: "In Progress", value: leadStats.in_progress },
          { label: "Completed", value: leadStats.completed },
          { label: "Responded", value: leadStats.responded, highlight: true },
        ].map((stat) => (
          <Card key={stat.label} className="bg-card rounded-xl border border-border">
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p
                className={cn(
                  "mt-2 text-3xl font-semibold font-heading tracking-[-0.02em]",
                  stat.highlight ? "text-amber" : "text-foreground"
                )}
              >
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inbox capacity */}
        <Card className="bg-card rounded-xl border border-border">
          <CardContent className="p-6">
            <h2 className="text-[17px] font-semibold font-heading mb-4">
              Inbox Capacity
            </h2>
            <div className="space-y-5">
              {inboxStats.map((inbox) => (
                <div key={inbox.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium truncate">
                      {inbox.email}
                    </span>
                    <span
                      className={cn(
                        "text-[12px] font-semibold tabular-nums font-mono",
                        getStatusColor(inbox.sent_today, inbox.daily_limit)
                      )}
                    >
                      {inbox.sent_today}/{inbox.daily_limit}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber/80 transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          (inbox.sent_today / inbox.daily_limit) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span className="font-mono tabular-nums">
                      This hour: {inbox.sent_this_hour}/{inbox.hourly_limit}
                    </span>
                    <span>{inbox.is_active ? "Active" : "Paused"}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="bg-card rounded-xl border border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-semibold font-heading">
                Recent Activity
              </h2>
              <Link
                href="/dashboard/log"
                className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div>
              {recentLogs.length === 0 && (
                <p className="text-[14px] text-muted-foreground text-center py-8 animate-fade-in">
                  No send activity yet
                </p>
              )}
              {recentLogs.map((log, index) => (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-center justify-between py-3.5",
                    index < recentLogs.length - 1 && "border-b border-border"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[12px] font-medium text-muted-foreground">
                      {log.first_name?.[0]}
                      {log.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-[14px] font-medium truncate max-w-[200px]" title={`${log.first_name ?? ""} ${log.last_name ?? ""}`.trim()}>
                        {log.first_name} {log.last_name}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5 truncate max-w-[300px]">
                        {log.company ? `${log.company} · ` : ""}Email #{log.email_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] font-medium",
                        logStatusStyles[log.status] || ""
                      )}
                    >
                      {logStatusLabels[log.status] || log.status}
                    </Badge>
                    <LocalTime
                      date={log.sent_at}
                      className="text-[12px] text-muted-foreground tabular-nums font-mono hidden sm:inline"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
