import PageHeader from "@/components/PageHeader";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canSeeFinancials } from "@/lib/roles";
import { getQBOToken } from "@/lib/quickbooks";
import { disconnectQuickBooksAction } from "./quickbooksActions";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Link2, ShieldCheck, Database, FileSpreadsheet, Users } from "lucide-react";

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
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-status-success shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-status-success shrink-0" />
            <div>
              <p className="text-sm font-semibold">Connection Successful!</p>
              <p className="text-xs opacity-90">Henley Hub is now authorized to sync data with QuickBooks Online.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-status-error shadow-sm">
            <XCircle className="h-5 w-5 text-status-error shrink-0" />
            <div>
              <p className="text-sm font-semibold">Connection Failed</p>
              <p className="text-xs opacity-90">
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
            <div className="hh-panel p-6">
              <h2 className="hh-label">Connection Status</h2>

              {token ? (
                // Connected State
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="hh-badge hh-badge--success !ml-0 inline-flex items-center">
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      Connected
                    </span>
                    <span className="hh-secondary">
                      Realm ID: <code className="hh-chip">{token.realmId}</code>
                    </span>
                  </div>

                  <div className="mt-6">
                    <hr className="hh-divider" />
                    <h3 className="hh-label">Connection Details</h3>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="hh-row flex-col !items-start !gap-0">
                        <span className="hh-label block mb-1">Authorization Scope</span>
                        <span className="hh-primary">Accounting (Read/Write)</span>
                      </div>
                      <div className="hh-row flex-col !items-start !gap-0">
                        <span className="hh-label block mb-1">Token Expires At</span>
                        <span className="hh-primary">
                          {new Date(token.expiresAt).toLocaleTimeString()} on {new Date(token.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <a
                      href="/integrations/quickbooks/employees"
                      className="btn btn-primary"
                    >
                      <Users className="h-4 w-4" />
                      Map Employees
                    </a>
                    <form action={disconnectQuickBooksAction}>
                      <button
                        type="submit"
                        className="btn btn-destructive"
                      >
                        Disconnect QuickBooks
                      </button>
                    </form>
                    <span className="hh-caption flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Auto-refresh active
                    </span>
                  </div>
                </div>
              ) : (
                // Disconnected State
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <span className="hh-badge hh-badge--warning !ml-0">Not connected</span>
                    <span className="hh-secondary">No company linked</span>
                  </div>
                  <p className="mt-4 hh-secondary">
                    Link your QuickBooks Online Sandbox or Production company to Henley Hub. Once authorized, Henley Hub can automatically sync estimates, contracts, invoices, and expenses.
                  </p>

                  <div className="mt-6">
                    <a
                      href="/api/auth/quickbooks"
                      className="btn btn-primary"
                    >
                      <Link2 className="h-4 w-4" />
                      Connect QuickBooks (OAuth)
                    </a>
                  </div>

                  <p className="mt-3 hh-caption leading-normal">
                    This will redirect you securely to QuickBooks for authentication.
                    Ensure <code className="hh-chip">QB_CLIENT_ID</code>, <code className="hh-chip">QB_CLIENT_SECRET</code>, and <code className="hh-chip">QB_REDIRECT_URI</code> are correctly configured.
                  </p>
                </div>
              )}
            </div>
 
            {/* Sync Features Grid */}
            <div className="hh-panel p-6">
              <h2 className="hh-label">Synchronized Workflows</h2>
              <p className="mt-1 hh-secondary">How Henley Hub integrates with your books.</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="hh-row !items-start">
                  <Database className="h-5 w-5 text-accent shrink-0" />
                  <div>
                    <h3 className="hh-primary">Customer Mapping</h3>
                    <p className="mt-1 hh-secondary">Clients created in CRM link to QuickBooks Customer records automatically using `qbCustomerId`.</p>
                  </div>
                </div>

                <div className="hh-row !items-start">
                  <FileSpreadsheet className="h-5 w-5 text-accent shrink-0" />
                  <div>
                    <h3 className="hh-primary">Invoices & Estimates</h3>
                    <p className="mt-1 hh-secondary">Convert accepted estimates to QuickBooks Estimates or Invoices, syncing payment terms and line items.</p>
                  </div>
                </div>

                <div className="hh-row !items-start">
                  <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                  <div>
                    <h3 className="hh-primary">Payment Synchronization</h3>
                    <p className="mt-1 hh-secondary">Mark project milestones paid in real-time when payments are registered in QuickBooks.</p>
                  </div>
                </div>

                <div className="hh-row !items-start">
                  <AlertCircle className="h-5 w-5 text-accent shrink-0" />
                  <div>
                    <h3 className="hh-primary">Cost & Budget Tracking</h3>
                    <p className="mt-1 hh-secondary">Pull actual costs and vendor bills from QuickBooks directly into the project financial tracker.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
 
          {/* Sync Overview Guide */}
          <div className="hh-panel p-6 h-fit">
            <h2 className="hh-label">How the sync works</h2>
            <ol className="mt-4 relative border-l border-glass-border pl-4 space-y-6">
              <li className="relative">
                <span className="absolute -left-[22px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-glass-border ring-4 ring-canvas" />
                <h4 className="hh-primary">1. Client Proposal Acceptance</h4>
                <p className="mt-1 hh-secondary">Estimate accepted by customer → automatically creates a contract record in Henley Hub.</p>
              </li>
              <li className="relative">
                <span className="absolute -left-[22px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-glass-border ring-4 ring-canvas" />
                <h4 className="hh-primary">2. QuickBooks Sync Triggered</h4>
                <p className="mt-1 hh-secondary">Hub pushes estimate details directly to QuickBooks Online and maps to client's `qbCustomerId`.</p>
              </li>
              <li className="relative">
                <span className="absolute -left-[22px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-glass-border ring-4 ring-canvas" />
                <h4 className="hh-primary">3. Webhook Updates Status</h4>
                <p className="mt-1 hh-secondary">When client pays the invoice in QuickBooks, a webhook notifies Hub to mark the milestone paid.</p>
              </li>
              <li className="relative">
                <span className="absolute -left-[22px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-glass-border ring-4 ring-canvas" />
                <h4 className="hh-primary">4. Expenses Pulled Down</h4>
                <p className="mt-1 hh-secondary">Vendor bills and actual costs sync from QB as `BudgetItem.actualCents` for real-time profitability tracking.</p>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
