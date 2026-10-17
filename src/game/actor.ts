/**
 * Rotoscope-inspired actor renderer.
 * Joint poses mimic filmed human weight — contact, pass, flight — not stick figures.
 */

export type Pt = { x: number; y: number };

/** Local space: (0,0) = ground contact under stance, Y+ down (canvas). */
export interface Pose {
  hip: Pt;
  /** torso top / neck base */
  neck: Pt;
  head: Pt;
  lHip: Pt;
  lKnee: Pt;
  lFoot: Pt;
  rHip: Pt;
  rKnee: Pt;
  rFoot: Pt;
  lShoulder: Pt;
  lElbow: Pt;
  lHand: Pt;
  rShoulder: Pt;
  rElbow: Pt;
  rHand: Pt;
  /** optional sword tip beyond rHand */
  sword?: Pt;
  /** squash body slightly */
  crouch?: number;
}

export type ActorPalette = {
  skin: string;
  skinShade: string;
  cloth: string;
  clothShade: string;
  sash: string;
  hair: string;
  boot: string;
  metal: string;
  outline: string;
};

export const PRINCE_PALETTE: ActorPalette = {
  skin: "#e6c8a0",
  skinShade: "#c4a07a",
  cloth: "#2c3f5c",
  clothShade: "#1a283c",
  sash: "#d4a01a",
  hair: "#1a1410",
  boot: "#3a2a1c",
  metal: "#d8dde8",
  outline: "rgba(8,10,16,0.75)",
};

export const GUARD_PALETTE: ActorPalette = {
  skin: "#d4b090",
  skinShade: "#b08868",
  cloth: "#6b2424",
  clothShade: "#3e1414",
  sash: "#1a1a1a",
  hair: "#2a2a2e",
  boot: "#2a2218",
  metal: "#c0c6d0",
  outline: "rgba(8,10,16,0.8)",
};

function p(x: number, y: number): Pt {
  return { x, y };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const t2 = t * t * (3 - 2 * t); // smoothstep — less robotic
  const out: Pose = {
    hip: lerpPt(a.hip, b.hip, t2),
    neck: lerpPt(a.neck, b.neck, t2),
    head: lerpPt(a.head, b.head, t2),
    lHip: lerpPt(a.lHip, b.lHip, t2),
    lKnee: lerpPt(a.lKnee, b.lKnee, t2),
    lFoot: lerpPt(a.lFoot, b.lFoot, t2),
    rHip: lerpPt(a.rHip, b.rHip, t2),
    rKnee: lerpPt(a.rKnee, b.rKnee, t2),
    rFoot: lerpPt(a.rFoot, b.rFoot, t2),
    lShoulder: lerpPt(a.lShoulder, b.lShoulder, t2),
    lElbow: lerpPt(a.lElbow, b.lElbow, t2),
    lHand: lerpPt(a.lHand, b.lHand, t2),
    rShoulder: lerpPt(a.rShoulder, b.rShoulder, t2),
    rElbow: lerpPt(a.rElbow, b.rElbow, t2),
    rHand: lerpPt(a.rHand, b.rHand, t2),
  };
  if (a.sword || b.sword) {
    out.sword = lerpPt(a.sword ?? a.rHand, b.sword ?? b.rHand, t2);
  }
  return out;
}

function sampleCycle(frames: Pose[], phase: number): Pose {
  const n = frames.length;
  const u = ((phase % 1) + 1) % 1;
  const f = u * n;
  const i = Math.floor(f) % n;
  const j = (i + 1) % n;
  return lerpPose(frames[i]!, frames[j]!, f - i);
}

/** Build a standing base, then mutate — keeps proportions consistent */
function baseStand(): Pose {
  return {
    hip: p(0, -26),
    neck: p(1, -48),
    head: p(2, -58),
    lHip: p(-5, -26),
    lKnee: p(-7, -12),
    lFoot: p(-9, 0),
    rHip: p(5, -26),
    rKnee: p(6, -12),
    rFoot: p(8, 0),
    lShoulder: p(-8, -44),
    lElbow: p(-12, -32),
    lHand: p(-11, -20),
    rShoulder: p(9, -44),
    rElbow: p(13, -32),
    rHand: p(12, -20),
  };
}

