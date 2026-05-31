/**
 * Workflow run engine.
 *
 * runWorkflow(def, ctx) executes steps in order, threading a `bindings`
 * object. Returns { markdown, structured, steps } — the caller persists
 * the result to Convex (workflow_runs + daily_digests).
 *
 * Step kinds:
 *   mcp_call — calls a stub / real MCP tool
 *   llm       — calls the LLM router (Anthropic or fixture fallback)
 *   transform — applies a named pure-JS transform (NO eval)
 *   output    — produces the final artifact
 *
 * await_confirmation is typed but stubbed: the demo does not need it.
 */
import { WorkflowDefinition } from "./schema";
import type {
  WorkflowDefinitionT,
  WorkflowStepT,
  DigestOutcomeT,
} from "./schema";
import { callLlm } from "./llm";
import { callMcpTool } from "./mcp-stub";

// ── Bindings interpolation ────────────────────────────────────────────────────

/**
 * Walk `value` and replace {{key}} / {{key.path}} placeholders with the
 * corresponding value from `bindings`. Throws if a referenced key is missing.
 */
export function renderBindings(
  value: unknown,
  bindings: Record<string, unknown>,
): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const parts = path.trim().split(".");
      let cur: unknown = bindings;
      for (const p of parts) {
        if (cur == null || typeof cur !== "object") {
          throw new Error(
            `Binding '${path}' not found (stopped at '${p}')`,
          );
        }
        cur = (cur as Record<string, unknown>)[p];
      }
      if (cur === undefined) {
        throw new Error(`Binding '{{${path}}}' is undefined`);
      }
      if (typeof cur === "string") return cur;
      return JSON.stringify(cur);
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => renderBindings(v, bindings));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = renderBindings(v, bindings);
    }
    return out;
  }
  return value;
}

// ── Named transform registry (NO eval) ──────────────────────────────────────

type TransformFn = (bindings: Record<string, unknown>) => unknown;

const TRANSFORM_REGISTRY: Record<string, TransformFn> = {
  /** Extract just the event times from a calendar array. */
  extract_event_times: (b) => {
    const cal = b["calendar"];
    if (!Array.isArray(cal)) return [];
    return cal.map((e: Record<string, unknown>) => e["time"]);
  },
  /** Filter reminders to today-only (due today or overdue). */
  filter_today_reminders: (b) => {
    const reminders = b["reminders"];
    if (!Array.isArray(reminders)) return [];
    const today = new Date().toISOString().slice(0, 10);
    return (reminders as Array<Record<string, unknown>>).filter(
      (r) => typeof r["due"] === "string" && r["due"] <= today,
    );
  },
  /** Count how many items are in a binding array. */
  count_array: (b) => {
    const arr = b["target"];
    return Array.isArray(arr) ? arr.length : 0;
  },
};

function applyTransform(
  expression: string,
  bindings: Record<string, unknown>,
): unknown {
  const fn = TRANSFORM_REGISTRY[expression];
  if (!fn) {
    throw new Error(
      `Unknown transform '${expression}'. Valid transforms: ${Object.keys(TRANSFORM_REGISTRY).join(", ")}`,
    );
  }
  return fn(bindings);
}

// ── Step trace ───────────────────────────────────────────────────────────────

export interface StepTrace {
  name: string;
  kind: string;
  start: string;
  end: string;
  ok: boolean;
  error?: string;
}

// ── Run result ───────────────────────────────────────────────────────────────

export interface DigestResult {
  markdown: string;
  structured: Record<string, unknown>;
  steps: StepTrace[];
}

// ── Run context ──────────────────────────────────────────────────────────────

