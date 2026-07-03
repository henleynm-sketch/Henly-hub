import Link from "next/link";
import { redirect } from "next/navigation";
import { resetPassword } from "@/lib/actions/auth";

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  async function submit(formData: FormData) {
    "use server";
    formData.set("token", token);
    const r = await resetPassword(formData);
    if (!r.ok) redirect(`/reset/${token}?error=${encodeURIComponent(r.error ?? "failed")}`);
    redirect("/sign-in?notice=reset-done");
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="hh-panel w-full max-w-sm p-7 flex flex-col gap-4">
        <h1 className="hh-display text-lg font-bold text-ink">Choose a new password</h1>
        {sp.error && (
          <div className="flex items-start gap-2">
            <span className="hh-dot hh-dot--red mt-1" />
            <span className="hh-secondary">{sp.error}</span>
          </div>
        )}
        <form action={submit} className="flex flex-col gap-3">
          <div>
            <label className="hh-label block mb-1.5">New password (min 10 characters)</label>
            <input name="password" type="password" className="input" autoComplete="new-password" required minLength={10} />
          </div>
          <div>
            <label className="hh-label block mb-1.5">Confirm</label>
            <input name="confirm" type="password" className="input" autoComplete="new-password" required minLength={10} />
          </div>
          <button className="btn-primary w-full" type="submit">
            Set password
          </button>
          <Link href="/sign-in" className="hh-secondary text-sm text-center hover:underline">
            Back to sign in
          </Link>
        </form>
      </div>
    </div>
  );
}