// ── Idle: weight shift + breath ──────────────────────────────────
const IDLE_A = (() => {
  const q = baseStand();
  q.hip = p(-1, -26);
  q.neck = p(0, -48);
  q.head = p(1, -58);
  return q;
})();
const IDLE_B = (() => {
  const q = baseStand();
  q.hip = p(1, -25.5);
  q.neck = p(2, -47.5);
  q.head = p(3, -57.2);
  q.lHand = p(-10, -19);
  q.rHand = p(13, -21);
  return q;
})();

// ── Run: 8-frame rotoscope-style cycle (contact → pass → flight) ─
function runFrame(
  hipX: number,
  hipY: number,
  lFoot: Pt,
  lKnee: Pt,
  rFoot: Pt,
  rKnee: Pt,
  lHand: Pt,
  rHand: Pt,
  lean = 4,
): Pose {
  const hip = p(hipX, hipY);
  return {
    hip,
    neck: p(hipX + lean * 0.4, hipY - 22),
    head: p(hipX + lean * 0.55, hipY - 32),
    lHip: p(hipX - 4, hipY),
    lKnee,
    lFoot,
    rHip: p(hipX + 4, hipY),
    rKnee,
    rFoot,
    lShoulder: p(hipX - 7 + lean * 0.2, hipY - 18),
    lElbow: p((lHand.x + hipX - 7) / 2, (lHand.y + hipY - 10) / 2),
    lHand,
    rShoulder: p(hipX + 8 + lean * 0.2, hipY - 18),
    rElbow: p((rHand.x + hipX + 8) / 2, (rHand.y + hipY - 10) / 2),
    rHand,
  };
}

const RUN: Pose[] = [
  // 0 contact R
  runFrame(2, -28, p(-14, -2), p(-8, -14), p(16, 0), p(10, -10), p(14, -18), p(-10, -22), 5),
  // 1
  runFrame(3, -30, p(-10, -8), p(-6, -18), p(12, -1), p(8, -12), p(12, -14), p(-12, -26), 6),
  // 2 pass
  runFrame(2, -32, p(-2, -14), p(0, -22), p(4, -6), p(4, -16), p(6, -12), p(-8, -28), 6),
  // 3 flight L forward
  runFrame(1, -31, p(12, -4), p(6, -16), p(-8, -10), p(-4, -20), p(-6, -16), p(10, -24), 5),
  // 4 contact L
  runFrame(2, -28, p(16, 0), p(10, -10), p(-14, -2), p(-8, -14), p(-10, -22), p(14, -18), 5),
  // 5
  runFrame(3, -30, p(12, -1), p(8, -12), p(-10, -8), p(-6, -18), p(-12, -26), p(12, -14), 6),
  // 6 pass
  runFrame(2, -32, p(4, -6), p(4, -16), p(-2, -14), p(0, -22), p(-8, -28), p(6, -12), 6),
  // 7 flight R forward
  runFrame(1, -31, p(-8, -10), p(-4, -20), p(12, -4), p(6, -16), p(10, -24), p(-6, -16), 5),
];

// ── Walk: slower, smaller stride ─────────────────────────────────
const WALK: Pose[] = [
  runFrame(1, -27, p(-10, 0), p(-6, -12), p(10, 0), p(6, -12), p(8, -22), p(-6, -20), 2),
  runFrame(1, -28, p(-4, -2), p(-2, -14), p(6, -1), p(4, -13), p(4, -20), p(-4, -22), 2),
  runFrame(1, -27, p(10, 0), p(6, -12), p(-10, 0), p(-6, -12), p(-6, -20), p(8, -22), 2),
  runFrame(1, -28, p(6, -1), p(4, -13), p(-4, -2), p(-2, -14), p(-4, -22), p(4, -20), 2),
];

const JUMP_UP: Pose = {
  hip: p(0, -34),
  neck: p(1, -54),
  head: p(2, -64),
  lHip: p(-4, -34),
  lKnee: p(-8, -22),
  lFoot: p(-6, -12),
  rHip: p(4, -34),
  rKnee: p(10, -24),
  rFoot: p(8, -14),
  lShoulder: p(-6, -50),
  lElbow: p(-8, -62),
  lHand: p(-6, -72),
  rShoulder: p(8, -50),
  rElbow: p(10, -62),
  rHand: p(8, -72),
};

