import PageHeader from "@/components/PageHeader";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canSeeFinancials } from "@/lib/roles";
import { getQBOToken } from "@/lib/quickbooks";
import { disconnectQuickBooksAction } from "./quickbooksActions";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Link2, ShieldCheck, Database, FileSpreadsheet } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function QuickBooksIntegrationPage(props: PageProps) {
  // 1. Role-based guarding (CEO & OFFICE only)
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const role = session.user.role;
  if (!canSeeFinancials(role)) {
    redirect("/dashboard");
  }

  // 2. Fetch connection status and url search params
  const token = await getQBOToken();
  const searchParams = await props.searchParams;
  const success = searchParams.success;
  const error = searchParams.error;

  return (
    <>
      <PageHeader
        title="QuickBooks Online"
        subtitle="Manage sync between Henley Hub and QuickBooks Online accounting."
      />

      <div className="mx-auto max-w-6xl p-6">
        {/* Status Notification Banners */}
        {success === "connected" && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Connection Successful!</p>
              <p className="text-xs text-emerald-700/90">Henley Hub is now authorized to sync data with QuickBooks Online.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">
            <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Connection Failed</p>
              <p className="text-xs text-rose-700/90">
                {error === "state_mismatch" && "Security check failed (state mismatch). Please try again."}
                {error === "token_exchange_failed" && "Failed to retrieve access tokens from QuickBooks. Verify credentials."}
                {error === "missing_config" && "Missing client configurations. Please check environment variables."}
                {error === "missing_parameters" && "Authorization parameters are missing from the redirect request."}
                {error === "access_denied" && "Consent was denied. QuickBooks was not connected."}
                {error !== "state_mismatch" &&
                  error !== "token_exchange_failed" &&
                  error !== "missing_config" &&
                  error !== "missing_parameters" &&
                  error !== "access_denied" &&
                  `An unexpected error occurred: ${error}`}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Status & Action Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6">
              <h2 className="text-base font-semibold text-slate-900">Connection Status</h2>
              
              {token ? (
                // Connected State
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="badge-green">
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      Connected
                    </span>
                    <span className="text-sm text-slate-500">
                      Realm ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">{token.realmId}</code>
                    </span>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <h3 className="text-sm font-semibold text-slate-800">Connection Details</h3>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600">
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                        <span className="block text-xs font-medium text-slate-400 uppercase">Authorization Scope</span>
                        <span className="font-medium text-slate-700">Accounting (Read/Write)</span>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                        <span className="block text-xs font-medium text-slate-400 uppercase">Token Expires At</span>
                        <span className="font-medium text-slate-700">
                          {new Date(token.expiresAt).toLocaleTimeString()} on {new Date(token.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-3">
                    <form action={disconnectQuickBooksAction}>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
                      >
                        Disconnect QuickBooks
                      </button>
                    </form>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                      Auto-refresh active
                    </span>
                  </div>
                </div>
              ) : (
                // Disconnected State
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <span className="badge-amber">Not connected</span>
                    <span className="text-sm text-slate-500">No company linked</span>
                  </div>
                  <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                    Link your QuickBooks Online Sandbox or Production company to Henley Hub. Once authorized, Henley Hub can automatically sync estimates, contracts, invoices, and expenses.
                  </p>
                  
                  <div className="mt-6">
                    <a
                      href="/api/auth/quickbooks"
                      className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
                    >
                      <Link2 className="h-4 w-4" />
                      Connect QuickBooks (OAuth)
                    </a>
                  </div>
                  
                  <p className="mt-3 text-xs text-slate-400 leading-normal">
                    This will redirect you securely to QuickBooks for authentication. 
                    Ensure <code>QB_CLIENT_ID</code>, <code>QB_CLIENT_SECRET</code>, and <code>QB_REDIRECT_URI</code> are correctly configured.
                  </p>
                </div>
              )}
            </div>

            {/* Sync Features Grid */}
            <div className="card p-6">
              <h2 className="text-base font-semibold text-slate-900">Synchronized Workflows</h2>
              <p className="mt-1 text-sm text-slate-500">How Henley Hub integrates with your books.</p>
              
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="flex gap-3 rounded-lg border border-slate-100 p-4">
                  <Database className="h-5 w-5 text-brand-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Customer Mapping</h3>
                    <p className="mt-1 text-xs text-slate-500 leading-normal">Clients created in CRM link to QuickBooks Customer records automatically using `qbCustomerId`.</p>
                  </div>
                </div>

                <div className="flex gap-3 rounded-lg border border-slate-100 p-4">
                  <FileSpreadsheet className="h-5 w-5 text-brand-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Invoices & Estimates</h3>
                    <p className="mt-1 text-xs text-slate-500 leading-normal">Convert accepted estimates to QuickBooks Estimates or Invoices, syncing payment terms and line items.</p>
                  </div>
                </div>

                <div className="flex gap-3 rounded-lg border border-slate-100 p-4">
                  <CheckCircle2 className="h-5 w-5 text-brand-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Payment Synchronization</h3>
                    <p className="mt-1 text-xs text-slate-500 leading-normal">Mark project milestones paid in real-time when payments are registered in QuickBooks.</p>
                  </div>
                </div>

                <div className="flex gap-3 rounded-lg border border-slate-100 p-4">
                  <AlertCircle className="h-5 w-5 text-brand-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Cost & Budget Tracking</h3>
                    <p className="mt-1 text-xs text-slate-500 leading-normal">Pull actual costs and vendor bills from QuickBooks directly into the project financial tracker.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Overview Guide */}
          <div className="card p-6 h-fit bg-slate-50/50">
            <h2 className="text-base font-semibold text-slate-900">How the sync works</h2>
            <ol className="mt-4 relative border-l border-slate-200 pl-4 space-y-6 text-sm text-slate-600">
              <li className="relative">
                <span className="absolute -left-[22px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-200 ring-4 ring-white" />
                <h4 className="font-semibold text-slate-800">1. Client Proposal Acceptance</h4>
                <p className="mt-1 text-xs text-slate-500">Estimate accepted by customer → automatically creates a contract record in Henley Hub.</p>
              </li>
              <li className="relative">
                <span className="absolute -left-[22px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-200 ring-4 ring-white" />
                <h4 className="font-semibold text-slate-800">2. QuickBooks Sync Triggered</h4>
                <p className="mt-1 text-xs text-slate-500">Hub pushes estimate details directly to QuickBooks Online and maps to client's `qbCustomerId`.</p>
              </li>
              <li className="relative">
                <span className="absolute -left-[22px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-200 ring-4 ring-white" />
                <h4 className="font-semibold text-slate-800">3. Webhook Updates Status</h4>
                <p className="mt-1 text-xs text-slate-500">When client pays the invoice in QuickBooks, a webhook notifies Hub to mark the milestone paid.</p>
              </li>
              <li className="relative">
                <span className="absolute -left-[22px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-200 ring-4 ring-white" />
                <h4 className="font-semibold text-slate-800">4. Expenses Pulled Down</h4>
                <p className="mt-1 text-xs text-slate-500">Vendor bills and actual costs sync from QB as `BudgetItem.actualCents` for real-time profitability tracking.</p>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
