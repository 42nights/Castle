import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// Sweep stuck / unaccepted agent turns. Keeps the UI from sitting
// forever on a row whose wrapper died. See `agentTurns.sweepStuck`
// for the thresholds.
crons.interval(
  "agent-turns-stuck-sweep",
  { seconds: 60 },
  api.agentTurns.sweepStuck,
  {},
);

// P30: Reap zombie turns (running with no heartbeat for 5min).
// Runs every 1 minute, separate from sweepStuck so thresholds stay clean.
crons.interval(
  "agent-turns-zombie-reaper",
  { seconds: 60 },
  internal.agentTurns.reapZombies,
  {},
);

// P30: Delete agent_message_chunks for turns completed >7 days ago.
// Chunks are redundant once text is snapshotted into agent_messages.text.
crons.interval(
  "agent-chunks-reaper",
  { hours: 1 },
  internal.agentMessageChunks.reapOldChunks,
  {},
);

export default crons;
