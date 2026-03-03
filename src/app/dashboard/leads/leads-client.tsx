"use client";

import { useState, useMemo, useTransition, useCallback, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Plus, Upload, Search, Loader2, Send, ArrowUp, ArrowDown, ChevronRight, Clock, Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { deleteLeads } from "@/lib/actions/leads";
import { sendSingleLead } from "@/lib/actions/sending";
import { toast } from "sonner";
import { LeadEditDialog } from "@/components/leads/lead-edit-dialog";
import { BulkEditDialog } from "@/components/leads/bulk-edit-dialog";
import { BulkActionBar } from "@/components/leads/bulk-action-bar";
import { useSearchParams, useRouter } from "next/navigation";
import type { Lead } from "@/lib/types";

type SortKey = "contact" | "company" | "status" | "started" | "next_send" | null;
type SortDir = "asc" | "desc";

const statusLabels: Record<string, string> = {
  pending: "Pending",
  email_1_sent: "Sent Email 1",
  email_2_sent: "Sent Email 2",
  email_3_sent: "Sent Email 3",
  email_4_sent: "Sent Email 4",
  email_5_sent: "Sent Email 5",
  completed: "Done",
  failed: "Failed",
};

const statusStyles: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  email_1_sent: "bg-blue-50 text-blue-700 border-blue-100",
  email_2_sent: "bg-blue-50 text-blue-700 border-blue-100",
  email_3_sent: "bg-blue-50 text-blue-700 border-blue-100",
  email_4_sent: "bg-blue-50 text-blue-700 border-blue-100",
  email_5_sent: "bg-blue-50 text-blue-700 border-blue-100",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  failed: "bg-red-50 text-red-700 border-red-100",
};

// ── Email sequence helpers ──────────────────────────────

interface EmailStep {
  num: number;
  subject: string | null;
  body: string | null;
  waitAfter: number | null;
}

function getEmailSteps(lead: Lead): EmailStep[] {
  const all: EmailStep[] = [
    { num: 1, subject: lead.email_1_subject, body: lead.email_1_body, waitAfter: lead.wait_after_email_1 },
    { num: 2, subject: lead.email_2_subject, body: lead.email_2_body, waitAfter: lead.wait_after_email_2 },
    { num: 3, subject: lead.email_3_subject, body: lead.email_3_body, waitAfter: lead.wait_after_email_3 },
    { num: 4, subject: lead.email_4_subject, body: lead.email_4_body, waitAfter: lead.wait_after_email_4 },
    { num: 5, subject: lead.email_5_subject, body: lead.email_5_body, waitAfter: null },
  ];

  const steps: EmailStep[] = [];
  for (const step of all) {
    if (!step.subject && !step.body) break;
    steps.push(step);
  }
  return steps;
}

function getSentCount(status: string): number {
  const map: Record<string, number> = {
    pending: 0,
    email_1_sent: 1,
    email_2_sent: 2,
    email_3_sent: 3,
    email_4_sent: 4,
    email_5_sent: 5,
    completed: 999,
  };
  return map[status] ?? 0;
}

function getStepStatus(
  emailNum: number,
  leadStatus: string
): "sent" | "next" | "queued" | "failed" {
  if (leadStatus === "failed") return "failed";

  const sentCount = getSentCount(leadStatus);

  if (leadStatus === "completed") return "sent";
  if (emailNum <= sentCount) return "sent";
  if (emailNum === sentCount + 1) return "next";
  return "queued";
}

