"use client";

import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  count: number;
  onEdit: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export const BulkActionBar = forwardRef<HTMLDivElement, BulkActionBarProps>(
  function BulkActionBar({ count, onEdit, onDelete, onClear }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-40",
          "flex items-center gap-3 px-4 py-2.5 rounded-full",
          "bg-foreground text-background shadow-2xl",
          "transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          count > 0
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-4 opacity-0 scale-95 pointer-events-none"
        )}
      >
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-[13px] font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          <X className="h-3.5 w-3.5" />
          <span className="tabular-nums">{count}</span> selected
        </button>

        <div className="w-px h-4 bg-background/20" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-7 px-3 text-[12px] font-medium text-background hover:bg-background/15 hover:text-background rounded-full gap-1.5"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 px-3 text-[12px] font-medium text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-full gap-1.5"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
      </div>
    );
  }
);
