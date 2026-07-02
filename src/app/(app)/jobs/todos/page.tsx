import ComingSoon from "@/components/ComingSoon";

export default function JobsTodosStubPage() {
  return (
    <ComingSoon
      title="To-Dos"
      pitch="Read-only live view of JobTread to-dos per job — name, owner, due date and type, deep-linked back to JobTread. Nothing is stored in the Hub: Henley Tasks stays the task master, JobTread to-dos are display-only."
      bullets={[
        "Fetched live from the JobTread API when a job panel opens",
        "Deep links to the JobTread job for follow-up",
        "Graceful failure state when JobTread is unreachable",
        "No local task tables — ever",
      ]}
    />
  );
}
