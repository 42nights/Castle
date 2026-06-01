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
    sections_json?: string;
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

  // Dev-bypass fallback: if we still have nothing (user_id didn't match the
  // seed row), grab the most recent digest from any user so the page never
  // shows the empty state during a demo/dev session.
  if (!initialDigest) {
    try {
      const fallback = await fetchAuthQuery(api.dailyDigests.mostRecent, {});
      if (fallback && typeof fallback === "object" && "markdown" in fallback) {
        initialDigest = fallback as unknown as typeof initialDigest;
      }
    } catch {
      // Non-fatal
    }
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
