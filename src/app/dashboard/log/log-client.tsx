"use client";

import { useState, useMemo, Fragment } from "react";
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
import { Search, ArrowUpDown, ChevronRight, Mail, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SendLogEntry } from "@/lib/types";

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
}

export default function LogClient({ logs }: LogClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const toggleExpand = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const filteredLogs = useMemo(() => {
    setPage(0);
    const now = new Date();

    let result = logs;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (log) =>
          (log.first_name ?? "").toLowerCase().includes(q) ||
          (log.last_name ?? "").toLowerCase().includes(q) ||
          log.email.toLowerCase().includes(q) ||
          (log.company ?? "").toLowerCase().includes(q) ||
          (log.email_subject ?? "").toLowerCase().includes(q)
      );
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
  }, [logs, search, statusFilter, timeRange, sortAsc]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold font-heading tracking-[-0.02em]">
          Log
        </h1>
        <p className="text-[14px] text-muted-foreground mt-1">
          Archival send history across all leads
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts or subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-[13px] rounded-lg"
          />
        </div>
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

      <Card className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="w-8 pl-3 pr-0" />
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-muted-foreground">
                  Contact
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-muted-foreground">
                  Company
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
              {paginatedLogs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                const hasContent = log.email_subject || log.email_body;

                return (
                  <Fragment key={log.id}>
                    <TableRow
                      onClick={() => hasContent && toggleExpand(log.id)}
                      className={cn(
                        "transition-colors",
                        hasContent && "cursor-pointer hover:bg-muted/40",
                        !hasContent && "hover:bg-muted/40",
                        isExpanded && "border-b-0 bg-muted/10"
                      )}
                    >
                      <TableCell className="py-2.5 pl-3 pr-0">
                        {hasContent && (
                          <div className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground">
                            <ChevronRight className={cn(
                              "h-3.5 w-3.5 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                              isExpanded && "rotate-90"
                            )} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 max-w-[200px]">
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-semibold truncate" title={`${log.first_name ?? ""} ${log.last_name ?? ""}`.trim()}>
                              {log.first_name} {log.last_name}
                            </p>
                            {log.lead_deleted && (
                              <span title="Lead deleted">
                                <Trash2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-muted-foreground truncate" title={log.email}>
                            {log.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 max-w-[140px]">
                        <span className="text-[13px] truncate block" title={log.company || ""}>{log.company || "--"}</span>
                      </TableCell>
                      <TableCell className="py-2.5 max-w-[160px]">
                        <span className="text-[12px] text-muted-foreground font-mono truncate block" title={log.sender_email}>
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
                            timeZoneName: "short",
                          })}
                        </span>
                      </TableCell>
                    </TableRow>

                    {/* ── Expanded email content (animated) ── */}
                    {hasContent && (
                      <TableRow className="border-b-0 hover:bg-transparent">
                        <TableCell colSpan={8} className="p-0">
                          <div
                            className="grid"
                            style={{
                              gridTemplateRows: isExpanded ? '1fr' : '0fr',
                              transition: 'grid-template-rows 280ms cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                          >
                            <div className="overflow-hidden">
                              <div
                                className="px-8 py-4 pb-5 border-b border-border bg-muted/10"
                                style={{
                                  opacity: isExpanded ? 1 : 0,
                                  transition: isExpanded
                                    ? 'opacity 220ms cubic-bezier(0.16, 1, 0.3, 1) 60ms'
                                    : 'opacity 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                                }}
                              >
                                <div className="flex items-center gap-2 mb-3">
                                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                    Email {log.email_number} Content
                                  </span>
                                  {log.lead_deleted && (
                                    <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 bg-muted text-muted-foreground">
                                      Lead deleted
                                    </Badge>
                                  )}
                                </div>

                                {log.email_subject && (
                                  <div
                                    className="mb-3"
                                    style={{
                                      opacity: isExpanded ? 1 : 0,
                                      transform: isExpanded ? 'translateY(0)' : 'translateY(4px)',
                                      transition: isExpanded
                                        ? 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1) 80ms, transform 200ms cubic-bezier(0.16, 1, 0.3, 1) 80ms'
                                        : 'opacity 100ms, transform 100ms',
                                    }}
                                  >
                                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                      Subject
                                    </span>
                                    <p className="text-[13px] font-medium mt-1">
                                      {log.email_subject}
                                    </p>
                                  </div>
                                )}

                                {log.email_body && (
                                  <div
                                    style={{
                                      opacity: isExpanded ? 1 : 0,
                                      transform: isExpanded ? 'translateY(0)' : 'translateY(4px)',
                                      transition: isExpanded
                                        ? 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1) 140ms, transform 200ms cubic-bezier(0.16, 1, 0.3, 1) 140ms'
                                        : 'opacity 100ms, transform 100ms',
                                    }}
                                  >
                                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                      Body
                                    </span>
                                    <div className="mt-1 rounded-lg bg-muted/30 border border-border/50 px-4 py-3 max-h-[300px] overflow-y-auto">
                                      <p className="text-[12px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                        {log.email_body}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {paginatedLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <p className="text-[14px] text-muted-foreground animate-fade-in">
                      No send logs found
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
              {page * pageSize + 1}--{Math.min((page + 1) * pageSize, filteredLogs.length)} of {filteredLogs.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="h-7 px-2.5 text-[12px] rounded-lg"
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 px-2.5 text-[12px] rounded-lg"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
