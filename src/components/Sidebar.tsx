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
  HardHat,
  Home,
  Upload,
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
    { href: "/estimates", label: "Estimates", icon: FileText },
    { href: "/contracts", label: "Contracts", icon: ClipboardList, badge: "soon" },
    { href: "/financials", label: "Financials", icon: DollarSign },
    { href: "/files", label: "Files", icon: Folder, badge: "soon" },
    { href: "/import", label: "Import data", icon: Upload },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  OFFICE: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/clients", label: "CRM", icon: Users },
    { href: "/projects", label: "Projects", icon: Briefcase },
    { href: "/estimates", label: "Estimates", icon: FileText },
    { href: "/contracts", label: "Contracts", icon: ClipboardList, badge: "soon" },
    { href: "/files", label: "Files", icon: Folder, badge: "soon" },
    { href: "/import", label: "Import data", icon: Upload },
  ],
  FIELD: [
    { href: "/dashboard", label: "Today", icon: LayoutDashboard },
    { href: "/projects", label: "My Jobs", icon: Hammer },
    { href: "/inbox", label: "Messages", icon: Inbox },
    { href: "/files", label: "Files", icon: Folder, badge: "soon" },
  ],
  SUB: [
    { href: "/dashboard", label: "Schedule", icon: LayoutDashboard },
    { href: "/projects", label: "My Scopes", icon: Wrench },
    { href: "/inbox", label: "Messages", icon: Inbox },
  ],
  CLIENT: [
    { href: "/dashboard", label: "My Project", icon: Home },
    { href: "/inbox", label: "Messages", icon: Inbox },
    { href: "/selections", label: "Selections", icon: ClipboardList, badge: "soon" },
    { href: "/files", label: "Documents", icon: Folder, badge: "soon" },
  ],
};

export default function Sidebar({
  role,
  userName,
  userEmail,
  focusArea,
  signOutSlot,
}: {
  role: Role;
  userName: string;
  userEmail: string;
  focusArea?: string | null;
  signOutSlot?: React.ReactNode;
}) {
  const items = navByRole[role] ?? navByRole.OFFICE;
  const pathname = usePathname();

  return (
    <GlassSidebar>
      <div className="flex h-14 items-center gap-2 border-b border-white/5 px-4">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-accent text-white shadow-[0_2px_8px_rgba(92,124,250,0.3)]">
          <span className="text-xs font-extrabold tracking-tight">H</span>
        </div>
        <div className="text-sm font-semibold tracking-tight text-white">Henley Hub</div>
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
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-150 border",
                    active
                      ? "bg-accent/20 border-accent/25 text-white font-semibold shadow-sm"
                      : "text-slate-400 border-transparent hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon size={16} className={active ? "text-accent" : "text-slate-400"} />
                  <span className="flex-1">{it.label}</span>
                  {it.badge && (
                    <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-400">
                      {it.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {(role === "CEO" || role === "OFFICE") && (
          <div className="mt-6">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Integrations
            </div>
            <ul className="mt-2 space-y-1">
              <li>
                <Link
                  href="/integrations/quickbooks"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-150 border",
                    pathname.startsWith("/integrations/quickbooks")
                      ? "bg-accent/20 border-accent/25 text-white font-semibold shadow-sm"
                      : "text-slate-400 border-transparent hover:bg-white/5 hover:text-white"
                  )}
                >
                  <HardHat size={16} className={pathname.startsWith("/integrations/quickbooks") ? "text-accent" : "text-slate-400"} />
                  QuickBooks
                  <span className="ml-auto badge-amber text-[9px] px-1.5 py-0">setup</span>
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-white/3 border border-white/5 p-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-white shadow-[0_2px_6px_rgba(92,124,250,0.25)]">
            {userName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{userName}</div>
            <div className="truncate text-xs text-slate-400">
              {focusArea ? `${focusArea} · ${userEmail}` : userEmail}
            </div>
          </div>
        </div>
        <div className="mt-2">{signOutSlot}</div>
      </div>
    </GlassSidebar>
  );
}
