import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import { ROLE_LABELS, type Role } from "@/lib/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = session.user.role as Role;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={role}
        userName={session.user.name ?? "User"}
        userEmail={session.user.email ?? ""}
        focusArea={session.user.focusArea}
        signOutSlot={<SignOutButton />}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{ROLE_LABELS[role]}</span>
            {session.user.focusArea && <span className="ml-2">· {session.user.focusArea}</span>}
          </div>
          <div className="text-xs text-slate-500">Henley Hub · v0.1</div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
