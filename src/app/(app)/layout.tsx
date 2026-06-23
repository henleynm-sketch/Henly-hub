import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import DemoRoleSwitcher from "@/components/DemoRoleSwitcher";
import MobileNav from "@/components/MobileNav";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { GlassTopbar } from "@/components/ui/GlassTopbar";
import ThemeToggle from "@/components/ThemeToggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = session.user.role as Role;
  const sidebarProps = {
    role,
    userName: session.user.name ?? "User",
    userEmail: session.user.email ?? "",
    focusArea: session.user.focusArea,
    signOutSlot: <SignOutButton />,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-ink">
      <Sidebar {...sidebarProps} />
      <div className="flex min-w-0 flex-1 flex-col">
        <GlassTopbar className="px-3 md:px-6">
          <div className="flex items-center gap-1 min-w-0">
            <MobileNav>
              <Sidebar {...sidebarProps} className="flex w-72 h-full" />
            </MobileNav>
            <div className="text-sm text-ink-soft truncate">
              <span className="font-semibold text-ink">{ROLE_LABELS[role]}</span>
              {session.user.focusArea && (
                <span className="ml-2 border-l border-glass-border pl-2 hidden sm:inline">
                  · {session.user.focusArea}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">Henley Hub · v0.1</span>
            <ThemeToggle />
          </div>
        </GlassTopbar>
        <main className="flex-1 min-h-0 overflow-y-auto bg-canvas/40">{children}</main>
      </div>
      {process.env.NODE_ENV !== "production" && (
        <DemoRoleSwitcher currentEmail={session.user.email} />
      )}
    </div>
  );
}