const JUMP_FWD: Pose = {
  hip: p(4, -36),
  neck: p(8, -54),
  head: p(10, -64),
  lHip: p(0, -36),
  lKnee: p(-6, -28),
  lFoot: p(-14, -22),
  rHip: p(8, -36),
  rKnee: p(18, -28),
  rFoot: p(22, -18),
  lShoulder: p(2, -50),
  lElbow: p(-4, -42),
  lHand: p(-10, -36),
  rShoulder: p(14, -48),
  rElbow: p(22, -40),
  rHand: p(28, -34),
};

const FALL: Pose = {
  hip: p(0, -30),
  neck: p(0, -50),
  head: p(1, -60),
  lHip: p(-5, -30),
  lKnee: p(-8, -16),
  lFoot: p(-4, -4),
  rHip: p(5, -30),
  rKnee: p(10, -18),
  rFoot: p(6, -6),
  lShoulder: p(-10, -46),
  lElbow: p(-16, -38),
  lHand: p(-18, -28),
  rShoulder: p(10, -46),
  rElbow: p(16, -38),
  rHand: p(18, -28),
};

const LAND: Pose = {
  hip: p(0, -18),
  neck: p(2, -36),
  head: p(3, -46),
  lHip: p(-6, -18),
  lKnee: p(-10, -8),
  lFoot: p(-12, 0),
  rHip: p(6, -18),
  rKnee: p(10, -8),
  rFoot: p(12, 0),
  lShoulder: p(-8, -32),
  lElbow: p(-14, -24),
  lHand: p(-12, -14),
  rShoulder: p(10, -32),
  rElbow: p(14, -24),
  rHand: p(12, -14),
};

const CROUCH: Pose = {
  hip: p(0, -16),
  neck: p(3, -32),
  head: p(5, -42),
  lHip: p(-6, -16),
  lKnee: p(-12, -6),
  lFoot: p(-14, 0),
  rHip: p(6, -16),
  rKnee: p(12, -6),
  rFoot: p(14, 0),
  lShoulder: p(-6, -28),
  lElbow: p(-10, -20),
  lHand: p(-8, -12),
  rShoulder: p(10, -28),
  rElbow: p(14, -20),
  rHand: p(12, -12),
};

const HANG: Pose = {
  hip: p(0, 8),
  neck: p(0, -12),
  head: p(1, -22),
  lHip: p(-4, 8),
  lKnee: p(-6, 20),
  lFoot: p(-4, 32),
  rHip: p(4, 8),
  rKnee: p(8, 22),
  rFoot: p(6, 34),
  lShoulder: p(-8, -16),
  lElbow: p(-10, -28),
  lHand: p(-8, -40),
  rShoulder: p(8, -16),
  rElbow: p(10, -28),
  rHand: p(8, -40),
};

const CLIMB_A: Pose = {
  hip: p(2, 4),
  neck: p(4, -16),
  head: p(5, -26),
  lHip: p(-2, 4),
  lKnee: p(-4, 16),
  lFoot: p(2, 24),
  rHip: p(6, 4),
  rKnee: p(10, 14),
  rFoot: p(8, 26),
  lShoulder: p(-4, -18),
  lElbow: p(-6, -30),
  lHand: p(-2, -40),
  rShoulder: p(10, -14),
  rElbow: p(12, -26),
  rHand: p(14, -36),
};

const CLIMB_B: Pose = {
  hip: p(2, -2),
  neck: p(4, -22),
  head: p(5, -32),
  lHip: p(-2, -2),
  lKnee: p(2, 10),
  lFoot: p(0, 20),
  rHip: p(6, -2),
  rKnee: p(4, 12),
  rFoot: p(10, 18),
  lShoulder: p(-2, -20),
  lElbow: p(0, -32),
  lHand: p(4, -40),
  rShoulder: p(8, -22),
  rElbow: p(6, -34),
  rHand: p(2, -42),
};

