import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import AssistantMount from "@/components/assistant/AssistantMount";
import MobileNav from "@/components/MobileNav";
import DiagnosticsBoundary from "@/components/DiagnosticsBoundary";
import { ROLE_LABELS, isPending, type Role } from "@/lib/roles";
import { GlassTopbar } from "@/components/ui/GlassTopbar";
import ThemeToggle from "@/components/ThemeToggle";
import { getBrandingConfig } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { isUiTheme, DEFAULT_UI_THEME } from "@/lib/uiTheme";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = session.user.role as Role;
  // Server-authoritative backstop: a PENDING (no-role) account never renders the
  // app shell, even if middleware is bypassed.
  if (isPending(role)) redirect("/pending");
  let logoDataUrl: string | null = null;
  try {
    const [logoData, logoMime] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "org.logoData" } }),
      prisma.setting.findUnique({ where: { key: "org.logoMime" } }),
    ]);
    if (logoData?.value && logoMime?.value) {
      logoDataUrl = `data:${logoMime.value};base64,${logoData.value}`;
    }
  } catch {
    // Setting table unavailable — masked default logo stands.
  }

  const sidebarProps = {
    role,
    userName: session.user.name ?? "User",
    userEmail: session.user.email ?? "",
    focusArea: session.user.focusArea,
    signOutSlot: <SignOutButton />,
    logoDataUrl
  };

  const branding = await getBrandingConfig();


  let uiTheme: string = DEFAULT_UI_THEME;
  try {
    const pref = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { uiTheme: true },
    });
    if (pref && isUiTheme(pref.uiTheme)) uiTheme = pref.uiTheme;
  } catch {
    // uiTheme column may not be migrated yet; fall back to default.
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-transparent text-ink" data-ui={uiTheme}>
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
        <main className="flex-1 min-h-0 overflow-y-auto">
          <DiagnosticsBoundary>{children}</DiagnosticsBoundary>
        </main>
      </div>
      <AssistantMount />
    </div>
  );
}
