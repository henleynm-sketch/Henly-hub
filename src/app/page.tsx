import Link from "next/link";
import { Inbox, Briefcase, FileText, Link2, ShieldCheck, CheckCircle2, Construction, ArrowRight } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import ScrollReveal from "@/components/ScrollReveal";

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
    <div className="relative min-h-screen bg-canvas text-ink overflow-x-hidden transition-colors duration-300">
      {/* Blueprint Grid Canvas */}
      <div 
        className="absolute inset-0 -z-20 pointer-events-none opacity-[0.25] dark:opacity-[0.35]" 
        style={{
          backgroundImage: `
            linear-gradient(var(--glass-border) 1px, transparent 1px),
            linear-gradient(90deg, var(--glass-border) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      
      {/* Animated Mesh Gradient Background (glowing orbs moving slowly) */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Orb 1: Accent Color */}
        <div className="absolute top-[12%] left-[25%] h-[600px] w-[600px] rounded-full bg-accent/20 blur-[130px] animate-orb-1" />
        {/* Orb 2: Deep Violet */}
        <div className="absolute top-[38%] left-[65%] h-[650px] w-[650px] rounded-full bg-violet-500/15 blur-[120px] animate-orb-2" />
        {/* Orb 3: Turquoise/Sky */}
        <div className="absolute top-[68%] left-[18%] h-[550px] w-[550px] rounded-full bg-cyan-500/10 blur-[110px] animate-orb-3" />
      </div>

      {/* Sticky Glass Navbar with Real Backdrop Filter */}
      <header 
        style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        className="sticky top-0 z-50 w-full border-b border-glass-border bg-glass-topbar/80 px-6 py-4 shadow-sm"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white"
              style={{ boxShadow: "0 2px 8px rgba(92,124,250,0.3)" }}
            >
              <Construction className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-ink block leading-none">Henley Hub</span>
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mt-0.5">Contracting</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link 
              href="/sign-in" 
              className="btn-secondary text-xs px-4 py-2 font-semibold shadow-sm"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Scroll Reveal */}
      <section className="relative mx-auto max-w-5xl px-6 pt-32 pb-24 text-center flex flex-col items-center">
        <ScrollReveal className="flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/25 px-4 py-1.5 text-xs font-bold text-accent tracking-wide uppercase shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
            Operating System for Luxury Builders
          </span>
          
          <h1 className="mt-8 text-5xl sm:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-ink via-ink to-ink-soft max-w-4xl leading-[1.08]">
            Constructing Excellence. <br />
            Coordinating Operations.
          </h1>
          
          <p className="mt-6 text-lg sm:text-xl text-ink-soft max-w-3xl leading-relaxed">
            Henley Hub combines client communication, CRM, estimates, contracts, 
            project tracking, and QuickBooks sync into a single premium OS, 
            tailored for every role on the job.
          </p>

          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link 
              href="/sign-in" 
              className="btn-primary inline-flex items-center gap-2 px-6 py-3.5 font-bold shadow-lg text-sm hover:-translate-y-0.5 transition-all"
            >
              Open the Hub
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a 
              href="#features" 
              className="btn-secondary px-6 py-3.5 font-semibold text-sm hover:-translate-y-0.5 transition-all"
            >
              See what's inside
            </a>
          </div>
        </ScrollReveal>
      </section>

      {/* Features Section */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-32">
        <ScrollReveal className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">Built for how Henley actually works</h2>
          <p className="mt-3 text-ink-soft text-base max-w-md mx-auto leading-relaxed">No placeholders. Fully integrated workflows custom-built for high-end residential construction.</p>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, index) => {
            const Icon = f.icon;
            return (
              <ScrollReveal 
                key={f.title}
                className="flex"
              >
                <div
                  className="hh-panel p-6 hover:scale-[1.03] hover:-translate-y-1 group transition-all duration-300 w-full flex flex-col"
                >
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-glass-border text-accent group-hover:bg-accent/10 group-hover:border-accent/25 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-ink group-hover:text-accent transition-colors">{f.title}</h3>
                  <p className="mt-2 text-sm text-ink-soft leading-relaxed flex-1">{f.body}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* Premium Footer */}
      <footer className="border-t border-glass-border bg-glass-sidebar/65 backdrop-blur-md py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 hh-caption font-medium">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Henley Hub</span>
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
