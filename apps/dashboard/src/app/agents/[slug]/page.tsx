import { ChatPanel } from "@/components/ChatPanel";

// In Next.js 16, dynamic route params are provided as a Promise.
export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ChatPanel slug={slug} />;
}
