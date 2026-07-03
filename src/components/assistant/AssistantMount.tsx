import { getAssistantConfig, isAssistantEnabled } from "@/lib/assistant/anthropic";
import { PROVIDER_LABELS, type Provider } from "@/lib/assistant/providers";
import AssistantPanel from "./AssistantPanel";

// Server gate for the floating launcher — absent app-wide when the AI card's
// kill switch is off or no key is configured. Label follows the provider.
export default async function AssistantMount() {
  if (!(await isAssistantEnabled())) return null;
  const cfg = await getAssistantConfig();
  const name = PROVIDER_LABELS[(cfg?.provider as Provider) ?? "anthropic"] ?? "Claude";
  return <AssistantPanel assistantName={name} />;
}
