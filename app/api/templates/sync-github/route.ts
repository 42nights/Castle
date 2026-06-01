import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { fetchAuthMutation, fetchAuthQuery } from "@/lib/auth-server";
import { composio } from "@/lib/composio";

export const runtime = "nodejs";
export const maxDuration = 60;

const ORG = "42nights";

function isVercelCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function convexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
}

type Repo = {
  name: string;
  full_name: string;
  description?: string | null;
  private?: boolean;
  archived?: boolean;
};

/**
 * Sync the operator's view of the 42nights GitHub org into Convex as
 * "template candidates". Idempotent — repos already linked to a real
 * template or already on the candidates table are skipped.
 *
 * Auth: caller must be allowlisted (verified via fetchAuthQuery
 * `auth.getCurrentUser` — returns null for non-operators).
 * Composio: uses `CASTLE_SYSTEM_ACTOR_SLUG`'s GitHub connection so the
 * sync works the same regardless of which operator triggered it. Falls
 * back to the caller's slug when the env var is unset.
 */
export async function POST(req: Request) {
  // Auth gate: accept either an allowlisted Better Auth user OR a
  // Vercel cron call (CRON_SECRET bearer header). The cron path uses an
  // unauthenticated Convex client because there's no operator identity
  // to forward.
  const cron = isVercelCron(req);
  let me: { email?: string; isOperator?: boolean } | null = null;
  if (!cron) {
    try {
      me = (await fetchAuthQuery(api.auth.getCurrentUser, {})) as
        | { email?: string; isOperator?: boolean }
        | null;
    } catch {
      return Response.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (!me || !me.isOperator) {
      return Response.json(
        { error: "unauthorized: must be an allowlisted operator" },
        { status: 403 },
      );
    }
  }

  const cx = convexClient();
  if (!cx) {
    return Response.json(
      { error: "NEXT_PUBLIC_CONVEX_URL not set" },
      { status: 500 },
    );
  }

  // Acquire the CAS sync lock
  let runId: string;
  let lockToken: string;
  try {
    const lockResult = (
      cron
        ? await cx.mutation(api.templates.startSync, {
            source: "cron",
            actor_email: undefined,
          })
        : await fetchAuthMutation(api.templates.startSync, {
            source: "manual",
            actor_email: me?.email ?? undefined,
          })
    ) as { run_id: string; lock_token: string };
    runId = lockResult.run_id;
    lockToken = lockResult.lock_token;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sync lock failed";
    if (/already in progress/i.test(msg)) {
      return Response.json({ error: "sync already in progress" }, { status: 409 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }

  const c = composio();
  if (!c) {
    await cx.mutation(api.templates.finishSync, {
      run_id: runId as never,
      lock_token: lockToken,
      count_seen: 0,
      count_inserted: 0,
      count_skipped: 0,
      error: "COMPOSIO_API_KEY not set",
    });
    return Response.json({ error: "COMPOSIO_API_KEY not set" }, { status: 500 });
  }

  // Resolve the actor whose GitHub connection we'll borrow. Prefer a
  // dedicated service-actor env var so cron jobs don't depend on
  // whichever human happened to connect last. Cron path REQUIRES the
  // env var (there's no caller identity to fall back to).
  const callerSlug =
    me?.email && typeof me.email === "string"
      ? me.email.split("@")[0]?.toLowerCase() ?? null
      : null;
  const actor = process.env.CASTLE_SYSTEM_ACTOR_SLUG || callerSlug;
  if (!actor) {
    await cx.mutation(api.templates.finishSync, {
      run_id: runId as never,
      lock_token: lockToken,
      count_seen: 0,
      count_inserted: 0,
      count_skipped: 0,
      error: "no GitHub actor resolvable — set CASTLE_SYSTEM_ACTOR_SLUG or sign in",
    });
    return Response.json(
      {
        error:
          "no GitHub actor resolvable — set CASTLE_SYSTEM_ACTOR_SLUG or sign in",
      },
      { status: 400 },
    );
  }

  // Fetch repos via Composio session.execute — the recommended v3
  // pattern. Sessions resolve toolkit versions automatically, so we
  // don't have to chase dated version strings.
  let repos: Repo[] = [];
  try {
    const session = await c.create(actor);
    const result = (await session.execute("GITHUB_LIST_ORGANIZATION_REPOSITORIES", {
      org: ORG,
      per_page: 100,
    })) as { data?: { items?: Repo[] } | Repo[]; error?: string | null };
    if (result.error) throw new Error(result.error);
    const data = result?.data;
    repos = Array.isArray(data) ? data : (data?.items ?? []);
  } catch (err) {
    const errMsg = `Composio GitHub list-repos failed: ${
      err instanceof Error ? err.message : "unknown"
    }`;
    await cx.mutation(api.templates.finishSync, {
      run_id: runId as never,
      lock_token: lockToken,
      count_seen: 0,
      count_inserted: 0,
      count_skipped: 0,
      error: errMsg,
    });
    return Response.json({ error: errMsg }, { status: 502 });
  }

  // Upsert each non-archived repo as a candidate. Idempotent — repos
  // already linked to a real template or already on the candidates
  // table are no-ops on the mutation side. Use the unauth Convex client
  // on the cron path (no operator identity); use the auth-forwarded
  // helper on the manual path.
  let inserted = 0;
  let skipped = 0;
  for (const r of repos) {
    if (r.archived) {
      skipped++;
      continue;
    }
    if (!r.full_name || !r.name) {
      skipped++;
      continue;
    }
    try {
      const args = {
        github_repo: r.full_name,
        name: r.name,
        description: r.description ?? undefined,
      };
      const res = cron
        ? ((await cx.mutation(
            api.templates.upsertGithubCandidate,
            args,
          )) as { id: string | null; inserted: boolean })
        : ((await fetchAuthMutation(
            api.templates.upsertGithubCandidate,
            args,
          )) as { id: string | null; inserted: boolean });
      if (res.inserted) inserted++;
      else skipped++;
    } catch (err) {
      console.error("[templates/sync-github] upsert failed:", err);
      skipped++;
    }
  }

  // Close the sync run
  await cx.mutation(api.templates.finishSync, {
    run_id: runId as never,
    lock_token: lockToken,
    count_seen: repos.length,
    count_inserted: inserted,
    count_skipped: skipped,
  });

  return Response.json({ ok: true, found: repos.length, inserted, skipped });
}

/**
 * Vercel cron invokes as GET. Only allow cron-authenticated calls
 * through the GET verb to avoid CSRF on a state-changing endpoint.
 */
export async function GET(req: Request) {
  if (!isVercelCron(req)) {
    return Response.json({ error: "GET only allowed for cron" }, { status: 405 });
  }
  return POST(req);
}
