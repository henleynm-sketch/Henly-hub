import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canSeeFinancials } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatDate, formatMoney } from "@/lib/utils";
import PrintButton from "@/components/PrintButton";

export default async function ContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const viewerRole = session.user.role as Role;

  const { id } = await params;
  const c = await prisma.contract.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      estimate: { include: { lineItems: true } },
    },
  });
  if (!c) notFound();

  // Office roles always; the owning client only once the contract is signed.
  const isOwnerClient =
    viewerRole === "CLIENT" &&
    session.user.clientId === c.clientId &&
    (c.status === "SIGNED" || c.status === "DEPOSIT_PAID");
  if (!canSeeFinancials(viewerRole) && !isOwnerClient) redirect("/dashboard");

  const lines = c.estimate?.lineItems ?? [];

  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#666",
    padding: "8px 10px",
    borderBottom: "2px solid #141417",
  };
  const td: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #ddd", fontSize: 13 };
  const right: React.CSSProperties = { textAlign: "right" };

  return (
    <main style={{ background: "#fff", color: "#141417", minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`@media print { .print-hidden { display: none !important; } } body { background: #fff !important; }`}</style>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 32px" }}>
        <div className="print-hidden" style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end" }}>
          <PrintButton />
        </div>

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #E8621A", paddingBottom: 20 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Henley Contracting</div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: "#E8621A", fontWeight: 700 }}>
              Construction Agreement
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "#444" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#141417" }}>{c.number} · v{c.version}</div>
            <div>{formatDate(c.createdAt)}</div>
            <div style={{ textTransform: "capitalize" }}>Status: {c.status.toLowerCase()}</div>
          </div>
        </header>

        <section style={{ display: "flex", gap: 48, marginTop: 28 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", fontWeight: 600 }}>Client</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{c.client.name}</div>
            {c.client.address && <div style={{ fontSize: 13, color: "#444" }}>{c.client.address}</div>}
            {(c.client.city || c.client.state) && (
              <div style={{ fontSize: 13, color: "#444" }}>{[c.client.city, c.client.state, c.client.zip].filter(Boolean).join(", ")}</div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", fontWeight: 600 }}>Project</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{c.project?.name ?? c.title}</div>
            {c.project?.address && <div style={{ fontSize: 13, color: "#444" }}>{c.project.address}</div>}
            {c.project?.projectType && <div style={{ fontSize: 13, color: "#444" }}>{c.project.projectType}</div>}
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Category</th>
                <th style={th}>Description</th>
                <th style={{ ...th, ...right }}>Qty</th>
                <th style={{ ...th, ...right }}>Unit</th>
                <th style={{ ...th, ...right }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((li) => (
                <tr key={li.id}>
                  <td style={td}>{li.category ?? "—"}</td>
                  <td style={td}>{li.description}</td>
                  <td style={{ ...td, ...right }}>{li.quantity}</td>
                  <td style={{ ...td, ...right }}>{formatMoney(li.unitCents)}</td>
                  <td style={{ ...td, ...right }}>{formatMoney(li.totalCents)}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td style={td} colSpan={5}>{c.title}</td></tr>
              )}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <table style={{ borderCollapse: "collapse", minWidth: 280 }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 10px", fontSize: 13, color: "#444" }}>Subtotal</td>
                  <td style={{ padding: "4px 10px", fontSize: 13, textAlign: "right" }}>{formatMoney(c.subtotalCents)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 10px", fontSize: 13, color: "#444" }}>Tax</td>
                  <td style={{ padding: "4px 10px", fontSize: 13, textAlign: "right" }}>{formatMoney(c.taxCents)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 10px", fontSize: 15, fontWeight: 800, borderTop: "2px solid #141417" }}>Contract total</td>
                  <td style={{ padding: "6px 10px", fontSize: 15, fontWeight: 800, textAlign: "right", borderTop: "2px solid #141417" }}>{formatMoney(c.totalCents)}</td>
                </tr>
                {c.depositCents > 0 && (
                  <tr>
                    <td style={{ padding: "4px 10px", fontSize: 13, color: "#E8621A", fontWeight: 700 }}>Deposit due on signing</td>
                    <td style={{ padding: "4px 10px", fontSize: 13, textAlign: "right", color: "#E8621A", fontWeight: 700 }}>{formatMoney(c.depositCents)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {c.terms && (
          <section style={{ marginTop: 32 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", fontWeight: 600 }}>Terms & notes</div>
            <p style={{ fontSize: 13, color: "#333", whiteSpace: "pre-wrap", marginTop: 6, lineHeight: 1.55 }}>{c.terms}</p>
          </section>
        )}

        <section style={{ marginTop: 56, display: "flex", gap: 48 }}>
          <div style={{ flex: 1 }}>
            <div style={{ borderBottom: "1px solid #141417", height: 40 }}>
              {c.signedByName && (
                <span style={{ fontFamily: "cursive", fontSize: 20 }}>{c.signedByName}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              Client — {c.client.name}{c.signedAt ? ` · signed ${formatDate(c.signedAt)}` : ""}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderBottom: "1px solid #141417", height: 40 }} />
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>Henley Contracting — authorized signer</div>
          </div>
        </section>

        <footer style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid #ddd", fontSize: 11, color: "#999", display: "flex", justifyContent: "space-between" }}>
          <span>Henley Contracting · {c.number} v{c.version}</span>
          <span>Generated {formatDate(new Date())} via Henley Hub</span>
        </footer>
      </div>
    </main>
  );
}
