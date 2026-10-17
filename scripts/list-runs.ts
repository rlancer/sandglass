/**
 * List benchmark runs and which is active.
 */
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { getActiveRunId, listRuns, readManifest, runDir } from "./lib/bench";

const active = getActiveRunId();
const runs = listRuns();

if (!runs.length) {
  console.log("No runs yet. Generate with:");
  console.log("  bun run sprites:gen -- --model openai/gpt-image-1");
  process.exit(0);
}

console.log("Benchmark runs:\n");
for (const id of runs) {
  const m = readManifest(id);
  const ready = join(runDir(id), "ready");
  const readyCount = existsSync(ready)
    ? readdirSync(ready).filter((f) => f.endsWith(".png")).length
    : 0;
  const mark = id === active ? "*" : " ";
  const model = m?.model ?? "?";
  const ok = m
    ? Object.values(m.files).filter((f) => f.status === "ok").length
    : 0;
  const fail = m
    ? Object.values(m.files).filter((f) => f.status === "fail").length
    : 0;
  console.log(`${mark} ${id}`);
  console.log(`    model: ${model}`);
  console.log(`    raw ok/fail: ${ok}/${fail}   ready pngs: ${readyCount}`);
  if (m?.updatedAt) console.log(`    updated: ${m.updatedAt}`);
  console.log("");
}
console.log("* = active (loaded by the game)");
