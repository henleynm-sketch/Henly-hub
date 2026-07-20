"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  BookOpen,
  LayoutTemplate,
  HardHat,
  ListChecks,
  PlugZap,
  ChevronDown,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/roles";
import { GlassSidebar } from "@/components/ui/GlassSidebar";

type SubItem = { href: string; label: string; badge?: string };
type Item = { href: string; label: string; icon: React.ElementType; badge?: string; children?: SubItem[] };

// Henley's mini-JobTread — the Jobs area groups every JobTread-powered surface.
const JOBS_GROUP: Item = {
  href: "/jobs",
  label: "Jobs",
  icon: PlugZap,
  children: [
    { href: "/jobs", label: "Dashboard" },
    { href: "/jobs/list", label: "All Jobs" },
    { href: "/jobs/board", label: "Board" },
    { href: "/jobs/daily-logs", label: "Daily Logs" },
    { href: "/jobs/todos", label: "To-Dos" },
    { href: "/jobs/catalog", label: "Catalog" },
    { href: "/jobs/connection", label: "Connection & Sync" },
  ],
};

const navByRole: Record<Role, Item[]> = {
  CEO: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/crm", label: "CRM", icon: Hammer },
    { href: "/jobs/projects", label: "Projects", icon: Briefcase },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/estimates", label: "Estimates", icon: FileText },
    { href: "/contracts", label: "Contracts", icon: ClipboardList },
    { href: "/financials", label: "Financials", icon: DollarSign },
    { href: "/files", label: "Files", icon: Folder },
    { href: "/documents", label: "Documents", icon: BookOpen },
    { href: "/import", label: "Import data", icon: Upload },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/vendors",   label: "Vendors",   icon: HardHat },
    JOBS_GROUP,
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/settings/diagnostics", label: "Diagnostics", icon: Activity },
  ],
  OFFICE: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/crm", label: "CRM", icon: Hammer },
    { href: "/jobs/projects", label: "Projects", icon: Briefcase },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/estimates", label: "Estimates", icon: FileText },
    { href: "/contracts", label: "Contracts", icon: ClipboardList },
    { href: "/files", label: "Files", icon: Folder },
    { href: "/documents", label: "Documents", icon: BookOpen },
    { href: "/import", label: "Import data", icon: Upload },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/vendors",   label: "Vendors",   icon: HardHat },
    JOBS_GROUP,
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  FIELD: [
    { href: "/dashboard", label: "Today", icon: LayoutDashboard },
    { href: "/projects", label: "My Jobs", icon: Hammer },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
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

function NavLeaf({ item, pathname }: { item: Item; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <li>
      <Link href={item.href} className={cn("hh-nav-item", active && "active")}>
        <span className="hh-nav-ic">
          <Icon size={17} />
        </span>
        <span className="flex-1">{item.label}</span>
        {item.badge && <span className="hh-nav-badge">{item.badge}</span>}
      </Link>
    </li>
  );
}

function NavGroup({ item, pathname }: { item: Item; pathname: string }) {
  const groupActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const [open, setOpen] = useState(groupActive);
  const Icon = item.icon;
  return (
    <li>
      <div className="flex items-center">
        <Link
          href={item.href}
          className={cn("hh-nav-item flex-1", groupActive && !open && "active")}
        >
          <span className="hh-nav-ic">
            <Icon size={17} />
          </span>
          <span className="flex-1">{item.label}</span>
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          className="hh-nav-item !w-auto px-2"
          aria-label={open ? "Collapse Jobs menu" : "Expand Jobs menu"}
          aria-expanded={open}
        >
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <ul className="mt-1 space-y-0.5 pl-8">
          {item.children!.map((c) => {
            const active =
              c.href === item.href ? pathname === c.href : pathname === c.href || pathname.startsWith(c.href + "/");
            return (
              <li key={c.href}>
                <Link href={c.href} className={cn("hh-nav-item text-[13px] py-1.5", active && "active")}>
                  <span className="flex-1">{c.label}</span>
                  {c.badge && <span className="hh-nav-badge">{c.badge}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function Sidebar({
  role,
  userName,
  userEmail,
  focusArea,
  signOutSlot,
  className,
  logoDataUrl,
}: {
  role: Role;
  userName: string;
  userEmail: string;
  focusArea?: string | null;
  signOutSlot?: React.ReactNode;
  className?: string;
  logoDataUrl?: string | null;
}) {
  const items = navByRole[role] ?? navByRole.OFFICE;
  const pathname = usePathname();

  return (
    <GlassSidebar className={className}>
      {/* Brand header — real Henley Contracting logo, tinted per theme via CSS mask */}
      <div className="flex h-14 items-center border-b border-glass-border px-4">
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoDataUrl} alt="Company logo" className="h-9 max-w-full object-contain" />
        ) : (
          <div className="hh-brand-logo" role="img" aria-label="Henley Contracting" />
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map((it) =>
            it.children ? (
              <NavGroup key={it.href} item={it} pathname={pathname} />
            ) : (
              <NavLeaf key={it.href} item={it} pathname={pathname} />
            ),
          )}
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
            style={{ boxShadow: "var(--accent-glow)" }}
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
