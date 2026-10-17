/**
 * Activate a benchmark run into the game (public/sprites/ready).
 *
 *   bun run sprites:activate -- --run openai-gpt-image-1
 */
import { activateRun, getActiveRunId, parseArgs } from "./lib/bench";

const args = parseArgs(process.argv.slice(2));
const runId =
  (typeof args.run === "string" && args.run) ||
  process.env.RUN_ID ||
  getActiveRunId();

activateRun(runId);
console.log(`Active run → ${runId}`);
console.log(`Copied to public/sprites/ready`);
