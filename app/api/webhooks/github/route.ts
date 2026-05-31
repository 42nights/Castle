import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

async function verifySignature(
  req: Request,
  body: string,
): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return false;
  const sig = req.headers.get("x-hub-signature-256");
  if (!sig) return false;

  // Length pre-check: constant-time compare on obviously-wrong lengths
  // leaks nothing but saves CPU for blatant junk.
  if (!sig.startsWith("sha256=")) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected =
    "sha256=" +
    Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // Use constant-time comparison to prevent timing attacks
  const { timingSafeEqual } = await import("node:crypto");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  // Length check first (non-timing-sensitive for different-length strings)
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

function convexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
}

type RepoPayload = {
  action: string;
  repository: {
    id?: number;
    name: string;
    full_name: string;
    description?: string | null;
    archived?: boolean;
  };
};

export async function POST(req: Request) {
  const body = await req.text();

  if (!(await verifySignature(req, body))) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");

  if (event === "ping") {
    return Response.json({ ok: true, event: "ping" });
  }

  if (event !== "repository") {
    return Response.json({ ok: true, skipped: event });
  }

  const payload = JSON.parse(body) as RepoPayload;
  const repo = payload.repository;

  const cx = convexClient();
  if (!cx) {
    return Response.json(
      { error: "NEXT_PUBLIC_CONVEX_URL not set" },
      { status: 500 },
    );
  }

  if (payload.action === "created") {
    if (repo.archived) {
      return Response.json({ ok: true, skipped: "archived" });
    }
    const res = (await cx.mutation(api.templates.upsertGithubCandidate, {
      github_repo: repo.full_name,
      name: repo.name,
      description: repo.description ?? undefined,
    })) as { id: string | null; inserted: boolean };
    return Response.json({ ok: true, inserted: res.inserted });
  }

  if (payload.action === "renamed") {
    // Update any candidate whose github_repo matches the old full_name.
    // The old full_name is the canonical key in the table.
    // GitHub renames preserve the repo id but change full_name.
    // We match by the old full_name (lowercased) from the pre-rename payload.
    // GitHub sends `changes.repository.name.from` + the new repo.full_name.
    const renamedPayload = payload as RepoPayload & {
      changes?: { repository?: { name?: { from?: string } } };
    };
    const oldName = renamedPayload.changes?.repository?.name?.from;
    const oldFullName = oldName
      ? `${repo.full_name.split("/")[0]}/${oldName}`.toLowerCase()
      : null;
    if (oldFullName) {
      await cx.mutation(api.templates.renameGithubCandidate, {
        old_github_repo: oldFullName,
        new_github_repo: repo.full_name.toLowerCase(),
        new_name: repo.name,
      });
    }
    return Response.json({ ok: true, action: "renamed" });
  }

  if (payload.action === "archived") {
    // Flip the matching candidate to dismissed
    await cx.mutation(api.templates.archiveGithubCandidate, {
      github_repo: repo.full_name.toLowerCase(),
    });
    return Response.json({ ok: true, action: "archived" });
  }

  if (payload.action === "transferred") {
    // Remove the candidate — the repo moved outside the org
    await cx.mutation(api.templates.removeGithubCandidate, {
      github_repo: repo.full_name.toLowerCase(),
    });
    return Response.json({ ok: true, action: "transferred" });
  }

  return Response.json({ ok: true, skipped: payload.action });
}
