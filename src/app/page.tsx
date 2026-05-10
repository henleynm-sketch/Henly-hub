import Link from "next/link";

const features = [
  {
    title: "Unified inbox",
    body: "Email, SMS, and in-app messages in one thread per client. No more digging through three apps to find what was promised.",
  },
  {
    title: "Sales → estimate → contract",
    body: "Lead captured in CRM auto-fills the estimate, which becomes the contract. One source of truth from first call to keys.",
  },
  {
    title: "Project portal",
    body: "Each project has milestones, daily logs, budget vs actual, selections, and documents. Clients log in to see only what they should.",
  },
  {
    title: "Connected to QuickBooks",
    body: "Push approved estimates and progress invoices to QB. Pull payments back. Keep books and project budgets in sync.",
  },
  {
    title: "Role-aware everything",
    body: "Field crew sees today's job and time clock. Subs see only their scope. Office sees the pipeline. CEO sees the whole business.",
  },
  {
    title: "Daily logs that clients see",
    body: "Crew posts a log; you choose what's client-visible. Photos, weather, what got done, what's blocking. Trust through transparency.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-lg font-semibold tracking-tight">Henley Hub</span>
          </div>
          <Link href="/sign-in" className="btn-primary">Sign in</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="max-w-3xl">
          <span className="badge-violet">For residential remodelers</span>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink">
            Run the whole job from one hub.
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            Henley Hub combines client communication, CRM, estimates, contracts,
            project tracking, and QuickBooks — customized for every person on
            the job. Built for the way Henley actually works.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/sign-in" className="btn-primary">Open the hub</Link>
            <a href="#features" className="btn-secondary">See what's inside</a>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-slate-500">
          Henley Hub — internal preview
        </div>
      </footer>
    </main>
  );
}

function Logo() {
  return (
    <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
      <span className="text-sm font-bold">H</span>
    </div>
  );
}
