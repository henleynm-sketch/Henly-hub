import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDashboardAnalytics } from "@/lib/services/dashboardService";

// Dev-only diagnostics: exposes the KPI slice the dashboard computes so the
// live module can be inspected without UI caching in the way.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "dev only" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const a = await getDashboardAnalytics();
  return NextResponse.json({
    kpis: a.kpis,
    byStatus: a.byStatus,
    marker: "kpi-derivation-v2",
  });
}