export interface RunContext {
  user_id: string;
  user_name?: string;
  castle_actor?: string;
  today?: string; // YYYY-MM-DD, defaults to system date
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function runWorkflow(
  def: WorkflowDefinitionT,
  ctx: RunContext,
): Promise<DigestResult> {
  // Validate definition before running
  const parsed = WorkflowDefinition.safeParse(def);
  if (!parsed.success) {
    throw new Error(`Invalid workflow definition: ${parsed.error.message}`);
  }

  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const todayStart = `${today}T00:00:00Z`;
  const todayEnd = `${today}T23:59:59Z`;
  const todayPlus24h = new Date(new Date(todayEnd).getTime() + 86400000)
    .toISOString()
    .slice(0, 10);

  const bindings: Record<string, unknown> = {
    __user__: ctx.user_id,
    __user_name__: ctx.user_name ?? "Ayaan",
    __castle_actor__: ctx.castle_actor ?? "ayaan",
    __today__: today,
    __today_start__: todayStart,
    __today_end__: todayEnd,
    __today_plus_24h__: `${todayPlus24h}T23:59:59Z`,
  };

  const steps: StepTrace[] = [];
  let digestResult: DigestResult | null = null;

  for (const step of parsed.data.steps) {
    const trace: StepTrace = {
      name: step.name,
      kind: step.kind,
      start: new Date().toISOString(),
      end: "",
      ok: false,
    };

    try {
      await executeStep(step, bindings);
      trace.ok = true;

      // Capture digest output when we see an output step with type=digest
      if (step.kind === "output" && step.outcome.type === "digest") {
        const outcome = step.outcome as DigestOutcomeT;
        const md = bindings[outcome.body_md.replace(/\{\{|\}\}/g, "").trim()];
        const resolvedMd =
          typeof md === "string"
            ? md
            : (renderBindings(outcome.body_md, bindings) as string);
        const resolvedStructured = renderBindings(
          outcome.structured,
          bindings,
        ) as Record<string, unknown>;
        digestResult = {
          markdown: resolvedMd,
          structured: resolvedStructured,
          steps,
        };
      }
    } catch (err) {
      trace.error = String(err);
      const hasContinue =
        "continue_on_error" in step && step.continue_on_error;
      if (!hasContinue) {
        trace.end = new Date().toISOString();
        steps.push(trace);
        throw err;
      }
    } finally {
      trace.end = new Date().toISOString();
      steps.push(trace);
    }
  }

  if (!digestResult) {
    // Workflow had no digest output step — return whatever brief_md ended up as
    const md = bindings["brief_md"];
    return {
      markdown: typeof md === "string" ? md : "[no digest output]",
      structured: {},
      steps,
    };
  }

  return { ...digestResult, steps };
}

async function executeStep(
  step: WorkflowStepT,
  bindings: Record<string, unknown>,
): Promise<void> {
  if (step.kind === "mcp_call") {
    const renderedArgs = renderBindings(
      step.args,
      bindings,
    ) as Record<string, unknown>;
    const result = await callMcpTool(step.tool, renderedArgs);
    if (step.save_as) {
      bindings[step.save_as] = result;
    }
    return;
  }

  if (step.kind === "llm") {
    const renderedPrompt = renderBindings(step.prompt, bindings) as string;
    const text = await callLlm({ prompt: renderedPrompt, model: step.model, bindings });
    const result = step.output_schema_json
      ? parseStructuredOutput(text, step.output_schema_json)
      : text;
    if (step.save_as) {
      bindings[step.save_as] = result;
    }
    return;
  }

  if (step.kind === "transform") {
    const result = applyTransform(step.expression, bindings);
    bindings[step.save_as ?? step.name] = result;
    return;
  }

  if (step.kind === "await_confirmation") {
    // Stubbed for demo — treat as no-op (auto-confirm).
    return;
  }

  if (step.kind === "output") {
    const outcome = step.outcome;
    if (outcome.type === "digest") {
      // body_md and structured may use {{binding}} references — resolve them.
      // The resolved values are captured in runWorkflow above.
      const mdKey = outcome.body_md.match(/^\{\{([^}]+)\}\}$/)?.[1];
      if (mdKey && bindings[mdKey] === undefined) {
        throw new Error(
          `output step references '${outcome.body_md}' but binding '${mdKey}' is not set`,
        );
      }
    }
    // Other outcome types (email_draft, calendar_event, reminder) are
    // post-demo; they would emit to Convex here.
    return;
  }
}

function parseStructuredOutput(text: string, _schema: string): unknown {
  // Best-effort JSON parse — extract a JSON array or object from the text
  const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!match) return text;
  try {
    return JSON.parse(match[0]);
  } catch {
    return text;
  }
}
