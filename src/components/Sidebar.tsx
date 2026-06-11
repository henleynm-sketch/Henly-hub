"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Briefcase,
  FileText,
  ClipboardList,
  DollarSign,
  Folder,
  Settings,
  Wrench,
  Hammer,
  Home,
  Upload,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/roles";
import { GlassSidebar } from "@/components/ui/GlassSidebar";

type Item = { href: string; label: string; icon: React.ElementType; badge?: string };

const navByRole: Record<Role, Item[]> = {
  CEO: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/clients", label: "CRM", icon: Users },
    { href: "/projects", label: "Projects", icon: Briefcase },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/estimates", label: "Estimates", icon: FileText },
    { href: "/contracts", label: "Contracts", icon: ClipboardList },
    { href: "/financials", label: "Financials", icon: DollarSign },
    { href: "/files", label: "Files", icon: Folder },
    { href: "/import", label: "Import data", icon: Upload },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  OFFICE: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/clients", label: "CRM", icon: Users },
    { href: "/projects", label: "Projects", icon: Briefcase },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/estimates", label: "Estimates", icon: FileText },
    { href: "/contracts", label: "Contracts", icon: ClipboardList },
    { href: "/files", label: "Files", icon: Folder },
    { href: "/import", label: "Import data", icon: Upload },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  FIELD: [
    { href: "/dashboard", label: "Today", icon: LayoutDashboard },
    { href: "/projects", label: "My Jobs", icon: Hammer },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/inbox", label: "Messages", icon: Inbox },
    { href: "/files", label: "Files", icon: Folder },
  ],
  SUB: [
    { href: "/dashboard", label: "Schedule", icon: LayoutDashboard },
    { href: "/projects", label: "My Scopes", icon: Wrench },
    { href: "/inbox", label: "Messages", icon: Inbox },
    { href: "/files", label: "Files", icon: Folder },
  ],
  CLIENT: [
    { href: "/dashboard", label: "My Project", icon: Home },
    { href: "/inbox", label: "Messages", icon: Inbox },
    { href: "/selections", label: "Selections", icon: ClipboardList, badge: "soon" },
    { href: "/files", label: "Documents", icon: Folder },
  ],
};

export default function Sidebar({
  role,
  userName,
  userEmail,
  focusArea,
  signOutSlot,
  className,
}: {
  role: Role;
  userName: string;
  userEmail: string;
  focusArea?: string | null;
  signOutSlot?: React.ReactNode;
  className?: string;
}) {
  const items = navByRole[role] ?? navByRole.OFFICE;
  const pathname = usePathname();

  return (
    <GlassSidebar className={className}>
      {/* Brand logo header */}
      <div className="flex h-14 items-center gap-2.5 border-b border-glass-border px-4">
        <div
          className="grid h-7 w-7 place-items-center rounded-md bg-accent text-white"
          style={{ boxShadow: "0 2px 8px rgba(92,124,250,0.3)" }}
        >
          <span className="text-xs font-extrabold tracking-tight">H</span>
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-ink leading-none">Henley Hub</div>
          <div className="text-[9px] font-bold text-ink-muted uppercase tracking-widest mt-0.5">Contracting</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            const Icon = it.icon;
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-3 md:py-2 text-sm transition-all duration-200 border transform active:scale-98",
                    active
                      ? "bg-accent/10 border-accent/20 text-accent font-semibold"
                      : "text-ink-soft border-transparent hover:bg-row-hover hover:text-ink"
                  )}
                >
                  <Icon size={16} className={active ? "text-accent animate-pulse" : "text-ink-soft"} />
                  <span className="flex-1">{it.label}</span>
                  {it.badge && (
                    <span className="rounded-full bg-glass-bg border border-glass-border px-2 py-0.5 text-[9px] font-bold uppercase text-ink-soft">
                      {it.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

      </nav>

      {/* User profile section at bottom */}
      <div className="border-t border-glass-border p-3">
        <Link
          href="/profile"
          className="sidebar-usercard bg-glass-bg border border-glass-border shadow-sm"
          aria-label="Open your profile"
        >
          <div
            className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-white shrink-0"
            style={{ boxShadow: "0 2px 6px rgba(92,124,250,0.25)" }}
          >
            {userName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{userName}</div>
            <div className="truncate text-xs text-ink-soft">
              {focusArea ? `${focusArea} · ${userEmail}` : userEmail}
            </div>
          </div>
        </Link>
        <div className="mt-2">{signOutSlot}</div>
      </div>
    </GlassSidebar>
  );
}
