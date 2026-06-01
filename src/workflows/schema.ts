/**
 * Workflow definition schema — Zod validators for the discriminated-union
 * step graph. Every built-in and user-authored workflow conforms to this.
 */
import { z } from "zod";

// ── Individual step kinds ────────────────────────────────────────────────────

export const McpCallStep = z.object({
  kind: z.literal("mcp_call"),
  name: z.string().min(1),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  save_as: z.string().optional(),
  continue_on_error: z.boolean().default(false),
});

export const LlmStep = z.object({
  kind: z.literal("llm"),
  name: z.string().min(1),
  prompt: z.string().min(1),
  model: z.string().optional(),
  save_as: z.string().optional(),
  output_schema_json: z.string().optional(),
});

export const TransformStep = z.object({
  kind: z.literal("transform"),
  name: z.string().min(1),
  // Named transform function key — NOT arbitrary eval. Must be a key in
  // the TRANSFORM_REGISTRY in run.ts.
  expression: z.string().min(1),
  save_as: z.string().optional(),
});

export const AwaitConfirmationStep = z.object({
  kind: z.literal("await_confirmation"),
  name: z.string().min(1),
  prompt: z.string().min(1),
  on_cancel_outcome: z.enum(["fail", "skip_rest"]).default("fail"),
});

// Output outcome types
export const DigestOutcome = z.object({
  type: z.literal("digest"),
  kind: z.string(),
  body_md: z.string(),
  structured: z.record(z.string(), z.unknown()),
});

export const ChatMessageOutcome = z.object({
  type: z.literal("chat_message"),
  body_md: z.string(),
});

export const ReminderOutcome = z.object({
  type: z.literal("reminder"),
  title: z.string(),
  due_at: z.string(),
  context: z.string().optional(),
});

export const EmailDraftOutcome = z.object({
  type: z.literal("email_draft"),
  to: z.array(z.string()),
  subject: z.string(),
  body_md: z.string(),
  send_immediately: z.boolean().default(false),
});

export const CalendarEventOutcome = z.object({
  type: z.literal("calendar_event"),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  attendees: z.array(z.string()).default([]),
});

export const OutputStep = z.object({
  kind: z.literal("output"),
  name: z.string().min(1),
  outcome: z.discriminatedUnion("type", [
    DigestOutcome,
    ChatMessageOutcome,
    ReminderOutcome,
    EmailDraftOutcome,
    CalendarEventOutcome,
  ]),
});

export const WorkflowStep = z.discriminatedUnion("kind", [
  McpCallStep,
  LlmStep,
  TransformStep,
  AwaitConfirmationStep,
  OutputStep,
]);

// ── Top-level workflow definition ────────────────────────────────────────────

export const InputFieldSchema = z.object({
  type: z.enum(["string", "number", "boolean", "date", "email", "url"]),
  description: z.string(),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
});

export const WorkflowDefinition = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/, {
    message: "slug must be lowercase alphanumeric+underscore, 3-41 chars",
  }),
  name: z.string().min(1),
  description: z.string(),
  version: z.string(),
  default_schedule_cron: z.string().optional(),
  inputs_schema: z.record(z.string(), InputFieldSchema).default({}),
  steps: z.array(WorkflowStep).min(1),
});

export type WorkflowDefinitionT = z.infer<typeof WorkflowDefinition>;
export type WorkflowStepT = z.infer<typeof WorkflowStep>;
export type McpCallStepT = z.infer<typeof McpCallStep>;
export type LlmStepT = z.infer<typeof LlmStep>;
export type TransformStepT = z.infer<typeof TransformStep>;
export type OutputStepT = z.infer<typeof OutputStep>;
export type DigestOutcomeT = z.infer<typeof DigestOutcome>;
