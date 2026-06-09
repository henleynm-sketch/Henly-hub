import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import DemoRoleSwitcher from "@/components/DemoRoleSwitcher";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { GlassTopbar } from "@/components/ui/GlassTopbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = session.user.role as Role;

  return (
    <div className="flex min-h-screen bg-canvas text-white">
      <Sidebar
        role={role}
        userName={session.user.name ?? "User"}
        userEmail={session.user.email ?? ""}
        focusArea={session.user.focusArea}
        signOutSlot={<SignOutButton />}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <GlassTopbar>
          <div className="text-sm text-slate-400">
            <span className="font-semibold text-white">{ROLE_LABELS[role]}</span>
            {session.user.focusArea && <span className="ml-2 border-l border-white/10 pl-2">· {session.user.focusArea}</span>}
          </div>
          <div className="text-xs text-slate-500 font-mono">Henley Hub · v0.1</div>
        </GlassTopbar>
        <main className="flex-1 overflow-y-auto bg-canvas/40">{children}</main>
      </div>
      {process.env.NODE_ENV !== "production" && (
        <DemoRoleSwitcher currentEmail={session.user.email} />
      )}
    </div>
  );
}
