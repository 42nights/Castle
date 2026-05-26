import { redirect } from "next/navigation";
import { ChatLanding } from "@/components/chat-landing";
import { requireSignedIn } from "@/lib/load-overview";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { isOperator } = await requireSignedIn();
  if (!isOperator) redirect("/templates");
  return <ChatLanding />;
}
