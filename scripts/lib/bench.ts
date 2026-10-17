import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  cpSync,
  writeFileSync,
  unlinkSync,
} from "fs";
import { join } from "path";

export const ROOT = join(import.meta.dir, "..", "..");
export const BENCH = join(ROOT, "benchmark");
export const PROMPT_PATH = join(ROOT, "PROMPT.md");
export const POSES_PATH = join(BENCH, "poses.json");
export const ACTIVE_PATH = join(BENCH, "active.json");
export const PUBLIC_READY = join(ROOT, "public", "sprites", "ready");

export type PoseJob = { file: string; pose: string; character: "prince" | "guard" };

export function loadEnv() {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]!]) process.env[m[1]!] = v;
  }
}

export function modelSlug(model: string): string {
  return model
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") continue;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

export function extractBlock(md: string, name: string): string {
  const re = new RegExp(`<!--\\s*${name}\\s*-->([\\s\\S]*?)<!--\\s*/${name}\\s*-->`, "i");
  const m = md.match(re);
  if (!m) throw new Error(`Missing <!-- ${name} --> block in PROMPT.md`);
  return m[1]!.trim().replace(/\s+/g, " ");
}

export function loadPromptBlocks() {
  const md = readFileSync(PROMPT_PATH, "utf8");
  return {
    prince: extractBlock(md, "PRINCE"),
    guard: extractBlock(md, "GUARD"),
    promptPath: PROMPT_PATH,
  };
}

export function loadPoseJobs(): PoseJob[] {
  const data = JSON.parse(readFileSync(POSES_PATH, "utf8")) as {
    prince: { file: string; pose: string }[];
    guard: { file: string; pose: string }[];
  };
  return [
    ...data.prince.map((p) => ({ ...p, character: "prince" as const })),
    ...data.guard.map((p) => ({ ...p, character: "guard" as const })),
  ];
}

export function runDir(runId: string) {
  return join(BENCH, "runs", runId);
}

export function ensureRunDirs(runId: string) {
  const base = runDir(runId);
  mkdirSync(join(base, "raw"), { recursive: true });
  mkdirSync(join(base, "ready"), { recursive: true });
  return base;
}

export type Manifest = {
  runId: string;
  model: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  promptFile: string;
  posesFile: string;
  files: Record<string, { status: "ok" | "fail" | "skip" | "missing"; bytes?: number; error?: string }>;
  notes?: string;
};

export function readManifest(runId: string): Manifest | null {
  const p = join(runDir(runId), "manifest.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Manifest;
}

export function writeManifest(m: Manifest) {
  const dir = ensureRunDirs(m.runId);
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
}

export function listRuns(): string[] {
  const runs = join(BENCH, "runs");
  if (!existsSync(runs)) return [];
  return readdirSync(runs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function getActiveRunId(): string {
  if (!existsSync(ACTIVE_PATH)) return "openai-gpt-image-1";
  const j = JSON.parse(readFileSync(ACTIVE_PATH, "utf8")) as { runId: string };
  return j.runId;
}

export function setActiveRunId(runId: string) {
  writeFileSync(
    ACTIVE_PATH,
    JSON.stringify(
      { runId, note: "Active pack served to the game via public/sprites/ready" },
      null,
      2,
    ) + "\n",
  );
}

/** Copy run ready/ → public/sprites/ready */
export function activateRun(runId: string) {
  const src = join(runDir(runId), "ready");
  if (!existsSync(src)) throw new Error(`No ready sprites at ${src} — run sprites:process first`);
  mkdirSync(PUBLIC_READY, { recursive: true });
  for (const f of readdirSync(PUBLIC_READY)) {
    if (f.endsWith(".png")) unlinkSync(join(PUBLIC_READY, f));
  }
  cpSync(src, PUBLIC_READY, { recursive: true });
  setActiveRunId(runId);
}
