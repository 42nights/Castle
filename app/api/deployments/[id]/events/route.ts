import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: deploymentId } = await params;

  // Secret verification — fail closed. If CASTLE_WEBHOOK_SECRET is unset the
  // receiver refuses all writes (503) rather than silently accepting forged
  // events. When set, only emitters presenting the matching header pass (401
  // otherwise). This must be configured in every environment that accepts
  // deployment events.
  const secret = process.env.CASTLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[deployments/events] CASTLE_WEBHOOK_SECRET unset — rejecting webhook",
    );
    return Response.json({ error: "receiver not configured" }, { status: 503 });
  }
  if (req.headers.get("x-castle-secret") !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
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
