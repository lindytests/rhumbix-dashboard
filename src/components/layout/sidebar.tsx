"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Settings,
  Inbox,
  ScrollText,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/senders", label: "Senders", icon: Inbox },
  { href: "/dashboard/log", label: "Log", icon: ScrollText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted/80 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Image
          src="/rhumbix-logo.png"
          alt="Rhumbix"
          width={24}
          height={24}
          className="rounded-md"
        />
        <span className="text-base font-semibold text-foreground tracking-tight">
          Rhumbix
        </span>
      </div>

      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/30 lg:hidden transition-opacity duration-200",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-60 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 pt-7 pb-6">
          <div className="flex items-center gap-2.5">
            <Image
              src="/rhumbix-logo.png"
              alt="Rhumbix"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="text-lg font-semibold text-foreground tracking-tight">
              Rhumbix
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted/80 transition-colors lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-2.5 text-[14px] tracking-[-0.02em] transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] border",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-sidebar-primary/15 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]"
                    : "border-transparent text-sidebar-foreground hover:bg-muted/80 hover:text-foreground font-medium"
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
