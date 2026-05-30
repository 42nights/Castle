import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

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

export default crons;
