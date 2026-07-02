import ComingSoon from "@/components/ComingSoon";

export default function JobsCatalogStubPage() {
  return (
    <ComingSoon
      title="Catalog"
      pitch="Cost items, cost codes and cost types synced from JobTread and wired into Estimates: pick a catalog item in the estimate line editor and description, unit and price prefill in cents. Manual free-text lines keep working exactly as today."
      bullets={[
        "Full cost-code ladder with parent/child links",
        "Cost types with margins stored as basis points",
        "Searchable tables with create/edit for CEO and Office",
        "Estimate line picker stamps the catalog item on the line",
      ]}
    />
  );
}
