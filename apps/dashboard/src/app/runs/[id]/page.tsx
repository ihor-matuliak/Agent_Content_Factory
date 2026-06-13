import { RunDetailView } from "@/components/RunDetailView";

// In Next.js 16, dynamic route params are provided as a Promise.
export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RunDetailView id={id} />;
}
