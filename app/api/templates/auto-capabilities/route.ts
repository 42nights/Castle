import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { fetchAuthMutation, fetchAuthQuery } from "@/lib/auth-server";
import { composio } from "@/lib/composio";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  template_id: z.string().min(1),
  github_repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  actor_fde_id: z.string().nullable(),
});

const Output = z.object({
  capabilities: z
    .array(z.string().min(2).max(80))
    .min(3)
    .max(8)
    .describe(
      "Short, action-oriented capabilities the template provides. 3-6 words each, title case-ish, focus on what the system does for the user.",
    ),
});

/**
 * Generate template capabilities from a repo's README + root file
 * listing using Anthropic. Capabilities are inserted via the same
 * mutation as manual edits, so reordering and editing afterward works
 * exactly the same. Best-effort — fails fast if README is missing.
 */
export async function POST(req: Request) {
  let me: { email?: string; isOperator?: boolean } | null = null;
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

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: `bad request: ${err instanceof Error ? err.message : "invalid"}` },
      { status: 400 },
    );
  }

  const c = composio();
  if (!c) {
    return Response.json({ error: "COMPOSIO_API_KEY not set" }, { status: 500 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const composioActor =
    process.env.CASTLE_SYSTEM_ACTOR_SLUG ||
    (me?.email?.split("@")[0]?.toLowerCase() ?? null);
  if (!composioActor) {
    return Response.json(
      { error: "no GitHub actor resolvable — connect GitHub or set CASTLE_SYSTEM_ACTOR_SLUG" },
      { status: 400 },
    );
  }

  const [owner, repo] = body.github_repo.split("/");

  // README is required — capabilities are derived from it.
  let readme: string;
  try {
    const res = (await c.tools.execute("GITHUB_GET_A_REPOSITORY_README", {
      userId: composioActor,
      arguments: { owner, repo },
      dangerouslySkipVersionCheck: true,
    })) as unknown as {
      data?: { content?: string; encoding?: string };
    };
    const content = res?.data?.content;
    if (!content) throw new Error("empty README content");
    readme = res.data?.encoding === "base64"
      ? Buffer.from(content, "base64").toString("utf8")
      : content;
  } catch (err) {
    return Response.json(
      {
        error: `failed to fetch README for ${body.github_repo}: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      },
      { status: 502 },
    );
  }

  // Best-effort: top-level repo listing gives the LLM a sense of
  // structure (frameworks, scripts, config). Don't fail if it errors.
  let rootListing = "";
  try {
    const res = (await c.tools.execute("GITHUB_GET_REPOSITORY_CONTENT", {
      userId: composioActor,
      arguments: { owner, repo, path: "" },
      dangerouslySkipVersionCheck: true,
    })) as unknown as {
      data?:
        | Array<{ name: string; type: string }>
        | { name: string; type: string };
    };
    const items = Array.isArray(res?.data) ? res.data : res?.data ? [res.data] : [];
    rootListing = items
      .map((i) => `${i.type === "dir" ? "[dir]" : "     "} ${i.name}`)
      .join("\n");
  } catch {
    // ignore
  }

  // Best-effort: package.json gives dependencies + scripts.
  let pkgJson = "";
  try {
    const res = (await c.tools.execute("GITHUB_GET_REPOSITORY_CONTENT", {
      userId: composioActor,
      arguments: { owner, repo, path: "package.json" },
      dangerouslySkipVersionCheck: true,
    })) as unknown as {
      data?: { content?: string; encoding?: string };
    };
    const content = res?.data?.content;
    if (content) {
      pkgJson = res.data?.encoding === "base64"
        ? Buffer.from(content, "base64").toString("utf8")
        : content;
    }
  } catch {
    // ignore
  }

  // Truncate aggressively — large READMEs would blow context with no
  // benefit. The first ~12k chars cover intro + features for any
  // reasonable README.
  const truncatedReadme = readme.slice(0, 12000);
  const truncatedPkg = pkgJson.slice(0, 3000);

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: Output,
    system:
      "You distill GitHub repos into a small list of capabilities for an internal template catalog. Each capability is a short noun phrase or imperative — 3 to 6 words, title-ish case, focused on what the system DOES, not how. Examples of the right tone: 'Scrape Git Repo Stargazers', 'Graphql batch fetch emails', 'Generate Personalized Cold Emails'. Avoid generic platitudes like 'Easy to use' or 'Production ready'.",
    prompt: [
      `Repository: ${body.github_repo}`,
      "",
      "─── README ───",
      truncatedReadme,
      "",
      rootListing ? `─── Root tree ───\n${rootListing}` : "",
      truncatedPkg ? `─── package.json ───\n${truncatedPkg}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const inserted: string[] = [];
  for (const cap of object.capabilities) {
    try {
      await fetchAuthMutation(api.templates.addCapability, {
        template_id: body.template_id as never,
        body: cap,
        actor_fde_id: body.actor_fde_id as never,
      });
      inserted.push(cap);
    } catch (err) {
      console.error("[auto-capabilities] addCapability failed:", err);
    }
  }

  return Response.json({ ok: true, inserted });
}
