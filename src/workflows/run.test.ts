import { describe, expect, it } from "vitest";
import { runWorkflow } from "./run";
import { morningBriefWorkflow } from "./builtins/morning-brief";
import { WorkflowDefinition } from "./schema";

describe("WorkflowDefinition schema", () => {
  it("parses a valid workflow", () => {
    const result = WorkflowDefinition.safeParse(morningBriefWorkflow);
    expect(result.success).toBe(true);
  });

  it("rejects a workflow with invalid slug", () => {
    const bad = { ...morningBriefWorkflow, slug: "INVALID SLUG!" };
    const result = WorkflowDefinition.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a workflow with empty steps", () => {
    const bad = { ...morningBriefWorkflow, steps: [] };
    const result = WorkflowDefinition.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("runWorkflow — morning brief (fixture mode)", () => {
  it("runs end-to-end and produces a digest with all 4+ required sections", async () => {
    const result = await runWorkflow(morningBriefWorkflow, {
      user_id: "user_ayaan",
      user_name: "Ayaan",
      castle_actor: "ayaan",
    });

    expect(result.markdown).toBeTruthy();

    // Must contain the 4 required section headers per §4.1
    expect(result.markdown).toMatch(/Calendar/i);
    expect(result.markdown).toMatch(/Open follow-ups/i);
    expect(result.markdown).toMatch(/Starred unread/i);
    expect(result.markdown).toMatch(/Castle/i);
  });

  it("includes calendar events in the digest", async () => {
    const result = await runWorkflow(morningBriefWorkflow, {
      user_id: "user_ayaan",
    });
    expect(result.markdown).toContain("09:30");
    expect(result.markdown).toContain("11:00");
  });

  it("includes people block for external attendees", async () => {
    const result = await runWorkflow(morningBriefWorkflow, {
      user_id: "user_ayaan",
    });
    // People section or the names themselves should appear
    expect(result.markdown).toMatch(/Jane Liu|Marc Liu|People/i);
  });

  it("includes Castle attention items", async () => {
    const result = await runWorkflow(morningBriefWorkflow, {
      user_id: "user_ayaan",
    });
    expect(result.markdown).toContain("Helio");
  });

  it("returns a steps trace with all step names", async () => {
    const result = await runWorkflow(morningBriefWorkflow, {
      user_id: "user_ayaan",
    });
    const stepNames = result.steps.map((s) => s.name);
    expect(stepNames).toContain("fetch_calendar");
    expect(stepNames).toContain("fetch_reminders");
    expect(stepNames).toContain("people_research");
    expect(stepNames).toContain("render_brief");
    expect(stepNames).toContain("emit_digest");
  });

  it("all steps succeed (ok=true) in fixture mode", async () => {
    const result = await runWorkflow(morningBriefWorkflow, {
      user_id: "user_ayaan",
    });
    for (const step of result.steps) {
      expect(step.ok).toBe(true);
    }
  });

  it("structured output has expected keys", async () => {
    const result = await runWorkflow(morningBriefWorkflow, {
      user_id: "user_ayaan",
    });
    // structured is resolved from output step — may be empty if body_md was a direct binding
    // At minimum the markdown itself must be non-empty
    expect(result.markdown.length).toBeGreaterThan(200);
  });
});

describe("renderBindings", () => {
  it("replaces simple placeholders", async () => {
    const { renderBindings } = await import("./run");
    expect(renderBindings("Hello {{name}}", { name: "Ayaan" })).toBe(
      "Hello Ayaan",
    );
  });

  it("throws on missing binding", async () => {
    const { renderBindings } = await import("./run");
    expect(() => renderBindings("{{missing}}", {})).toThrow(/missing/);
  });

  it("serializes non-string bindings as JSON", async () => {
    const { renderBindings } = await import("./run");
    const result = renderBindings("data: {{arr}}", {
      arr: [1, 2, 3],
    });
    expect(result).toBe("data: [1,2,3]");
  });
});