const FIGHT: Pose = {
  hip: p(-2, -26),
  neck: p(2, -48),
  head: p(4, -58),
  lHip: p(-8, -26),
  lKnee: p(-14, -12),
  lFoot: p(-16, 0),
  rHip: p(4, -26),
  rKnee: p(12, -12),
  rFoot: p(14, 0),
  lShoulder: p(-6, -44),
  lElbow: p(-14, -36),
  lHand: p(-12, -26),
  rShoulder: p(12, -42),
  rElbow: p(24, -38),
  rHand: p(34, -36),
  sword: p(52, -40),
};

const STRIKE: Pose = {
  hip: p(4, -26),
  neck: p(8, -46),
  head: p(10, -56),
  lHip: p(-4, -26),
  lKnee: p(-10, -12),
  lFoot: p(-14, 0),
  rHip: p(8, -26),
  rKnee: p(14, -14),
  rFoot: p(10, 0),
  lShoulder: p(0, -42),
  lElbow: p(-8, -34),
  lHand: p(-6, -24),
  rShoulder: p(16, -40),
  rElbow: p(32, -44),
  rHand: p(46, -48),
  sword: p(68, -58),
};

const HURT: Pose = {
  hip: p(-4, -24),
  neck: p(-8, -44),
  head: p(-10, -54),
  lHip: p(-8, -24),
  lKnee: p(-6, -10),
  lFoot: p(-4, 0),
  rHip: p(0, -24),
  rKnee: p(4, -10),
  rFoot: p(8, 0),
  lShoulder: p(-12, -40),
  lElbow: p(-18, -32),
  lHand: p(-16, -22),
  rShoulder: p(-2, -40),
  rElbow: p(6, -34),
  rHand: p(10, -28),
};

const DIE: Pose = {
  hip: p(0, -8),
  neck: p(18, -10),
  head: p(28, -8),
  lHip: p(-4, -8),
  lKnee: p(-12, -4),
  lFoot: p(-20, 0),
  rHip: p(4, -8),
  rKnee: p(10, -2),
  rFoot: p(18, 0),
  lShoulder: p(10, -12),
  lElbow: p(4, -6),
  lHand: p(-2, 0),
  rShoulder: p(22, -12),
  rElbow: p(30, -6),
  rHand: p(36, 0),
};

const PICKUP: Pose = {
  hip: p(0, -20),
  neck: p(4, -38),
  head: p(6, -48),
  lHip: p(-5, -20),
  lKnee: p(-8, -8),
  lFoot: p(-10, 0),
  rHip: p(5, -20),
  rKnee: p(8, -8),
  rFoot: p(10, 0),
  lShoulder: p(-4, -34),
  lElbow: p(2, -22),
  lHand: p(8, -10),
  rShoulder: p(10, -34),
  rElbow: p(14, -22),
  rHand: p(12, -12),
};

export type ActorAnimName =
  | "idle"
  | "run"
  | "walk"
  | "jump"
  | "fall"
  | "land"
  | "hang"
  | "climb"
  | "crouch"
  | "fight"
  | "strike"
  | "hurt"
  | "die"
  | "pickup";

