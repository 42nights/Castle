export const runtime = "nodejs";

/**
 * Catch-all stub for `/api/agent/*`. Returns 404 until the Convex HTTP
 * action proxy is wired. Kept as a valid Next route so the path exists.
 */
async function handler(_req: Request) {
  return new Response("Not found", { status: 404 });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
