import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { AssistantDigestView } from "./view";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  // Auth check — require sign-in
  let user: { id?: string; subject?: string; isOperator?: boolean } | null = null;
  try {
    user = await fetchAuthQuery(api.auth.getCurrentUser, {});
  } catch {
    // No Convex URL or auth failure — fall through to redirect
  }

  if (!user) redirect("/sign-in");

  // Resolve user_id from the identity subject (Better Auth user id)
  const userId: string = user.subject ?? user.id ?? "demo";

  // Attempt to preload today's digest server-side for zero-flash render.
  // Failures are non-fatal — the client island re-fetches reactively.
  let initialDigest: {
    _id: string;
    user_id: string;
    date: string;
    markdown: string;
    created_at: string;
  } | null = null;

  try {
    const digest = await fetchAuthQuery(api.dailyDigests.latestForUser, {
      user_id: userId,
    });
    if (digest && typeof digest === "object" && "markdown" in digest) {
      initialDigest = digest as unknown as typeof initialDigest;
    }
  } catch {
    // Non-fatal
  }

  return (
    // Bypass PageShell — narrow 720px editorial column per §5.11
    <main className="min-h-screen bg-paper">
      <AssistantDigestView
        userId={userId}
        initialDigest={initialDigest}
      />
    </main>
  );
}
