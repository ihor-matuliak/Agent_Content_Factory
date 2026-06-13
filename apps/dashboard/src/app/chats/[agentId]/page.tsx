import { ChatPanel } from "@/components/ChatPanel";

// In Next.js 16, dynamic route params are provided as a Promise.
// `agentId` carries the agent's slug (e.g. "strategist").
export default async function ChatWithAgentPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <ChatPanel slug={agentId} />;
}
