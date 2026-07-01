import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import DemoRoleSwitcher from "@/components/DemoRoleSwitcher";
import MobileNav from "@/components/MobileNav";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { GlassTopbar } from "@/components/ui/GlassTopbar";
import ThemeToggle from "@/components/ThemeToggle";
import { getBrandingConfig } from "@/lib/branding";

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

  const branding = await getBrandingConfig();

  return (
    <div className="relative flex h-screen overflow-hidden bg-transparent text-ink">
      <div className="hh-app-bg" aria-hidden="true" />
      <div className="hh-app-bg__forms" aria-hidden="true" />
      <div className="hh-brandmark" aria-hidden="true" />
      <div
        className="hh-app-bg__image"
        aria-hidden="true"
        data-bg-mode={branding.mode}
        data-bg-enabled={branding.backgroundEnabled ? "1" : "0"}
        style={{
          ["--hh-bg-image" as any]: `url('/branding/background?v=${branding.updatedAt.getTime()}')`,
          ["--hh-bg-scrim" as any]: (branding.scrim / 100).toString(),
        } as React.CSSProperties}
      />
      <Sidebar {...sidebarProps} className="relative z-10" />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
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
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>
      {process.env.NODE_ENV !== "production" && (
        <DemoRoleSwitcher currentEmail={session.user.email} />
      )}
    </div>
  );
}
