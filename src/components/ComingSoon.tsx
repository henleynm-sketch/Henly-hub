import PageHeader from "./PageHeader";

export default function ComingSoon({
  title,
  pitch,
  bullets,
}: {
  title: string;
  pitch: string;
  bullets: string[];
}) {
  return (
    <>
      <PageHeader title={title} subtitle="Phase 2 — schema and routes are in place; UI builds out next." />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-base font-semibold">What this will do</h2>
          <p className="mt-2 text-sm text-slate-600">{pitch}</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="text-base font-semibold">Status</h2>
          <p className="mt-2 text-sm text-slate-600">
            Available in this build:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Data model in Prisma schema</li>
            <li>Role-based access wiring</li>
            <li>Navigation entry</li>
          </ul>
          <p className="mt-4 text-sm text-slate-600">Not yet built: full UI, integrations, mutations.</p>
        </div>
      </div>
    </>
  );
}
