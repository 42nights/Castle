/**
 * LLM step runner. Calls Anthropic when ANTHROPIC_API_KEY is present;
 * otherwise falls back to a deterministic template string derived from
 * the bindings. The fallback is explicit and not hidden as "AI output".
 */

export interface LlmCallOptions {
  prompt: string;
  model?: string;
  bindings: Record<string, unknown>;
}

export async function callLlm(opts: LlmCallOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mode = process.env.INFERENCE_MODE ?? (apiKey ? "cloud" : "fixture");

  if (mode === "cloud" && apiKey) {
    return callAnthropic(opts.prompt, opts.model ?? "claude-opus-4-5", apiKey);
  }

  // Deterministic fixture mode — compose a digest from bindings without AI.
  return buildFixtureResponse(opts.prompt, opts.bindings);
}

async function callAnthropic(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${body}`);
  }
  const data = (await resp.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content.find((b) => b.type === "text")?.text ?? "";
  return text;
}

/**
 * Fixture response: inspects the step name hints embedded in the prompt
 * to choose which canned response to return. Safe for demo — never
 * claims to be AI-generated when running in fixture mode.
 */
function buildFixtureResponse(
  prompt: string,
  bindings: Record<string, unknown>,
): string {
  // people_research step: return a JSON array of fixture people
  if (prompt.includes("one-paragraph") || prompt.includes("who they are")) {
    return JSON.stringify([
      {
        name: "Jane Liu",
        summary:
          "CFO at Acme Corp since 2024, previously VP Finance at Stripe. Spoke at FinTechCon 2025 on usage-based pricing. Focused on aligning finance with product-led growth motions.",
        links: ["https://linkedin.com/in/jane-liu-acme"],
      },
      {
        name: "Marc Liu",
        summary:
          "Partner at Susa Ventures, led Ayaan's seed round. Posted yesterday about the agent company wave and the need for durable data models. Worth referencing in the investor catch-up.",
        links: ["https://linkedin.com/in/marc-liu-susa"],
      },
    ]);
  }

  // render_brief step: compose a full morning brief markdown
  if (
    prompt.includes("morning brief") ||
    prompt.includes("Compose a morning brief")
  ) {
    const calendar = bindings["calendar"];
    const reminders = bindings["reminders"];
    const starred = bindings["starred"];
    const castleAttention = bindings["castle_attention"];
    const people = bindings["people"];

    return buildMorningBriefMarkdown({
      calendar,
      reminders,
      starred,
      castleAttention,
      people,
    });
  }

  // Generic fallback — render bindings summary
  return `[fixture] Processed step with ${Object.keys(bindings).length} binding(s).`;
}

function buildMorningBriefMarkdown(data: {
  calendar: unknown;
  reminders: unknown;
  starred: unknown;
  castleAttention: unknown;
  people: unknown;
}): string {
  const today = new Date();
  const dayStr = today.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Calendar section — use fixture data if data.calendar is an array
  const calEvents = Array.isArray(data.calendar)
    ? (data.calendar as Array<{ time: string; title: string; with: string }>)
    : [];
  const calLines = calEvents
    .map((e) => `- ${e.time}  ${e.title} (${e.with})`)
    .join("\n");

  // People section — may arrive as a JSON string if the research step
  // stored the raw LLM text rather than a parsed array
  let rawPeople = data.people;
  if (typeof rawPeople === "string") {
    try {
      rawPeople = JSON.parse(rawPeople);
    } catch {
      rawPeople = [];
    }
  }
  const peopleArr = Array.isArray(rawPeople)
    ? (rawPeople as Array<{
        name: string;
        summary: string;
        links?: string[];
      }>)
    : [];
  const peopleLines = peopleArr
    .map((p) => {
      const link = p.links?.[0] ? ` [LinkedIn](${p.links[0]})` : "";
      return `- *${p.name}.* ${p.summary}${link}`;
    })
    .join("\n");

  // Reminders section
  const reminderArr = Array.isArray(data.reminders)
    ? (data.reminders as Array<{ title: string; due: string }>)
    : [];
  const reminderLines = reminderArr
    .map((r) => `- *${r.title}* due ${r.due}`)
    .join("\n");

  // Starred email section
  const starredArr = Array.isArray(data.starred)
    ? (data.starred as Array<{ subject: string; from: string; tldr: string }>)
    : [];
  const starredLines = starredArr
    .map((s) => `- "${s.subject}" from ${s.from} — ${s.tldr}`)
    .join("\n");

  // Castle attention section
  const attArr = Array.isArray(data.castleAttention)
    ? (data.castleAttention as Array<{ icon: string; text: string }>)
    : [];
  const attLines = attArr.map((a) => `- ${a.icon} ${a.text}`).join("\n");

  return [
    `# Morning brief — ${dayStr}`,
    "",
    `**Calendar (${calEvents.length} events)**`,
    calLines || "- No events today",
    "",
    peopleArr.length > 0
      ? `**People you're meeting**\n${peopleLines}`
      : null,
    peopleArr.length > 0 ? "" : null,
    `**Open follow-ups (${reminderArr.length})**`,
    reminderLines || "- None due today",
    "",
    `**Starred unread (${starredArr.length})**`,
    starredLines || "- Nothing starred",
    "",
    `**Castle**`,
    attLines || "- No open attention items",
  ]
    .filter((l) => l !== null)
    .join("\n");
}
