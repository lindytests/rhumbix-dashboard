"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-[15px] w-[15px] shrink-0 border border-border bg-background cursor-pointer",
      "transition-all duration-150",
      "hover:border-amber/60",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-amber data-[state=checked]:border-amber",
      "data-[state=indeterminate]:bg-amber data-[state=indeterminate]:border-amber",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      forceMount
      className="flex items-center justify-center text-white data-[state=unchecked]:animate-out data-[state=unchecked]:zoom-out-0 data-[state=unchecked]:fade-out-0 data-[state=checked]:animate-in data-[state=checked]:zoom-in-0 data-[state=checked]:fade-in-0 data-[state=indeterminate]:animate-in data-[state=indeterminate]:zoom-in-0 data-[state=indeterminate]:fade-in-0 duration-150 fill-mode-forwards"
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {props.checked === "indeterminate" ? (
          <path d="M2.5 6H9.5" />
        ) : (
          <path d="M2.5 6.5L5 9L9.5 3.5" />
        )}
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