export function poseFor(
  anim: ActorAnimName,
  animT: number,
  opts: {
    runPhase?: number;
    strikeT?: number;
    hasSword?: boolean;
    vy?: number;
  } = {},
): Pose {
  let pose: Pose;
  switch (anim) {
    case "idle":
      pose = lerpPose(IDLE_A, IDLE_B, 0.5 + 0.5 * Math.sin(animT * 2.2));
      break;
    case "run":
      pose = sampleCycle(RUN, opts.runPhase ?? animT * 1.35);
      break;
    case "walk":
      pose = sampleCycle(WALK, opts.runPhase ?? animT * 0.7);
      break;
    case "jump":
      pose = (opts.vy ?? -1) < -2 ? JUMP_UP : JUMP_FWD;
      break;
    case "fall":
      pose = FALL;
      break;
    case "land":
      pose = LAND;
      break;
    case "hang":
      pose = HANG;
      break;
    case "climb":
      pose = lerpPose(CLIMB_A, CLIMB_B, 0.5 + 0.5 * Math.sin(animT * 10));
      break;
    case "crouch":
      pose = CROUCH;
      break;
    case "fight":
      pose = lerpPose(FIGHT, (() => {
        const q = { ...FIGHT, hip: p(-1, -26), rHand: p(32, -34), sword: p(50, -38) };
        return q;
      })(), 0.5 + 0.5 * Math.sin(animT * 3));
      break;
    case "strike": {
      const t = 1 - Math.min(1, (opts.strikeT ?? 0) / 0.28);
      pose = lerpPose(FIGHT, STRIKE, Math.min(1, t * 1.4));
      break;
    }
    case "hurt":
      pose = HURT;
      break;
    case "die":
      pose = lerpPose(HURT, DIE, Math.min(1, animT * 1.2));
      break;
    case "pickup":
      pose = PICKUP;
      break;
    default:
      pose = IDLE_A;
  }

  if (opts.hasSword && !pose.sword && (anim === "idle" || anim === "run" || anim === "walk" || anim === "crouch" || anim === "fight")) {
    pose = {
      ...clonePose(pose),
      sword: pose.sword ?? { x: pose.rHand.x + 18, y: pose.rHand.y - 2 },
    };
    if (anim === "idle" || anim === "run" || anim === "walk" || anim === "crouch") {
      pose.sword = { x: pose.rHand.x + 2, y: pose.rHand.y + 16 };
    }
  }
  return clonePose(pose);
}

function clonePose(pose: Pose): Pose {
  return {
    hip: { ...pose.hip },
    neck: { ...pose.neck },
    head: { ...pose.head },
    lHip: { ...pose.lHip },
    lKnee: { ...pose.lKnee },
    lFoot: { ...pose.lFoot },
    rHip: { ...pose.rHip },
    rKnee: { ...pose.rKnee },
    rFoot: { ...pose.rFoot },
    lShoulder: { ...pose.lShoulder },
    lElbow: { ...pose.lElbow },
    lHand: { ...pose.lHand },
    rShoulder: { ...pose.rShoulder },
    rElbow: { ...pose.rElbow },
    rHand: { ...pose.rHand },
    sword: pose.sword ? { ...pose.sword } : undefined,
  };
}

