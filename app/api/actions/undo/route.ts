import { api } from "@/convex/_generated/api";
import { fetchAuthMutation } from "@/lib/auth-server";

export const runtime = "nodejs";
export const maxDuration = 15;

type UndoBody = { actionId: string };

export async function POST(req: Request) {
  const body = (await req.json()) as UndoBody;
  if (!body.actionId) {
    return Response.json({ error: "actionId required" }, { status: 400 });
  }
  try {
    const result = await fetchAuthMutation(api.agentActions.undo, {
      action_id: body.actionId as never,
    });
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "undo failed";
    const status = /unauth/i.test(msg)
      ? 401
      : /forbidden/i.test(msg)
        ? 403
        : /not found/i.test(msg)
          ? 404
          : 500;
    console.error("[actions/undo] mutation failed:", err);
    return Response.json({ error: msg }, { status });
  }
}
