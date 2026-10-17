/**
 * List model packs under benchmark/models/
 */
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { getActive, listModels, modelDir, readManifest } from "./lib/bench";

const active = getActive();
const models = listModels();

if (!models.length) {
  console.log("No model packs yet. Generate with:");
  console.log("  bun run sprites:gen -- --model openai/gpt-image-1");
  process.exit(0);
}

console.log("Model packs (benchmark/models/<slug>/):\n");
for (const slug of models) {
  const m = readManifest(slug);
  const ready = join(modelDir(slug), "ready");
  const raw = join(modelDir(slug), "raw");
  const readyCount = existsSync(ready)
    ? readdirSync(ready).filter((f) => f.endsWith(".png")).length
    : 0;
  const rawCount = existsSync(raw)
    ? readdirSync(raw).filter((f) => f.endsWith(".png")).length
    : 0;
  const mark = slug === active.slug ? "*" : " ";
  console.log(`${mark} ${slug}`);
  console.log(`    model:  ${m?.model ?? "?"}`);
  if (m?.label) console.log(`    label:  ${m.label}`);
  console.log(`    raw:    ${rawCount} pngs`);
  console.log(`    ready:  ${readyCount} pngs`);
  if (m?.updatedAt) console.log(`    updated:${m.updatedAt}`);
  console.log("");
}
console.log(`* = active → public/sprites/models/${active.slug}/`);
