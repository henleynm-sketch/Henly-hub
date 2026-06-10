import { signOut } from "@/auth";

export default function SignOutButton() {
  async function action() {
    "use server";
    await signOut({ redirectTo: "/" });
  }
  return (
    <form action={action}>
      <button className="btn-ghost w-full justify-center text-xs">Sign out</button>
    </form>
  );
}
