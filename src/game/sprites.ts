import type { ActorAnimName } from "./actor";
import type { Player } from "./player";
import type { Guard } from "./level";

type Sheet = {
  img: HTMLImageElement;
  ready: boolean;
};

const cache = new Map<string, Sheet>();
let bootstrapped = false;

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

/** Prefetch all gameplay sprites */
export function preloadSprites() {
  if (bootstrapped) return;
  bootstrapped = true;
  const names = [
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
  for (const n of names) load(`/sprites/ready/${n}.png`);
}

function princePath(anim: ActorAnimName, runPhase: number): string {
  switch (anim) {
    case "run": {
      const frame = Math.floor((((runPhase % 1) + 1) % 1) * 6) % 6;
      return `/sprites/ready/prince_run_${frame}.png`;
    }
    case "walk":
      return "/sprites/ready/prince_walk.png";
    case "crouch":
      return "/sprites/ready/prince_crouch.png";
    case "jump":
      return "/sprites/ready/prince_leap.png";
    case "fall":
      return "/sprites/ready/prince_fall.png";
    case "land":
      return "/sprites/ready/prince_land.png";
    case "hang":
      return "/sprites/ready/prince_hang.png";
    case "climb":
      return "/sprites/ready/prince_climb.png";
    case "fight":
      return "/sprites/ready/prince_fight.png";
    case "strike":
      return "/sprites/ready/prince_strike.png";
    case "hurt":
      return "/sprites/ready/prince_hurt.png";
    case "die":
      return "/sprites/ready/prince_die.png";
    case "pickup":
      return "/sprites/ready/prince_pickup.png";
    case "idle":
    default:
      return "/sprites/ready/prince_idle.png";
  }
}

function guardPath(anim: string): string {
  switch (anim) {
    case "advance":
    case "retreat":
      return "/sprites/ready/guard_walk.png";
    case "strike":
      return "/sprites/ready/guard_strike.png";
    case "hurt":
      return "/sprites/ready/guard_hurt.png";
    case "die":
      return "/sprites/ready/guard_die.png";
    case "idle":
    default:
      return "/sprites/ready/guard_fight.png";
  }
}

const DRAW_H = 78;

export function drawPrinceSprite(
  ctx: CanvasRenderingContext2D,
  player: Player,
): boolean {
  const path = princePath(player.anim as ActorAnimName, player.runPhase);
  const sheet = load(path);
  if (!sheet.ready) return false;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(player.facing, 1);

  // Soft contact shadow
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

export function drawGuardSprite(ctx: CanvasRenderingContext2D, g: Guard): boolean {
  const path = guardPath(g.anim);
  const sheet = load(path);
  if (!sheet.ready) return false;

  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(g.facing, 1);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const aspect = sheet.img.width / sheet.img.height;
  const h = DRAW_H;
  const w = h * aspect;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sheet.img, -w / 2, -h + 2, w, h);
  ctx.restore();
  return true;
}
