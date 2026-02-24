"use client";

import { useState, useMemo, useTransition, useCallback, useEffect, useRef } from "react";
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
import { Plus, Upload, Search, Loader2, Send, ArrowUp, ArrowDown } from "lucide-react";
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
import type { Lead, Campaign } from "@/lib/types";

type SortKey = "contact" | "company" | "campaign" | "status" | "started" | "next_send" | null;
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

interface LeadsClientProps {
  leads: Lead[];
  campaigns: Campaign[];
  autoSendEnabled: boolean;
}

export default function LeadsClient({ leads, campaigns, autoSendEnabled }: LeadsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [campaignFilter, setCampaignFilter] = useState<string>(searchParams.get("campaign") ?? "all");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [sendingLeads, setSendingLeads] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const tableCardRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (campaignFilter !== "all") params.set("campaign", campaignFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const qs = params.toString();
    router.replace(`/dashboard/leads${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [search, campaignFilter, statusFilter, router]);

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
      const matchesCampaign =
        campaignFilter === "all" || lead.campaign_id === campaignFilter;
      const matchesStatus =
        statusFilter === "all" || lead.status === statusFilter;
      return matchesSearch && matchesCampaign && matchesStatus;
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
        case "campaign":
          cmp = (a.campaign_name ?? "").localeCompare(b.campaign_name ?? "");
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
  }, [leads, search, campaignFilter, statusFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize);
  const paginatedLeads = filteredLeads.slice(page * pageSize, (page + 1) * pageSize);

  const handleSelectionClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      const id = filteredLeads[index].id;

      if (e.shiftKey && lastClickedIndex !== null) {
        // Shift+click: select range
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
        // Cmd/Ctrl+click: toggle individual, keep others
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      } else {
        // Plain click: toggle individual
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
      // If shift or cmd/ctrl is held, treat as selection
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        handleSelectionClick(index, e);
        return;
      }
      // Open edit dialog
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
            {leads.length} total leads across {campaigns.length} campaigns
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
            className="bg-amber text-white shadow-[0_1px_2px_0_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(255,255,255,0.15)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none h-9 text-[13px] font-semibold"
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
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="w-10 pl-4 pr-0">
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
                { key: "campaign" as SortKey, label: "Campaign" },
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
            {paginatedLeads.map((lead, index) => (
              <TableRow
                key={lead.id}
                onClick={(e) => handleRowClick(lead, page * pageSize + index, e)}
                className={cn(
                  "hover:bg-muted/40 transition-colors cursor-pointer",
                  selected.has(lead.id) && "bg-amber/5"
                )}
              >
                <TableCell className="py-2.5 pl-4 pr-0">
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
                  <span className="text-[13px] truncate block" title={lead.campaign_name}>{lead.campaign_name}</span>
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
            ))}
            {paginatedLeads.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16">
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
        campaigns={campaigns}
        open={editingLead !== null}
        onOpenChange={(open) => {
          if (!open) setEditingLead(null);
        }}
      />

      <BulkEditDialog
        leads={leads}
        selectedIds={selected}
        campaigns={campaigns}
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
