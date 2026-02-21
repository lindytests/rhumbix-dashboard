"use client"

import { cn } from "@/lib/utils"

function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  activeClass = "bg-amber",
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  activeClass?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? activeClass : "bg-muted-foreground/25",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-[18px] rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200",
          checked ? "translate-x-[20px]" : "translate-x-[2px]"
        )}
      />
    </button>
  )
}

export { Switch }
