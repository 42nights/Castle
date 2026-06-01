import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: deploymentId } = await params;

  // Secret verification. If CASTLE_WEBHOOK_SECRET is unset we allow the
  // request through — local-first posture: no secret configured = open.
  // In production this MUST be set so only trusted emitters can write.
  const secret = process.env.CASTLE_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers.get("x-castle-secret");
    if (header !== secret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).kind !== "string"
  ) {
    return Response.json({ error: "missing required field: kind" }, { status: 400 });
  }

  const kind = (body as Record<string, unknown>).kind as string;

  await fetchMutation(api.deploymentEvents.record, {
    deployment_id: deploymentId,
    kind,
    payload: JSON.stringify(body),
  });

  return Response.json({ ok: true });
}
