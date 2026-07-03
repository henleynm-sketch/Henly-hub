import { isAssistantEnabled } from "@/lib/assistant/anthropic";
import AssistantPanel from "./AssistantPanel";

// Server gate for the floating launcher — absent app-wide when the Claude
// card's kill switch is off or no key is configured.
export default async function AssistantMount() {
  if (!(await isAssistantEnabled())) return null;
  return <AssistantPanel />;
}
