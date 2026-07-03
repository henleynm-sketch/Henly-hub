import ComingSoon from "@/components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="Selections"
      pitch="Client-facing selection sheet for cabinets, tile, fixtures, paint, etc. Each option has price + a deadline; clients approve to lock the budget."
      bullets={[
        "Per-project selection sheet by category",
        "Client approves / rejects with comment",
        "Approved selections roll into project budget",
        "Reminders when deadline is approaching",
      ]}
    />
  );
}
