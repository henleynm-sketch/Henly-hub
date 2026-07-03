import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const sp = await searchParams;

  async function submit(formData: FormData) {
    "use server";
    await requestPasswordReset(formData);
    // Identical outcome whether or not the account exists — no enumeration.
    redirect("/forgot-password?sent=1");
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="hh-panel w-full max-w-sm p-7 flex flex-col gap-4">
        <h1 className="hh-display text-lg font-bold text-ink">Reset your password</h1>
        {sp.sent ? (
          <>
            <p className="hh-secondary">
              If an account exists for that address, a reset link (valid 1 hour) is on its
              way from hello@henleycontracting.com.
            </p>
            <Link href="/sign-in" className="btn-secondary text-center">
              Back to sign in
            </Link>
          </>
        ) : (
          <form action={submit} className="flex flex-col gap-3">
            <div>
              <label className="hh-label block mb-1.5">Email</label>
              <input name="email" type="email" className="input" autoComplete="email" required />
            </div>
            <button className="btn-primary w-full" type="submit">
              Send reset link
            </button>
            <Link href="/sign-in" className="hh-secondary text-sm text-center hover:underline">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
