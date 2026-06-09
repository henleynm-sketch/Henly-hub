import Link from "next/link";
import { Inbox, Briefcase, FileText, Link2, ShieldCheck, CheckCircle2, Construction, ArrowRight } from "lucide-react";

const features = [
  {
    title: "Unified Communication",
    body: "Email, SMS, and client updates aggregated in a single live stream. Say goodbye to scattered messaging threads.",
    icon: Inbox,
  },
  {
    title: "CRM & Proposal Pipeline",
    body: "Lead files flow seamlessly into estimates, contracts, and scheduling. Coordinate every build milestone effortlessly.",
    icon: Briefcase,
  },
  {
    title: "Dedicated Client Portal",
    body: "A secure workspace sharing daily logs, milestones, photos, and selections. Maintain transparency with your clients.",
    icon: CheckCircle2,
  },
  {
    title: "QuickBooks Online Sync",
    body: "Push estimates, issue progress invoices, and pull payment statuses. Keep your actual budgets updated automatically.",
    icon: Link2,
  },
  {
    title: "Granular Role Portals",
    body: "Tailored portals: crews clock hours on-site, subcontractors access files, and admins monitor org-level financials.",
    icon: ShieldCheck,
  },
  {
    title: "Field Logs & Media Library",
    body: "Field teams document progress with logs, weather details, and image uploads. Curate client-facing logs with a single toggle.",
    icon: FileText,
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen bg-canvas text-white overflow-x-hidden">
      {/* Blueprint Grid Canvas & Glow Effects */}
      <div 
        className="absolute inset-0 -z-20 pointer-events-none opacity-[0.35]" 
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Glow orb 1 */}
        <div className="absolute top-[20%] left-[50%] h-[600px] w-[600px] -translate-x-[50%] -translate-y-[50%] rounded-full bg-accent/20 blur-[130px] animate-pulse duration-[8000ms]" />
        {/* Glow orb 2 */}
        <div className="absolute top-[40%] left-[30%] h-[400px] w-[400px] -translate-x-[50%] -translate-y-[50%] rounded-full bg-violet-500/10 blur-[100px]" />
      </div>

      {/* Sticky Glass Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-glass-bg/75 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white shadow-[0_2px_8px_rgba(92,124,250,0.3)]">
              <Construction className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white block leading-none">Henley Hub</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">Contracting</span>
            </div>
          </div>
          <Link 
            href="/sign-in" 
            className="btn-secondary text-xs px-3.5 py-1.5 shadow-sm"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-5xl px-6 pt-28 pb-20 text-center flex flex-col items-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 px-3.5 py-1 text-xs font-semibold text-accent tracking-wide uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
          Operating System for Luxury Builders
        </span>
        
        <h1 className="mt-8 text-4xl sm:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-slate-400 max-w-4xl leading-[1.15]">
          Constructing Excellence. <br />
          Coordinating Operations.
        </h1>
        
        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Henley Hub combines client communication, CRM, estimates, contracts, 
          project tracking, and QuickBooks sync into a single premium OS, 
          tailored for every role on the job.
        </p>

        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link 
            href="/sign-in" 
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 font-semibold shadow-lg text-sm transition-all"
          >
            Open the Hub
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a 
            href="#features" 
            className="btn-secondary px-6 py-3 font-semibold text-sm transition-all"
          >
            See what's inside
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-32">
        <div className="text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Built for how Henley actually works</h2>
          <p className="mt-2 text-slate-400 text-sm max-w-md mx-auto">No placeholders. Fully integrated workflows custom-built for high-end residential construction.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div 
                key={f.title} 
                className="card p-6 border border-white/5 hover:border-accent/30 hover:bg-glass-bg/80 group transition-all duration-300"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-accent group-hover:bg-accent/10 group-hover:border-accent/25 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white group-hover:text-accent transition-colors">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-450 leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Premium Footer */}
      <footer className="border-t border-white/5 bg-glass-sidebar/65 backdrop-blur-md py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Henley Hub</span>
            <span>·</span>
            <span>Internal operating system</span>
          </div>
          <div>
            © {new Date().getFullYear()} Henley Contracting. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
