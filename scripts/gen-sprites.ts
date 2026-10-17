/**
 * Generate sprites into benchmark/models/<model-slug>/raw/
 *
 *   bun run sprites:gen -- --model openai/gpt-image-1
 *   bun run sprites:gen -- --model google/gemini-2.5-flash-image --label try2
 *   FORCE=1 bun run sprites:gen -- --model openai/gpt-image-1
 */
import { writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import {
  ensureModelDirs,
  loadEnv,
  loadPoseJobs,
  loadPromptBlocks,
  parseArgs,
  readManifest,
  resolvePack,
  writeManifest,
  type Manifest,
} from "./lib/bench";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error("OPENROUTER_API_KEY missing — add it to .env");

const { model: MODEL, slug: SLUG, label } = resolvePack(args);
if (!MODEL.includes("/") && !args.slug && !args.run) {
  // allow continuing if user passed a bare slug as --model by mistake
}
const FORCE = !!args.force || !!process.env.FORCE;

const prompts = loadPromptBlocks();
const jobs = loadPoseJobs();
const base = ensureModelDirs(SLUG);
const rawDir = join(base, "raw");

const now = new Date().toISOString();
const prev = readManifest(SLUG);
const manifest: Manifest = {
  slug: SLUG,
  model: MODEL,
  label,
  provider: "openrouter",
  createdAt: prev?.createdAt ?? now,
  updatedAt: now,
  promptFile: "PROMPT.md",
  posesFile: "benchmark/poses.json",
  paths: {
    root: `benchmark/models/${SLUG}`,
    raw: `benchmark/models/${SLUG}/raw`,
    ready: `benchmark/models/${SLUG}/ready`,
    public: `public/sprites/models/${SLUG}`,
  },
  files: { ...(prev?.files ?? {}) },
  notes: prev?.notes,
};

async function generate(prompt: string, aspect: string): Promise<Buffer> {
  const body: Record<string, unknown> = {
    model: MODEL,
    prompt,
    aspect_ratio: aspect,
  };
  if (MODEL.includes("gpt-image")) {
    body.quality = "high";
    body.background = "transparent";
  }

  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://localhost/sandglass-benchmark",
      "X-Title": "Sandglass Sprite Benchmark",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) {
    const img = await fetch(item.url);
    if (!img.ok) throw new Error(`Download failed ${img.status}`);
    return Buffer.from(await img.arrayBuffer());
  }
  throw new Error("No image data in response");
}

console.log(`Model pack:  ${SLUG}`);
console.log(`Model:       ${MODEL}`);
if (label) console.log(`Label:       ${label}`);
console.log(`Folder:      benchmark/models/${SLUG}/`);
console.log(`Prompt:      PROMPT.md`);
console.log(`Force:       ${FORCE}`);

let ok = 0;
let fail = 0;
let skip = 0;

for (const job of jobs) {
  const dest = join(rawDir, job.file);
  const basePrompt = job.character === "prince" ? prompts.prince : prompts.guard;
  const prompt = `${basePrompt} Pose: ${job.pose}.`;

  if (existsSync(dest) && !FORCE) {
    console.log(`skip ${job.file}`);
    manifest.files[job.file] = { status: "skip" };
    skip++;
    continue;
  }

  const aspect = MODEL.includes("gpt-image") ? "2:3" : "1:1";
  process.stdout.write(`gen  ${job.file} ... `);
  try {
    const buf = await generate(prompt, aspect);
    await writeFile(dest, buf);
    console.log(`${buf.length}b`);
    manifest.files[job.file] = { status: "ok", bytes: buf.length };
    ok++;
  } catch (e) {
    const msg = String(e).slice(0, 280);
    console.log("FAIL");
    console.error(msg);
    manifest.files[job.file] = { status: "fail", error: msg };
    fail++;
  }
  writeManifest(manifest);
}

writeManifest(manifest);
console.log(`done ok=${ok} fail=${fail} skip=${skip}`);
console.log(`Next: bun run sprites:process -- --model ${MODEL}${label ? ` --label ${label}` : ""}`);
console.log(`Then: bun run sprites:activate -- --model ${MODEL}${label ? ` --label ${label}` : ""}`);
