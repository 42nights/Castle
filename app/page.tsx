import { redirect } from "next/navigation";
import { ChatLanding } from "@/components/chat-landing";
import { WelcomeLanding } from "@/components/welcome-landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return <ChatLanding />;
  // DEV-ONLY auto-operator: render the operator chat surface without GitHub
  // OAuth. Gated by CASTLE_DEV_AUTH=1 in .env.local (local only, gitignored).
  if (process.env.CASTLE_DEV_AUTH === "1") return <ChatLanding />;

  let user: { isOperator?: boolean } | null = null;
  try {
    const { fetchAuthQuery } = await import("@/lib/auth-server");
    const { api } = await import("@/convex/_generated/api");
    user = await fetchAuthQuery(api.auth.getCurrentUser, {});
  } catch (err) {
    console.error("[home] auth check failed:", err);
  }

  if (!user) return <WelcomeLanding />;
  if (!user.isOperator) redirect("/templates");
  return <ChatLanding />;
}
