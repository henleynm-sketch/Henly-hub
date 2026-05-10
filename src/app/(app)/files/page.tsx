import ComingSoon from "@/components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="Files"
      pitch="Per-project document library: contracts, plans, permits, invoices, photos. Role-based visibility — clients see only what you share."
      bullets={[
        "Drag-and-drop upload to S3 / R2",
        "Folder per project (auto-created)",
        "Tag docs (CONTRACT, PLAN, PERMIT, INVOICE, PHOTO)",
        "Client-visible toggle per file",
        "Photo gallery from daily logs feeds in here",
      ]}
    />
  );
}
