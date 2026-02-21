"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SendLogEntry, Campaign } from "@/lib/types";

const statusStyles: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-100",
  failed: "bg-red-50 text-red-700 border-red-100",
  bounced: "bg-orange-50 text-orange-700 border-orange-100",
};

const statusLabels: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  bounced: "Bounced",
};

type TimeRange = "all" | "today" | "7d" | "30d";

interface LogClientProps {
  logs: SendLogEntry[];
  campaigns: Campaign[];
}

export default function LogClient({ logs, campaigns }: LogClientProps) {
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [sortAsc, setSortAsc] = useState(false);

  const filteredLogs = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    let result = logs;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (log) =>
          (log.first_name ?? "").toLowerCase().includes(q) ||
          (log.last_name ?? "").toLowerCase().includes(q) ||
          log.email.toLowerCase().includes(q) ||
          (log.company ?? "").toLowerCase().includes(q)
      );
    }

    // Campaign filter
    if (campaignFilter !== "all") {
      result = result.filter((log) => log.campaign_id === campaignFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((log) => log.status === statusFilter);
    }

    // Time range filter
    if (timeRange !== "all") {
      const cutoff = new Date(now);
      if (timeRange === "today") {
        cutoff.setHours(0, 0, 0, 0);
      } else if (timeRange === "7d") {
        cutoff.setDate(cutoff.getDate() - 7);
      } else if (timeRange === "30d") {
        cutoff.setDate(cutoff.getDate() - 30);
      }
      result = result.filter((log) => new Date(log.sent_at) >= cutoff);
    }

    // Sort
    if (sortAsc) {
      result = [...result].reverse();
    }

    return result;
  }, [logs, search, campaignFilter, statusFilter, timeRange, sortAsc]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold font-heading tracking-[-0.02em]">
          Log
        </h1>
        <p className="text-[14px] text-muted-foreground mt-1">
          Send history across all campaigns
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-[13px] rounded-lg"
          />
        </div>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="h-9 w-44 sm:w-52 text-[13px] rounded-lg">
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-32 text-[13px] rounded-lg">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="h-9 w-36 text-[13px] rounded-lg">
            <SelectValue placeholder="All time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortAsc(!sortAsc)}
          className="h-9 text-[12px] rounded-lg font-medium gap-1.5"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortAsc ? "Oldest first" : "Latest first"}
        </Button>
        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
          {filteredLogs.length} result{filteredLogs.length !== 1 ? "s" : ""}
        </span>
      </div>

      <Card className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-muted-foreground">
                  Contact
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-muted-foreground">
                  Company
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-muted-foreground">
                  Campaign
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-muted-foreground">
                  Sender
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-muted-foreground">
                  Email #
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-right text-muted-foreground pr-5">
                  Sent At
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow
                  key={log.id}
                  className="hover:bg-muted/40 transition-colors"
                >
                  <TableCell className="py-2.5">
                    <div>
                      <p className="text-[13px] font-semibold">
                        {log.first_name} {log.last_name}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {log.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-[13px]">{log.company || "--"}</span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-[13px]">{log.campaign_name}</span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-[12px] text-muted-foreground font-mono">
                      {log.sender_email}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-[13px] font-mono tabular-nums">
                      Email #{log.email_number}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] font-medium",
                        statusStyles[log.status] || ""
                      )}
                    >
                      {statusLabels[log.status] || log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5 text-right pr-5">
                    <span className="text-[12px] text-muted-foreground tabular-nums font-mono">
                      {new Date(log.sent_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <p className="text-[14px] text-muted-foreground">
                      No send logs found
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
