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

  return sig === expected;
}

function convexClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
}

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

  const payload = JSON.parse(body) as {
    action: string;
    repository: {
      name: string;
      full_name: string;
      description?: string | null;
      archived?: boolean;
    };
  };

  if (payload.action !== "created") {
    return Response.json({ ok: true, skipped: payload.action });
  }

  const repo = payload.repository;
  if (repo.archived) {
    return Response.json({ ok: true, skipped: "archived" });
  }

  const cx = convexClient();
  if (!cx) {
    return Response.json(
      { error: "NEXT_PUBLIC_CONVEX_URL not set" },
      { status: 500 },
    );
  }

  const res = (await cx.mutation(api.templates.upsertGithubCandidate, {
    github_repo: repo.full_name,
    name: repo.name,
    description: repo.description ?? undefined,
  })) as { id: string | null; inserted: boolean };

  return Response.json({ ok: true, inserted: res.inserted });
}
