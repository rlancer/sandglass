import type { ActorAnimName } from "./actor";
import type { Player } from "./player";
import type { Guard } from "./level";

type Sheet = {
  img: HTMLImageElement;
  ready: boolean;
};

type ActivePack = {
  model: string;
  slug: string;
  label?: string;
};

const cache = new Map<string, Sheet>();
let bootstrapped = false;
let activeSlug = "openai-gpt-image-1";
let activeModel = "openai/gpt-image-1";
const BASE = import.meta.env.BASE_URL;

function load(path: string): Sheet {
  const existing = cache.get(path);
  if (existing) return existing;
  const img = new Image();
  const sheet: Sheet = { img, ready: false };
  img.onload = () => {
    sheet.ready = true;
  };
  img.onerror = () => {
    sheet.ready = false;
  };
  img.src = path;
  cache.set(path, sheet);
  return sheet;
}

function spriteUrl(name: string): string {
  // Prefer model-scoped path; fall back to legacy sprites/ready/
  return `${BASE}sprites/models/${activeSlug}/${name}.png`;
}

const SPRITE_NAMES = [
  "prince_idle",
  "prince_walk",
  "prince_crouch",
  "prince_jump",
  "prince_leap",
  "prince_fall",
  "prince_land",
  "prince_hang",
  "prince_climb",
  "prince_fight",
  "prince_strike",
  "prince_hurt",
  "prince_die",
  "prince_pickup",
  "prince_run_0",
  "prince_run_1",
  "prince_run_2",
  "prince_run_3",
  "prince_run_4",
  "prince_run_5",
  "guard_idle",
  "guard_walk",
  "guard_fight",
  "guard_strike",
  "guard_hurt",
  "guard_die",
];

/** Prefetch active model pack (reads /sprites/active.json). */
export function preloadSprites() {
  if (bootstrapped) return;
  bootstrapped = true;

  void fetch(`${BASE}sprites/active.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: ActivePack | null) => {
      if (j?.slug) {
        activeSlug = j.slug;
        activeModel = j.model || activeModel;
      }
      for (const n of SPRITE_NAMES) load(spriteUrl(n));
    })
    .catch(() => {
      for (const n of SPRITE_NAMES) load(spriteUrl(n));
    });
}

export function getActiveSpritePack(): { slug: string; model: string } {
  return { slug: activeSlug, model: activeModel };
}

function princePath(anim: ActorAnimName, runPhase: number): string {
  switch (anim) {
    case "run": {
      const frame = Math.floor((((runPhase % 1) + 1) % 1) * 6) % 6;
      return spriteUrl(`prince_run_${frame}`);
    }
    case "walk":
      return spriteUrl("prince_walk");
    case "crouch":
      return spriteUrl("prince_crouch");
    case "jump":
      return spriteUrl("prince_leap");
    case "fall":
      return spriteUrl("prince_fall");
    case "land":
      return spriteUrl("prince_land");
    case "hang":
      return spriteUrl("prince_hang");
    case "climb":
      return spriteUrl("prince_climb");
    case "fight":
      return spriteUrl("prince_fight");
    case "strike":
      return spriteUrl("prince_strike");
    case "hurt":
      return spriteUrl("prince_hurt");
    case "die":
      return spriteUrl("prince_die");
    case "pickup":
      return spriteUrl("prince_pickup");
    case "idle":
    default:
      return spriteUrl("prince_idle");
  }
}

function guardPath(anim: string): string {
  switch (anim) {
    case "advance":
    case "retreat":
      return spriteUrl("guard_walk");
    case "strike":
      return spriteUrl("guard_strike");
    case "hurt":
      return spriteUrl("guard_hurt");
    case "die":
      return spriteUrl("guard_die");
    case "idle":
    default:
      return spriteUrl("guard_fight");
  }
}

const DRAW_H = 78;

function drawSheet(
  ctx: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  facing: number,
): boolean {
  const sheet = load(path);
  // Also try legacy path once if model path missing
  if (!sheet.ready) {
    const legacy = path.replace(
      `${BASE}sprites/models/${activeSlug}/`,
      `${BASE}sprites/ready/`,
    );
    if (legacy !== path) {
      const alt = load(legacy);
      if (!alt.ready) return false;
      return drawLoaded(ctx, alt, x, y, facing);
    }
    return false;
  }
  return drawLoaded(ctx, sheet, x, y, facing);
}

function drawLoaded(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  x: number,
  y: number,
  facing: number,
): boolean {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const aspect = sheet.img.width / sheet.img.height;
  const h = DRAW_H;
  const w = h * aspect;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sheet.img, -w / 2, -h + 2, w, h);
  ctx.restore();
  return true;
}

export function drawPrinceSprite(
  ctx: CanvasRenderingContext2D,
  player: Player,
): boolean {
  const path = princePath(player.anim as ActorAnimName, player.runPhase);
  return drawSheet(ctx, path, player.x, player.y, player.facing);
}

export function drawGuardSprite(ctx: CanvasRenderingContext2D, g: Guard): boolean {
  return drawSheet(ctx, guardPath(g.anim), g.x, g.y, g.facing);
}
