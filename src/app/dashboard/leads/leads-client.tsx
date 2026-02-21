"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
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
import { Plus, Upload, Search, Loader2, Send, Minus } from "lucide-react";
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
import type { Lead, Campaign } from "@/lib/types";

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
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [sendingLeads, setSendingLeads] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const tableCardRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);

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
  }, [selected.size]);

  const filteredLeads = leads.filter((lead) => {
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
                Status
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-muted-foreground">
                Started
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-10 text-right text-muted-foreground pr-5">
                Next Send
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map((lead, index) => (
              <TableRow
                key={lead.id}
                onClick={(e) => handleRowClick(lead, index, e)}
                className={cn(
                  "hover:bg-muted/40 transition-colors cursor-pointer",
                  selected.has(lead.id) && "bg-amber/5"
                )}
              >
                <TableCell className="py-2.5 pl-4 pr-0">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectionClick(index, e);
                    }}
                  >
                    <Checkbox
                      checked={selected.has(lead.id)}
                      tabIndex={-1}
                      className="pointer-events-none"
                    />
                  </div>
                </TableCell>
                <TableCell className="py-2.5">
                  <div>
                    <p className="text-[13px] font-semibold">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {lead.email}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="py-2.5">
                  <div>
                    <p className="text-[13px]">{lead.company}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {lead.title}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="py-2.5">
                  <span className="text-[13px]">{lead.campaign_name}</span>
                </TableCell>
                <TableCell className="py-2.5">
                  <span className="text-[12px] text-muted-foreground font-mono">
                    {lead.sender_email || "Unassigned"}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSend(lead.id);
                            }}
                            disabled={sendingLeads.has(lead.id)}
                            className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-amber/10 text-muted-foreground hover:text-amber transition-colors disabled:opacity-50"
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
            {filteredLeads.length === 0 && (
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
