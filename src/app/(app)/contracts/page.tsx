import ComingSoon from "@/components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="Contracts"
      pitch="Convert an accepted estimate into a signable contract. Capture initial deposit and link to QuickBooks invoice. E-signature provider plugs in here."
      bullets={[
        "One-click conversion from estimate → contract",
        "PDF generation with Henley branding",
        "E-signature via DocuSign or similar",
        "Auto-create QB invoice + payment link",
        "Contract version history per project",
      ]}
    />
  );
}
