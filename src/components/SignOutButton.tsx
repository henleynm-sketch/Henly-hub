import { signOut } from "@/auth";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  async function action() {
    "use server";
    await signOut({ redirectTo: "/" });
  }
  return (
    <form action={action}>
      <button className="sidebar-signout" type="submit">
        <LogOut size={14} />
        Sign out
      </button>
    </form>
  );
}
