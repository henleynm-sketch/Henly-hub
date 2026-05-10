import PageHeader from "@/components/PageHeader";

export default function QuickBooksIntegrationPage() {
  return (
    <>
      <PageHeader
        title="QuickBooks Online"
        subtitle="Connect Henley Hub to your QuickBooks Online company."
      />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-base font-semibold">Connection status</h2>
          <div className="mt-2 flex items-center gap-2">
            <span className="badge-amber">Not connected</span>
            <span className="text-sm text-slate-500">No realm linked yet</span>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Connecting QuickBooks lets Henley Hub:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Push accepted estimates as QB estimates / invoices</li>
            <li>Generate progress invoices from contract milestones</li>
            <li>Pull payments back to mark project balances</li>
            <li>Map clients to QB customers automatically</li>
            <li>Stream actual costs back into project budgets</li>
          </ul>
          <button className="btn-primary mt-5" disabled>
            Connect QuickBooks (OAuth)
          </button>
          <p className="mt-2 text-xs text-slate-500">
            OAuth handshake needs <code>QB_CLIENT_ID</code> + <code>QB_CLIENT_SECRET</code> set in env. Schema already has <code>qbCustomerId</code> on Client.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold">How sync will work</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>You accept an estimate → contract is created in Hub.</li>
            <li>Hub pushes a matching QB Estimate or Invoice using <code>qbCustomerId</code>.</li>
            <li>Webhook from QB fires when invoice is paid → Hub marks the milestone paid.</li>
            <li>Vendor bills entered in QB sync down as <code>BudgetItem.actualCents</code>.</li>
          </ol>
        </div>
      </div>
    </>
  );
}
