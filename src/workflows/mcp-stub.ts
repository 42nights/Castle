/**
 * Stub MCP tool dispatcher. Returns realistic fixture data so the workflow
 * engine produces a coherent morning brief without live API connections.
 *
 * Data is intentionally aligned with Castle's seed customers (Acme Corp,
 * Helio) so the demo brief references real-looking context.
 */

type ToolResult = unknown;

export async function callMcpTool(
  tool: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (tool) {
    case "google_calendar.list_events":
      return fixtureCalendar(args);
    case "list_open_reminders":
      return fixtureReminders();
    case "gmail.list_messages":
      return fixtureGmail(args);
    case "castle.list_attention":
      return fixtureCastleAttention();
    default:
      // Unknown tool — return empty result (continue_on_error handles it)
      return null;
  }
}

function fixtureCalendar(_: Record<string, unknown>) {
  return [
    {
      time: "09:30",
      title: "Standup",
      with: "internal — Ayaan, Idan, Jerry",
      attendees: ["ayaan@42nights.dev", "idan@42nights.dev"],
      external: false,
    },
    {
      time: "11:00",
      title: "Acme Corp pricing call",
      with: "external — Jane Liu, CFO",
      attendees: ["jane.liu@acme.com"],
      external: true,
    },
    {
      time: "14:00",
      title: "Helio data-room demo",
      with: "Tier-1 customer",
      attendees: ["sarah@helio.ai"],
      external: true,
    },
    {
      time: "16:30",
      title: "Investor catch-up — Susa Ventures",
      with: "Marc Liu",
      attendees: ["marc@susa.vc"],
      external: true,
    },
  ];
}

function fixtureReminders() {
  return [
    {
      title: "Acme pricing reply",
      due: new Date().toISOString().slice(0, 10),
      context: "Follow up on the Q3 pricing deck Jane requested",
    },
    {
      title: "Helio quarterly check-in",
      due: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      context: "Sarah asked for the quarterly numbers last week",
    },
    {
      title: "Reply to Marc's seed-extension thread",
      due: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      context: "Marc sent a note about the extension terms on May 28",
    },
    {
      title: "Invoice follow-up — Zeta Labs",
      due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      context: "Net-30 invoice sent on May 20",
    },
  ];
}

function fixtureGmail(args: Record<string, unknown>) {
  const query = String(args["query"] ?? "");
  if (query.includes("in:sent")) {
    return [
      {
        subject: "Re: Acme pricing deck — Q3",
        from: "Ayaan <ayaan@42nights.dev>",
        to: "jane.liu@acme.com",
        snippet: "Attaching the updated Q3 pricing deck. Let me know...",
      },
    ];
  }
  // starred unread
  return [
    {
      subject: "Re: data-room benchmarks",
      from: "Sarah at Helio <sarah@helio.ai>",
      tldr: "1 ask (share raw eval numbers), 1 yes-please (wants a call slot next week)",
    },
    {
      subject: "Susa: thoughts on your latest",
      from: "Marc Liu <marc@susa.vc>",
      tldr: "Thread continues — Marc saw the product demo recording and wants to talk post-YC",
    },
    {
      subject: "Anthropic: org tier update",
      from: "billing@anthropic.com",
      tldr: "Org tier bumped to Team, needs billing confirmation before June 5",
    },
  ];
}

function fixtureCastleAttention() {
  return [
    {
      icon: "🔴",
      text: "Helio engagement is red (last touched 18 days ago)",
      severity: "critical",
    },
    {
      icon: "🟡",
      text: "FDE utilization: Jerry at 47h (over 40h cap)",
      severity: "high",
    },
  ];
}
