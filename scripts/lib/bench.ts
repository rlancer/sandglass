import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  cpSync,
  writeFileSync,
  rmSync,
} from "fs";
import { join } from "path";

export const ROOT = join(import.meta.dir, "..", "..");
export const BENCH = join(ROOT, "benchmark");
export const MODELS_DIR = join(BENCH, "models");
export const PROMPT_PATH = join(ROOT, "PROMPT.md");
export const POSES_PATH = join(BENCH, "poses.json");
export const ACTIVE_PATH = join(BENCH, "active.json");
export const PUBLIC_SPRITES = join(ROOT, "public", "sprites");
export const PUBLIC_ACTIVE = join(PUBLIC_SPRITES, "active.json");

export type PoseJob = { file: string; pose: string; character: "prince" | "guard" };

export type ActivePack = {
  /** OpenRouter model id, e.g. openai/gpt-image-1 */
  model: string;
  /** Folder name under benchmark/models and public/sprites/models */
  slug: string;
  /** Optional variant label (second attempt, etc.) */
  label?: string;
  note?: string;
};

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

/** Folder id for a model (+ optional label for a second pack of the same model). */
export function packSlug(model: string, label?: string): string {
  const base = modelSlug(model);
  if (!label) return base;
  const lab = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return lab ? `${base}__${lab}` : base;
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

/**
 * Resolve which model pack folder to use from CLI / env.
 * Prefers --model; --slug or legacy --run can pin an exact folder.
 */
export function resolvePack(args: Record<string, string | boolean>): {
  model: string;
  slug: string;
  label?: string;
} {
  const slugArg =
    (typeof args.slug === "string" && args.slug) ||
    (typeof args.run === "string" && args.run) ||
    process.env.RUN_ID ||
    process.env.PACK_SLUG;

  const model =
    (typeof args.model === "string" && args.model) ||
    process.env.OPENROUTER_IMAGE_MODEL ||
    "";

  const label =
    (typeof args.label === "string" && args.label) ||
    process.env.PACK_LABEL ||
    undefined;

  if (slugArg && !model) {
    return { model: slugArg.replace(/__/g, "/"), slug: slugArg, label };
  }
  if (!model && !slugArg) {
    const active = getActive();
    return { model: active.model, slug: active.slug, label: active.label };
  }
  if (!model) throw new Error("Pass --model <openrouter-model-id>");
  return { model, slug: slugArg || packSlug(model, label), label };
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

export function modelDir(slug: string) {
  return join(MODELS_DIR, slug);
}

export function ensureModelDirs(slug: string) {
  const base = modelDir(slug);
  mkdirSync(join(base, "raw"), { recursive: true });
  mkdirSync(join(base, "ready"), { recursive: true });
  return base;
}

export type Manifest = {
  slug: string;
  model: string;
  label?: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  promptFile: string;
  posesFile: string;
  paths: {
    root: string;
    raw: string;
    ready: string;
    public: string;
  };
  files: Record<string, { status: "ok" | "fail" | "skip" | "missing"; bytes?: number; error?: string }>;
  notes?: string;
  /** @deprecated use slug */
  runId?: string;
};

export function readManifest(slug: string): Manifest | null {
  const p = join(modelDir(slug), "manifest.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Manifest;
}

export function writeManifest(m: Manifest) {
  const dir = ensureModelDirs(m.slug);
  const full: Manifest = {
    ...m,
    runId: m.slug,
    paths: {
      root: `benchmark/models/${m.slug}`,
      raw: `benchmark/models/${m.slug}/raw`,
      ready: `benchmark/models/${m.slug}/ready`,
      public: `public/sprites/models/${m.slug}`,
    },
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(full, null, 2) + "\n");
}

export function listModels(): string[] {
  if (!existsSync(MODELS_DIR)) return [];
  return readdirSync(MODELS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function getActive(): ActivePack {
  if (!existsSync(ACTIVE_PATH)) {
    return {
      model: "openai/gpt-image-1",
      slug: "openai-gpt-image-1",
      note: "default baseline",
    };
  }
  const j = JSON.parse(readFileSync(ACTIVE_PATH, "utf8")) as ActivePack & {
    runId?: string;
  };
  // migrate old active.json shape
  if (!j.slug && j.runId) {
    return { model: j.model || j.runId, slug: j.runId, note: j.note };
  }
  return j;
}

export function setActive(pack: ActivePack) {
  const payload: ActivePack = {
    model: pack.model,
    slug: pack.slug,
    label: pack.label,
    note: pack.note ?? "Active model pack for the game",
  };
  writeFileSync(ACTIVE_PATH, JSON.stringify(payload, null, 2) + "\n");
  mkdirSync(PUBLIC_SPRITES, { recursive: true });
  writeFileSync(PUBLIC_ACTIVE, JSON.stringify(payload, null, 2) + "\n");
}

/** Copy model ready/ → public/sprites/models/<slug>/ and mark active */
export function activateModel(slug: string, model?: string, label?: string) {
  const src = join(modelDir(slug), "ready");
  if (!existsSync(src)) {
    throw new Error(`No ready sprites at ${src} — run: bun run sprites:process -- --model <model>`);
  }
  const dest = join(PUBLIC_SPRITES, "models", slug);
  mkdirSync(join(PUBLIC_SPRITES, "models"), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });

  const manifest = readManifest(slug);
  setActive({
    model: model || manifest?.model || slug,
    slug,
    label: label || manifest?.label,
  });

  // Keep legacy public/sprites/ready in sync for old paths
  const legacy = join(PUBLIC_SPRITES, "ready");
  if (existsSync(legacy)) rmSync(legacy, { recursive: true, force: true });
  cpSync(src, legacy, { recursive: true });
}
