import ComingSoon from "@/components/ComingSoon";

export default function JobsBoardStubPage() {
  return (
    <ComingSoon
      title="Jobs Board"
      pitch="One board over every JobTread job with saved views: Sales Pipeline, Construction Pipeline, Warranty & After-Sales, and Henley Capital — Development. Drag a job between columns to reclassify it; the No Value column is the triage queue for unclassified jobs."
      bullets={[
        "Personal saved views per user plus CEO-managed organization views",
        "Columns follow the canonical taxonomy; zero-count columns collapse to strips",
        "Drag writes the underlying project field — CEO/Office only, read-only for others",
        "Search across job name and client; + Job opens the existing new-project flow",
      ]}
    />
  );
}
