import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("./**/*.{ts,js}");

function setup() {
  return convexTest(schema, modules);
}

describe("deploymentEvents", () => {
  it("record + listByDeployment returns newest-first and recentCountByDeployment === 3", async () => {
    const t = setup();
    const depId = "dep_abc123";

    await t.mutation(api.deploymentEvents.record, {
      deployment_id: depId,
      kind: "session_started",
      payload: JSON.stringify({ kind: "session_started", ts: "2026-05-31T10:00:00Z" }),
    });
    // Small delay so ISO timestamps are distinct
    await new Promise((r) => setTimeout(r, 5));
    await t.mutation(api.deploymentEvents.record, {
      deployment_id: depId,
      kind: "heartbeat",
      payload: JSON.stringify({ kind: "heartbeat", ts: "2026-05-31T10:01:00Z" }),
    });
    await new Promise((r) => setTimeout(r, 5));
    await t.mutation(api.deploymentEvents.record, {
      deployment_id: depId,
      kind: "session_ended",
      payload: JSON.stringify({ kind: "session_ended", ts: "2026-05-31T10:02:00Z" }),
    });

    const rows = await t.query(api.deploymentEvents.listByDeployment, {
      deployment_id: depId,
    });
    expect(rows).toHaveLength(3);
    // newest first
    expect(rows[0].kind).toBe("session_ended");
    expect(rows[1].kind).toBe("heartbeat");
    expect(rows[2].kind).toBe("session_started");

    const count = await t.query(api.deploymentEvents.recentCountByDeployment, {
      deployment_id: depId,
    });
    expect(count).toBe(3);
  });

  it("listByDeployment respects limit", async () => {
    const t = setup();
    const depId = "dep_limit_test";

    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 5));
      await t.mutation(api.deploymentEvents.record, {
        deployment_id: depId,
        kind: "scan_started",
        payload: JSON.stringify({ kind: "scan_started", i }),
      });
    }

    const rows = await t.query(api.deploymentEvents.listByDeployment, {
      deployment_id: depId,
      limit: 2,
    });
    expect(rows).toHaveLength(2);
  });

  it("events for different deployment_ids are isolated", async () => {
    const t = setup();

    await t.mutation(api.deploymentEvents.record, {
      deployment_id: "dep_A",
      kind: "wiki_generated",
      payload: JSON.stringify({ kind: "wiki_generated" }),
    });
    await t.mutation(api.deploymentEvents.record, {
      deployment_id: "dep_B",
      kind: "crawl_completed",
      payload: JSON.stringify({ kind: "crawl_completed" }),
    });

    const aRows = await t.query(api.deploymentEvents.listByDeployment, {
      deployment_id: "dep_A",
    });
    const bRows = await t.query(api.deploymentEvents.listByDeployment, {
      deployment_id: "dep_B",
    });
    expect(aRows).toHaveLength(1);
    expect(aRows[0].kind).toBe("wiki_generated");
    expect(bRows).toHaveLength(1);
    expect(bRows[0].kind).toBe("crawl_completed");
  });
});