const stepStatusConfig = {
  sent: { label: "Sent", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  next: { label: "Next", className: "bg-amber/10 text-amber border-amber/20" },
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 border-red-100" },
};

// ── Email body display ──────────────────────────────────

function EmailBodyPreview({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = body.length > 200;

  return (
    <div>
      <p
        className={cn(
          "text-[12px] text-muted-foreground whitespace-pre-wrap",
          !expanded && isLong && "line-clamp-3"
        )}
      >
        {body}
      </p>
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-[11px] text-amber font-medium mt-1 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────

interface LeadsClientProps {
  leads: Lead[];
  autoSendEnabled: boolean;
}

export default function LeadsClient({ leads, autoSendEnabled }: LeadsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [sendingLeads, setSendingLeads] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const tableCardRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const qs = params.toString();
    router.replace(`/dashboard/leads${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [search, statusFilter, router]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selected.size === 0) return;
      const target = e.target as Node;
      if (tableCardRef.current?.contains(target)) return;
      if (actionBarRef.current?.contains(target)) return;
      setSelected(new Set());
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected]);

  const toggleExpand = useCallback((leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const filteredLeads = useMemo(() => {
    setPage(0);
    setSelected(new Set());
    setLastClickedIndex(null);
    const filtered = leads.filter((lead) => {
      const matchesSearch =
        search === "" ||
        (lead.first_name + " " + lead.last_name + " " + lead.email + " " + lead.company)
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || lead.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (!sortKey) return filtered;

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "contact":
          cmp = ((a.first_name ?? "") + (a.last_name ?? "")).localeCompare((b.first_name ?? "") + (b.last_name ?? ""));
          break;
        case "company":
          cmp = (a.company ?? "").localeCompare(b.company ?? "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "started":
          cmp = (a.contacted_at ?? "").localeCompare(b.contacted_at ?? "");
          break;
        case "next_send":
          cmp = (a.next_send_date ?? "").localeCompare(b.next_send_date ?? "");
          break;
      }
      return cmp * dir;
    });
  }, [leads, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize);
  const paginatedLeads = filteredLeads.slice(page * pageSize, (page + 1) * pageSize);

  const handleSelectionClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      const id = filteredLeads[index].id;

      if (e.shiftKey && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        setSelected((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) {
            next.add(filteredLeads[i].id);
          }
          return next;
        });
      } else if (e.metaKey || e.ctrlKey) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      } else {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      }

      setLastClickedIndex(index);
    },
    [filteredLeads, lastClickedIndex]
  );

  const handleRowClick = useCallback(
    (lead: Lead, index: number, e: React.MouseEvent) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        handleSelectionClick(index, e);
        return;
      }
      setEditingLead(lead);
    },
    [handleSelectionClick]
  );

  const toggleAll = () => {
    if (selected.size === filteredLeads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const handleDelete = () => {
    const count = selected.size;
    startTransition(async () => {
      await deleteLeads(Array.from(selected));
      setSelected(new Set());
      toast.success(`${count} lead${count === 1 ? "" : "s"} deleted`);
    });
  };

  const isSendable = (lead: Lead) =>
    lead.sender_inbox_id &&
    !lead.response_received &&
    lead.status !== "completed" &&
    lead.status !== "failed";

  const handleSend = async (leadId: string) => {
    setSendingLeads((prev) => new Set(prev).add(leadId));
    try {
      const result = await sendSingleLead(leadId);
      if (result.success) {
        toast.success("Email sent");
      } else {
        toast.error(result.error || "Failed to send");
      }
    } catch {
      toast.error("Failed to send");
    } finally {
      setSendingLeads((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-[-0.02em]">
            Leads
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            {leads.length} total leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="h-9 text-[13px] rounded-lg font-medium">
            <Link href="/dashboard/leads/import">
              <Upload className="h-4 w-4 mr-1.5" />
              Import CSV
            </Link>
          </Button>
          <Button
            asChild
            className="bg-amber text-white shadow-[0_1px_4px_-2px_rgba(0,0,0,0.025),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none h-9 text-[13px] font-semibold"
          >
            <Link href="/dashboard/leads/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Lead
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-[13px] rounded-lg"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-[13px] rounded-lg">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="email_1_sent">Email 1 Sent</SelectItem>
            <SelectItem value="email_2_sent">Email 2 Sent</SelectItem>
            <SelectItem value="email_3_sent">Email 3 Sent</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
          {filteredLeads.length} result{filteredLeads.length !== 1 ? "s" : ""}
        </span>
      </div>

      <Card ref={tableCardRef} className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="w-8 pl-3 pr-0" />
              <TableHead className="w-10 pl-1 pr-0">
                <Checkbox
                  aria-label="Select all leads"
                  checked={
                    filteredLeads.length > 0 && selected.size === filteredLeads.length
                      ? true
                      : selected.size > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              {([
                { key: "contact" as SortKey, label: "Contact" },
                { key: "company" as SortKey, label: "Company" },
                { key: null, label: "Sender" },
                { key: "status" as SortKey, label: "Status" },
                { key: "started" as SortKey, label: "Started" },
              ] as const).map(({ key, label }) => (
                <TableHead
                  key={label}
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider h-10 text-muted-foreground",
                    key && "cursor-pointer select-none hover:text-foreground transition-colors"
                  )}
                  onClick={key ? () => toggleSort(key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {key && sortKey === key && (
                      sortDir === "asc"
                        ? <ArrowUp className="h-3 w-3" />
                        : <ArrowDown className="h-3 w-3" />
                    )}
                  </span>
                </TableHead>
              ))}
              <TableHead
                className="text-[11px] font-semibold uppercase tracking-wider h-10 text-right text-muted-foreground pr-5 cursor-pointer select-none hover:text-foreground transition-colors"
                onClick={() => toggleSort("next_send")}
              >
                <span className="inline-flex items-center gap-1 justify-end">
                  Next Send
                  {sortKey === "next_send" && (
                    sortDir === "asc"
                      ? <ArrowUp className="h-3 w-3" />
                      : <ArrowDown className="h-3 w-3" />
                  )}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLeads.map((lead, index) => {
              const isExpanded = expandedLeads.has(lead.id);
              const steps = getEmailSteps(lead);
              const hasSteps = steps.length > 0;

              return (
                <Fragment key={lead.id}>
                  <TableRow
                    onClick={(e) => handleRowClick(lead, page * pageSize + index, e)}
                    className={cn(
                      "hover:bg-muted/40 transition-colors cursor-pointer",
                      selected.has(lead.id) && "bg-amber/5",
                      isExpanded && "border-b-0"
                    )}
                  >
                    <TableCell className="py-2.5 pl-3 pr-0">
                      {hasSteps && (
                        <button
                          aria-label={isExpanded ? "Collapse email sequence" : "Expand email sequence"}
                          onClick={(e) => toggleExpand(lead.id, e)}
                          className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronRight className={cn(
                            "h-3.5 w-3.5 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                            isExpanded && "rotate-90"
                          )} />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 pl-1 pr-0">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectionClick(page * pageSize + index, e);
                        }}
                      >
                        <Checkbox
                          checked={selected.has(lead.id)}
                          tabIndex={-1}
                          className="pointer-events-none"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 max-w-[200px]">
                      <div className="truncate">
                        <p className="text-[13px] font-semibold truncate" title={`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()}>
                          {lead.first_name} {lead.last_name}
                        </p>
                        <p className="text-[12px] text-muted-foreground truncate" title={lead.email}>
                          {lead.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 max-w-[160px]">
                      <div className="truncate">
                        <p className="text-[13px] truncate" title={lead.company ?? ""}>{lead.company}</p>
                        <p className="text-[11px] text-muted-foreground truncate" title={lead.title ?? ""}>
                          {lead.title}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 max-w-[160px]">
                      <span className="text-[12px] text-muted-foreground font-mono truncate block" title={lead.status !== "pending" ? lead.sender_email : ""}>
                        {lead.status !== "pending" ? lead.sender_email || "--" : "--"}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn("text-[11px] font-medium", statusStyles[lead.status] || "")}
                        >
                          {statusLabels[lead.status] || lead.status}
                        </Badge>
                        {lead.response_received && (
                          <Badge className="bg-amber/15 text-amber-foreground border-amber/20 text-[11px]">
                            Replied
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-[12px] text-muted-foreground tabular-nums font-mono">
                        {lead.contacted_at
                          ? new Date(lead.contacted_at).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )
                          : "--"}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-right pr-5">
                      <div className="flex items-center justify-end gap-2">
                        {isSendable(lead) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                aria-label={`Send email to ${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSend(lead.id);
                                }}
                                disabled={sendingLeads.has(lead.id)}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-amber/10 text-muted-foreground hover:text-amber transition-colors disabled:opacity-50"
                              >
                                {sendingLeads.has(lead.id) ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Send Now</TooltipContent>
                          </Tooltip>
                        )}
                        <span className="text-[12px] tabular-nums font-mono">
                          {lead.next_send_date ? (() => {
                            if (!autoSendEnabled) {
                              return (
                                <span className="text-amber font-medium">Ready</span>
                              );
                            }
                            const d = new Date(lead.next_send_date);
                            const today = new Date();
                            const isToday =
                              d.getFullYear() === today.getFullYear() &&
                              d.getMonth() === today.getMonth() &&
                              d.getDate() === today.getDate();
                            return isToday ? (
                              <span className="text-amber font-medium">Today</span>
                            ) : (
                              <span className="text-muted-foreground">
                                {d.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            );
                          })() : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* ── Expanded email sequence (animated) ── */}
                  {hasSteps && (
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableCell colSpan={9} className="p-0">
                        <div
                          className="grid"
                          style={{
                            gridTemplateRows: isExpanded ? '1fr' : '0fr',
                            transition: 'grid-template-rows 280ms cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          <div className="overflow-hidden">
                            <div
                              className="px-8 py-4 pb-5 bg-muted/15 border-b border-border"
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
                                  Email Sequence ({steps.length} email{steps.length !== 1 ? "s" : ""})
                                </span>
                              </div>

                              <div className="space-y-0">
                                {steps.map((step, i) => {
                                  const stepStatus = getStepStatus(step.num, lead.status);
                                  const config = stepStatusConfig[stepStatus];
                                  const borderColor =
                                    stepStatus === "sent"
                                      ? "border-emerald-400/60"
                                      : stepStatus === "next"
                                        ? "border-amber/50"
                                        : stepStatus === "failed"
                                          ? "border-red-300/60"
                                          : "border-border";

                                  return (
                                    <div
                                      key={step.num}
                                      style={{
                                        opacity: isExpanded ? 1 : 0,
                                        transform: isExpanded ? 'translateY(0)' : 'translateY(4px)',
                                        transition: isExpanded
                                          ? `opacity 200ms cubic-bezier(0.16, 1, 0.3, 1) ${80 + i * 60}ms, transform 200ms cubic-bezier(0.16, 1, 0.3, 1) ${80 + i * 60}ms`
                                          : 'opacity 100ms, transform 100ms',
                                      }}
                                    >
                                      {/* Wait time connector between emails */}
                                      {i > 0 && steps[i - 1].waitAfter != null && (
                                        <div className="flex items-center gap-2 ml-[7px] py-0.5">
                                          <div className="w-px h-5 bg-border" />
                                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                              {steps[i - 1].waitAfter} day{steps[i - 1].waitAfter !== 1 ? "s" : ""}
                                            </span>
                                          </div>
                                        </div>
                                      )}

                                      {/* Email step */}
                                      <div
                                        className={cn(
                                          "border-l-2 pl-4 py-2.5",
                                          borderColor
                                        )}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                            Email {step.num}
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className={cn("text-[10px] font-medium px-1.5 py-0", config.className)}
                                          >
                                            {config.label}
                                          </Badge>
                                        </div>
                                        {step.subject && (
                                          <p className="text-[13px] font-medium mt-1.5">
                                            {step.subject}
                                          </p>
                                        )}
                                        {step.body && (
                                          <div className="mt-1">
                                            <EmailBodyPreview body={step.body} />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {paginatedLeads.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16">
                  <p className="text-[14px] text-muted-foreground animate-fade-in">
                    No leads found
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
              {page * pageSize + 1}--{Math.min((page + 1) * pageSize, filteredLeads.length)} of {filteredLeads.length}
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

      <LeadEditDialog
        lead={editingLead}
        open={editingLead !== null}
        onOpenChange={(open) => {
          if (!open) setEditingLead(null);
        }}
      />

      <BulkEditDialog
        leads={leads}
        selectedIds={selected}
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
      />

      <BulkActionBar
        ref={actionBarRef}
        count={selected.size}
        onEdit={() => setBulkEditOpen(true)}
        onDelete={handleDelete}
        onClear={() => setSelected(new Set())}
      />
    </div>
  );
}