function limb(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  c: Pt,
  width: number,
  color: string,
  shade: string,
) {
  // Tapered filled limb via stroke + joint caps
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
  ctx.stroke();
  // Shade edge
  ctx.strokeStyle = shade;
  ctx.lineWidth = width * 0.35;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(a.x + 1, a.y);
  ctx.quadraticCurveTo(b.x + 1, b.y, c.x + 1, c.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function capsule(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, width: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

export function drawActor(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  palette: ActorPalette,
  opts: { helmet?: boolean; outline?: boolean } = {},
) {
  const o = opts.outline !== false;

  // Contact shadow — soft, stretched with stance width
  const footSpan = Math.abs(pose.lFoot.x - pose.rFoot.x) * 0.35 + 10;
  const grd = ctx.createRadialGradient(0, 1, 2, 0, 1, footSpan);
  grd.addColorStop(0, "rgba(0,0,0,0.4)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(0, 2, footSpan, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (o) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    // Silhouette pass (PoP CRT ink)
    ctx.strokeStyle = palette.outline;
    ctx.fillStyle = palette.outline;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokeSkeleton(ctx, pose, 7);
    ctx.restore();
  }

  // Legs (back then front by x for crude depth)
  const leftBack = pose.lFoot.x < pose.rFoot.x;
  const drawLeg = (hip: Pt, knee: Pt, foot: Pt) => {
    limb(ctx, hip, knee, foot, 6.5, palette.cloth, palette.clothShade);
    // Boot
    ctx.fillStyle = palette.boot;
    ctx.beginPath();
    ctx.ellipse(foot.x + 2, foot.y - 1, 6, 3.2, 0.1, 0, Math.PI * 2);
    ctx.fill();
  };
  if (leftBack) {
    drawLeg(pose.lHip, pose.lKnee, pose.lFoot);
    drawLeg(pose.rHip, pose.rKnee, pose.rFoot);
  } else {
    drawLeg(pose.rHip, pose.rKnee, pose.rFoot);
    drawLeg(pose.lHip, pose.lKnee, pose.lFoot);
  }

  // Torso — fleshy capsule with sash
  capsule(ctx, pose.hip, pose.neck, 13, palette.cloth);
  capsule(ctx, pose.hip, pose.neck, 9, palette.clothShade);
  // Vest highlight
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pose.hip.x - 2, pose.hip.y - 4);
  ctx.lineTo(pose.neck.x - 2, pose.neck.y + 4);
  ctx.stroke();
  // Sash wrap
  const sashY = (pose.hip.y + pose.neck.y) * 0.55;
  ctx.strokeStyle = palette.sash;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pose.hip.x - 7, sashY);
  ctx.lineTo(pose.hip.x + 8, sashY + 2);
  ctx.stroke();

  // Arms
  limb(ctx, pose.lShoulder, pose.lElbow, pose.lHand, 5, palette.skin, palette.skinShade);
  limb(ctx, pose.rShoulder, pose.rElbow, pose.rHand, 5, palette.skin, palette.skinShade);
  // Hands
  ctx.fillStyle = palette.skin;
  for (const h of [pose.lHand, pose.rHand]) {
    ctx.beginPath();
    ctx.arc(h.x, h.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sword
  if (pose.sword) {
    ctx.strokeStyle = palette.metal;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pose.rHand.x, pose.rHand.y);
    ctx.lineTo(pose.sword.x, pose.sword.y);
    ctx.stroke();
    // Guard
    const dx = pose.sword.x - pose.rHand.x;
    const dy = pose.sword.y - pose.rHand.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * 5;
    const py = (dx / len) * 5;
    const gx = pose.rHand.x + dx * 0.12;
    const gy = pose.rHand.y + dy * 0.12;
    ctx.strokeStyle = palette.sash;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx - px, gy - py);
    ctx.lineTo(gx + px, gy + py);
    ctx.stroke();
    // Tip gleam
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(pose.sword.x, pose.sword.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head
  const hx = pose.head.x;
  const hy = pose.head.y;
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 6.2, 7.2, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.skinShade;
  ctx.beginPath();
  ctx.ellipse(hx + 2.2, hy + 1, 2.8, 4, 0.2, 0, Math.PI * 2);
  ctx.fill();

  if (opts.helmet) {
    ctx.fillStyle = palette.metal;
    ctx.beginPath();
    ctx.ellipse(hx, hy - 2, 7, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(hx - 7, hy - 2, 14, 5);
    ctx.fillStyle = palette.clothShade;
    ctx.fillRect(hx - 7, hy + 2, 14, 3);
  } else {
    // Hair / soft turban
    ctx.fillStyle = palette.hair;
    ctx.beginPath();
    ctx.ellipse(hx - 0.5, hy - 3, 6.4, 5.2, -0.15, Math.PI * 1.05, Math.PI * 2.05);
    ctx.fill();
    ctx.fillStyle = palette.sash;
    ctx.fillRect(hx - 5.5, hy - 4, 11, 2.5);
  }

  // Eye glint (facing +X locally)
  ctx.fillStyle = "rgba(20,16,12,0.8)";
  ctx.beginPath();
  ctx.ellipse(hx + 2.5, hy - 0.5, 1.1, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(hx + 2.8, hy - 0.8, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function strokeSkeleton(ctx: CanvasRenderingContext2D, pose: Pose, w: number) {
  ctx.lineWidth = w;
  const segs: [Pt, Pt][] = [
    [pose.lHip, pose.lKnee],
    [pose.lKnee, pose.lFoot],
    [pose.rHip, pose.rKnee],
    [pose.rKnee, pose.rFoot],
    [pose.hip, pose.neck],
    [pose.lShoulder, pose.lElbow],
    [pose.lElbow, pose.lHand],
    [pose.rShoulder, pose.rElbow],
    [pose.rElbow, pose.rHand],
  ];
  for (const [a, b] of segs) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(pose.head.x, pose.head.y, 8, 0, Math.PI * 2);
  ctx.fill();
}
