// Procedural "rotoscope" figures: keyframed joint angles, smooth interpolation,
// forward kinematics, automatic foot planting.
const THIGH = 16, SHIN = 16, TORSO = 20, UPPER = 11, FORE = 11, HEAD = 4.8;

const BASE = { hx: 0, hy: 0, lean: 0.05, hd: 0, lh: -0.08, lk: 0.08, rh: 0.1, rk: 0.06, la: -0.12, le: 0.25, ra: 0.12, re: 0.3, sw: 0, rot: 0, air: 0 };
const P = (o) => ({ ...BASE, ...o });
const mirror = (p) => ({ ...p, lh: p.rh, lk: p.rk, rh: p.lh, rk: p.lk, la: p.ra, le: p.re, ra: p.la, re: p.le });

const run1 = P({ lean: 0.26, rh: 0.65, rk: 0.25, lh: -0.55, lk: 1.1, ra: -0.7, re: 1.1, la: 0.75, le: 0.7, hy: 1 });
const run2 = P({ lean: 0.3, rh: 0.3, rk: 0.45, lh: -0.05, lk: 1.8, ra: -0.25, re: 1.2, la: 0.35, le: 0.9, hy: 3 });
const run3 = P({ lean: 0.28, rh: -0.45, rk: 0.35, lh: 0.85, lk: 1.4, ra: 0.6, re: 0.8, la: -0.6, le: 1.0, hy: -2, air: 0 });

const walk1 = P({ lean: 0.08, rh: 0.35, rk: 0.05, lh: -0.3, lk: 0.2, ra: -0.25, re: 0.35, la: 0.25, le: 0.3 });
const walk2 = P({ lean: 0.08, rh: 0.05, rk: 0.1, lh: 0.1, lk: 0.9, ra: -0.05, re: 0.35, la: 0.05, le: 0.3 });

const crouch = P({ lean: 0.45, rh: 1.3, rk: 2.4, lh: 0.95, lk: 2.3, ra: 0.6, re: 0.5, la: 0.3, le: 0.6, hd: 0.15 });

export const ANIMS = {
  stand: { frames: [P({}), P({ hy: 0.6, la: -0.1, ra: 0.1 })], loop: true, dur: 3 },
  run: { frames: [run1, run2, run3, mirror(run1), mirror(run2), mirror(run3)], loop: true },
  walk: { frames: [walk1, walk2, mirror(walk1), mirror(walk2)], loop: true },
  skid: { frames: [P({ lean: -0.35, rh: 0.7, rk: 0.2, lh: 0.2, lk: 0.9, ra: 0.9, re: 0.4, la: 0.6, le: 0.5 })], dur: 1 },
  crouch: { frames: [crouch], dur: 1 },
  land: { frames: [crouch, P({ lean: 0.25, rh: 0.6, rk: 1.0, lh: 0.4, lk: 1.0 }), P({})], dur: 1 },
  jumpPrep: { frames: [P({}), P({ lean: 0.35, rh: 0.8, rk: 1.4, lh: 0.5, lk: 1.4, ra: -0.6, re: 0.6, la: -0.8, le: 0.5 })], dur: 1 },
  jump: {
    frames: [
      P({ air: 1, lean: 0.2, rh: 1.0, rk: 0.3, lh: -0.6, lk: 0.6, ra: 2.4, re: 0.4, la: 2.0, le: 0.6 }),
      P({ air: 1, lean: 0.15, rh: 1.3, rk: 1.6, lh: 0.4, lk: 1.8, ra: 1.6, re: 0.8, la: 1.2, le: 1.0 }),
      P({ air: 1, lean: 0.05, rh: 0.6, rk: 0.6, lh: 0.2, lk: 0.9, ra: 1.0, re: 0.5, la: 0.6, le: 0.5 }),
    ],
    dur: 1,
  },
  jumpUp: {
    frames: [P({ air: 1, lean: 0.08, rh: 0.15, rk: 0.2, lh: -0.1, lk: 0.35, ra: 3.0, re: 0.05, la: 2.9, le: 0.05 })],
    dur: 1,
  },
  fall: {
    frames: [
      P({ air: 1, lean: -0.15, rh: 0.4, rk: 0.7, lh: -0.3, lk: 0.4, ra: 2.5, re: 0.6, la: 2.0, le: 0.9, hd: -0.2 }),
      P({ air: 1, lean: -0.2, rh: 0.1, rk: 0.4, lh: 0.1, lk: 0.9, ra: 2.1, re: 1.0, la: 2.6, le: 0.4, hd: -0.25 }),
    ],
    loop: true,
    dur: 0.35,
  },
  hang: {
    frames: [P({ air: 1, lean: 0.12, hd: -0.12, rh: 0.14, rk: 0.18, lh: -0.08, lk: 0.28, ra: 3.05, re: 0.0, la: 3.0, le: 0.05 }), P({ air: 1, lean: 0.1, hd: -0.12, rh: 0.04, rk: 0.28, lh: 0.0, lk: 0.16, ra: 3.05, re: 0.0, la: 3.0, le: 0.05 })],
    loop: true,
    dur: 2.4,
  },
  // Evenly spaced keys; CLIMB_PATH (player.js) moves the body in step with them
  // so the planted hands stay within reach of the ledge corner.
  climb: {
    frames: [
      P({ air: 1, lean: 0.12, hd: -0.12, rh: 0.1, rk: 0.2, lh: -0.08, lk: 0.25, ra: 3.05, re: 0.0, la: 3.0, le: 0.05 }),
      P({ air: 1, lean: 0.18, hd: 0.1, rh: 0.5, rk: 0.9, lh: 0.15, lk: 0.6, ra: 2.4, re: 1.8, la: 2.3, le: 1.9 }),
      P({ air: 1, lean: 0.75, hd: 0.25, rh: 1.45, rk: 2.75, lh: -0.1, lk: 0.7, ra: 1.2, re: 0.6, la: 1.1, le: 0.6 }),
      P({ lean: 0.5, hd: 0.15, rh: 1.2, rk: 2.3, lh: 0.7, lk: 2.0, ra: 0.7, re: 0.5, la: 0.5, le: 0.6 }),
      P({}),
    ],
    dur: 1,
  },
  fight: { frames: [P({ lean: 0.08, rh: 0.45, rk: 0.35, lh: -0.42, lk: 0.25, ra: 1.0, re: 0.55, sw: -0.45, la: -0.7, le: 1.6, hy: 3 }), P({ lean: 0.1, rh: 0.47, rk: 0.4, lh: -0.4, lk: 0.3, ra: 1.0, re: 0.6, sw: -0.4, la: -0.75, le: 1.65, hy: 4 })], loop: true, dur: 1.2 },
  fightStep: { frames: [P({ lean: 0.1, rh: 0.25, rk: 0.6, lh: -0.2, lk: 0.5, ra: 1.0, re: 0.55, sw: -0.45, la: -0.7, le: 1.6, hy: 3 }), P({ lean: 0.08, rh: 0.5, rk: 0.3, lh: -0.5, lk: 0.2, ra: 1.0, re: 0.55, sw: -0.45, la: -0.7, le: 1.6, hy: 3 })], loop: true, dur: 0.4 },
  strike: {
    frames: [
      P({ lean: 0.05, rh: 0.45, rk: 0.35, lh: -0.42, lk: 0.25, ra: 1.0, re: 0.55, sw: -0.45, la: -0.7, le: 1.6, hy: 3 }),
      P({ lean: -0.1, rh: 0.3, rk: 0.3, lh: -0.45, lk: 0.3, ra: 2.6, re: 1.2, sw: 0.3, la: -0.9, le: 1.4, hy: 2 }),
      P({ lean: 0.4, rh: 0.95, rk: 0.6, lh: -0.75, lk: 0.2, ra: 1.55, re: 0.0, sw: 0.0, la: -1.3, le: 0.4, hy: 6 }),
      P({ lean: 0.35, rh: 0.9, rk: 0.6, lh: -0.7, lk: 0.2, ra: 1.5, re: 0.05, sw: 0.0, la: -1.2, le: 0.5, hy: 6 }),
      P({ lean: 0.08, rh: 0.45, rk: 0.35, lh: -0.42, lk: 0.25, ra: 1.0, re: 0.55, sw: -0.45, la: -0.7, le: 1.6, hy: 3 }),
    ],
    dur: 1,
  },
  parry: { frames: [P({ lean: -0.08, rh: 0.35, rk: 0.4, lh: -0.5, lk: 0.3, ra: 1.25, re: 1.55, sw: 0.6, la: -0.8, le: 1.5, hy: 4 })], dur: 1 },
  hurt: { frames: [P({ lean: -0.45, hd: -0.4, rh: 0.5, rk: 0.6, lh: -0.1, lk: 0.5, ra: -0.6, re: 0.9, la: -0.9, le: 0.6, sw: -0.8 })], dur: 1 },
  dead: { frames: [P({ lean: -0.3, hd: -0.5, rh: 0.6, rk: 1.2, lh: 0.3, lk: 1.6, ra: 1.2, re: 0.8, la: 0.8, le: 1.2, rot: 0 }), P({ rot: -1.57, lean: 0.1, hd: -0.3, rh: 0.3, rk: 0.4, lh: 0.1, lk: 0.6, ra: 2.2, re: 0.6, la: 1.8, le: 0.8 })], dur: 1 },
  drink: { frames: [P({}), P({ lean: -0.12, hd: -0.45, ra: 2.5, re: 2.6, la: -0.2, le: 0.4 }), P({ lean: -0.12, hd: -0.5, ra: 2.6, re: 2.7, la: -0.2, le: 0.4 }), P({})], dur: 1 },
  pickup: { frames: [P({}), { ...crouch, ra: 1.2, re: 0.2 }, { ...crouch, ra: 1.0, re: 0.4 }, P({ ra: 2.8, re: 0.1, hd: -0.3, lean: -0.05 })], dur: 1 },
  embrace: { frames: [P({ lean: 0.1, ra: 1.4, re: 1.4, la: 1.3, le: 1.5 })], dur: 1 },
  cast: { frames: [P({ lean: -0.1, ra: 2.8, re: 0.4, la: 2.6, le: 0.6, hd: -0.3 }), P({ lean: -0.15, ra: 2.9, re: 0.2, la: 2.7, le: 0.3, hd: -0.35 })], loop: true, dur: 0.3 },
};

const KEYS = Object.keys(BASE);
const smooth = (t) => t * t * (3 - 2 * t);

export function samplePose(name, phase) {
  const a = ANIMS[name] || ANIMS.stand;
  const f = a.frames;
  if (f.length === 1) return f[0];
  let i0, i1, t;
  if (a.loop) {
    const x = (((phase % 1) + 1) % 1) * f.length;
    i0 = Math.floor(x);
    i1 = (i0 + 1) % f.length;
    t = x - i0;
  } else {
    const x = Math.max(0, Math.min(0.9999, phase)) * (f.length - 1);
    i0 = Math.floor(x);
    i1 = i0 + 1;
    t = x - i0;
  }
  return blend(f[i0], f[i1], smooth(t));
}

export function blend(a, b, t) {
  const o = {};
  for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}

const dir = (a) => [Math.sin(a), Math.cos(a)];

// Compute joint positions in local space (facing right, feet anchor at 0,0).
export function solve(p) {
  const hip = [p.hx, -(THIGH + SHIN) + p.hy];
  const legs = {};
  for (const s of ["l", "r"]) {
    const th = p[s + "h"], kn = p[s + "k"];
    const [tx, ty] = dir(th);
    const knee = [hip[0] + tx * THIGH, hip[1] + ty * THIGH];
    const [sx, sy] = dir(th - kn);
    const foot = [knee[0] + sx * SHIN, knee[1] + sy * SHIN];
    legs[s] = { knee, foot };
  }
  const tl = [Math.sin(p.lean), -Math.cos(p.lean)];
  const neck = [hip[0] + tl[0] * TORSO, hip[1] + tl[1] * TORSO];
  const shoulder = [hip[0] + tl[0] * (TORSO - 3), hip[1] + tl[1] * (TORSO - 3)];
  const ha = p.lean + p.hd;
  const head = [neck[0] + Math.sin(ha) * (HEAD + 1.6), neck[1] - Math.cos(ha) * (HEAD + 1.6)];
  const arms = {};
  for (const s of ["l", "r"]) {
    const ua = p[s + "a"] + p.lean * 0.6, ea = ua + p[s + "e"];
    const [ux, uy] = dir(ua);
    const elbow = [shoulder[0] + ux * UPPER, shoulder[1] + uy * UPPER];
    const [fx, fy] = dir(ea);
    const hand = [elbow[0] + fx * FORE, elbow[1] + fy * FORE];
    arms[s] = { elbow, hand, angle: ea };
  }
  const J = { hip, neck, shoulder, head, legs, arms, headAngle: ha, swordAngle: arms.r.angle + p.sw };
  if (p.rot) {
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    const R = (pt) => {
      const dx = pt[0] - hip[0], dy = pt[1] - hip[1];
      pt[0] = hip[0] + dx * c - dy * s;
      pt[1] = hip[1] + dx * s + dy * c;
    };
    for (const pt of allPoints(J)) if (pt !== hip) R(pt);
    J.headAngle += p.rot;
    J.swordAngle -= p.rot;
  }
  // fade foot planting with `air` so blends between airborne and grounded keys don't pop
  const ground = 1 - Math.min(1, p.air);
  if (ground > 0) {
    let maxY = -Infinity;
    const pts = p.rot ? allPoints(J) : [legs.l.foot, legs.r.foot];
    for (const pt of pts) maxY = Math.max(maxY, pt[1]);
    const lift = (p.rot ? maxY + 2 : maxY) * ground;
    for (const pt of allPoints(J)) pt[1] -= lift;
  }
  J.planted = ground > 0.99;
  return J;
}

// Piecewise eased interpolation over evenly spaced [x, y] keys, matching samplePose timing.
export function sampleKeys(keys, q) {
  const x = Math.max(0, Math.min(0.9999, q)) * (keys.length - 1);
  const i = Math.floor(x), t = smooth(x - i);
  const a = keys[i], b = keys[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Two-bone IK: shoulder -> target, elbow bent backwards (away from the facing side).
function reachArm(S, T) {
  const dx = T[0] - S[0], dy = T[1] - S[1];
  const d0 = Math.hypot(dx, dy) || 1e-3;
  const d = Math.min(Math.max(d0, 1.5), (UPPER + FORE) * 0.995);
  const ux = dx / d0, uy = dy / d0;
  const cosA = Math.max(-1, Math.min(1, (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  const e1 = [S[0] + UPPER * (ux * cosA - uy * sinA), S[1] + UPPER * (uy * cosA + ux * sinA)];
  const e2 = [S[0] + UPPER * (ux * cosA + uy * sinA), S[1] + UPPER * (uy * cosA - ux * sinA)];
  const elbow = e1[0] < e2[0] ? e1 : e2;
  const hand = [S[0] + ux * d, S[1] + uy * d];
  return { elbow, hand, angle: Math.atan2(hand[0] - elbow[0], hand[1] - elbow[1]) };
}

// Pin both hands to a ledge corner g (local space). Hands hook over the lip while the
// shoulders are below it and slide to palms-flat on top as the body mantles over.
function applyGrip(J, g, w) {
  const m = Math.max(0, Math.min(1, (g[1] - J.shoulder[1] + 6) / 14));
  for (const s of ["l", "r"]) {
    const arm = J.arms[s];
    const gx = g[0] + (s === "l" ? 2.2 : 0);
    const W = [gx - 1 + 2.5 * m, g[1] + 1.5 - 3.1 * m];
    const T = [arm.hand[0] + (W[0] - arm.hand[0]) * w, arm.hand[1] + (W[1] - arm.hand[1]) * w];
    Object.assign(arm, reachArm(J.shoulder, T));
    arm.grip = w > 0.5 ? { m, off: [arm.hand[0] - W[0], arm.hand[1] - W[1]] } : null;
  }
}

function allPoints(J) {
  return [J.hip, J.neck, J.shoulder, J.head, J.legs.l.knee, J.legs.l.foot, J.legs.r.knee, J.legs.r.foot, J.arms.l.elbow, J.arms.l.hand, J.arms.r.elbow, J.arms.r.hand];
}

// ---------- drawing ----------
// Painted-rotoscope look: tapered limbs with form shading lit from the upper front,
// a dark ink outline, and a grime texture laid over every part.
export const STYLES = {
  prince: { skin: "#c48d68", pants: "#e6dfd0", pantsShade: "#bbb2a2", vest: "#2c3152", trim: "#c9a24a", sash: "#a32a28", turban: "#efe9dc", jewel: "#c9a24a", hair: "#1c130d", shoe: "#5a3a22", bracer: "#7a5a2e", baggy: true, bareChest: true, tail: true, grime: 0.3 },
  jailer: { skin: "#94654a", pants: "#3b3a2a", pantsShade: "#2a291e", vest: "#4b3826", sash: "#5e4a2a", cap: "#2f2a20", hair: "#140d08", shoe: "#22180f", boots: true, sleeves: true, sleeve: "#3d3022", belly: true, strap: true, beard: "full", stubble: 0.4 },
  shade: { skin: "#6f8f9a", pants: "#1d3440", pantsShade: "#13252e", vest: "#22495a", sash: "#4cbfe0", turban: "#192c36", hair: "#0a1418", shoe: "#0e1a20", boots: true, sleeves: true, sleeve: "#1c4252", stubble: 0.2 },
  palace: { skin: "#a87552", pants: "#5c1e1c", pantsShade: "#431514", vest: "#25304c", sash: "#a3802e", turban: "#7c2520", hair: "#160e08", shoe: "#2a160e", boots: true, sleeves: true, sleeve: "#1f2943", strap: true, beard: "full", stubble: 0.3 },
  jaffar: { skin: "#a97c5a", pants: "#2e0f3a", pantsShade: "#220a2c", vest: "#45174f", sash: "#a3802e", turban: "#1e0a26", hair: "#1a1316", shoe: "#170a1c", sleeves: true, sleeve: "#3a1345", robe: "#40164a", tall: true, beard: "long", stubble: 0.3 },
  princess: { skin: "#d2a07c", pants: "#a35a6e", pantsShade: "#874a5c", vest: "#c79aa4", sash: "#b8913c", hair: "#1a0c06", shoe: "#6e2e40", sleeves: true, sleeve: "#c79aa4", dress: "#9c5468", longHair: true, grime: 0.35 },
};

const LX = 0.42, LY = -0.91; // light direction (local space): upper front
const INK = "rgba(16,9,5,0.92)";
const SIL_COLOR = "#05070d";
let SIL = false;
let GRIME = 1; // per-style multiplier on the grain texture
let grain = null;
const silCache = new WeakMap();

function silhouetteOf(st) {
  let o = silCache.get(st);
  if (!o) {
    o = {};
    for (const [k, v] of Object.entries(st)) o[k] = typeof v === "string" && v[0] === "#" ? SIL_COLOR : v;
    o.sash = "#0b1a2a";
    silCache.set(st, o);
  }
  return o;
}

function grainPattern(ctx) {
  if (grain) return grain;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  for (let i = 0; i < 420; i++) {
    const a = 0.08 + Math.random() * 0.3;
    g.fillStyle = Math.random() < 0.8 ? `rgba(25,14,6,${a})` : `rgba(255,236,200,${a * 0.5})`;
    g.fillRect(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 1.5, 1);
  }
  g.strokeStyle = "rgba(30,18,8,0.22)";
  g.lineWidth = 0.7;
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 64, y = Math.random() * 64;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 5, y + 3 + Math.random() * 6);
    g.stroke();
  }
  grain = ctx.createPattern(c, "repeat");
  grain.setTransform?.(new DOMMatrix().scale(0.5));
  return grain;
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
}

const along = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const mv = (ctx, p) => ctx.moveTo(p[0], p[1]);
const ln = (ctx, p) => ctx.lineTo(p[0], p[1]);
const qc = (ctx, c, p) => ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);

// Fill the current path, then grime and ink it.
function paint(ctx, fill, ink = 0.75, grime = 0.6) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (SIL) return;
  if (grime) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * grime * GRIME;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fill();
    ctx.globalAlpha = a;
  }
  if (ink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink;
    ctx.stroke();
  }
}

function strokeDetail(ctx, color, w, pts) {
  if (SIL) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  mv(ctx, pts[0]);
  if (pts.length === 3) qc(ctx, pts[1], pts[2]);
  else for (let i = 1; i < pts.length; i++) ln(ctx, pts[i]);
  ctx.stroke();
}

// Gradient across a limb's width: lit side towards the light, core shadow on the far side.
function formFill(ctx, a, b, r, base, k = 1) {
  if (SIL) return base;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const c = nx * LX + ny * LY;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const g = ctx.createLinearGradient(mx + nx * r, my + ny * r, mx - nx * r, my - ny * r);
  g.addColorStop(0, shade(base, k * (0.86 + 0.34 * c)));
  g.addColorStop(0.5, shade(base, k * 0.9));
  g.addColorStop(1, shade(base, k * (0.86 - 0.34 * c)));
  return g;
}

// Paint over the ink seam where two limb segments overlap at a joint.
function hideSeam(ctx, j, a, b, r, base, k) {
  if (SIL) return;
  ctx.beginPath();
  ctx.arc(j[0], j[1], r, 0, Math.PI * 2);
  ctx.fillStyle = formFill(ctx, a, b, r + 0.6, base, k);
  ctx.fill();
}

// Tapered limb: radius r0 at a, r1 at b, mid-bulge ra on the +normal side and rb on the other.
function capsule(ctx, a, b, r0, r1, ra = (r0 + r1) / 2, rb = ra) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-3;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const th = Math.atan2(uy, ux);
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, rm = (r0 + r1) / 2;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * r0, a[1] + ny * r0);
  ctx.quadraticCurveTo(mx + nx * (2 * ra - rm), my + ny * (2 * ra - rm), b[0] + nx * r1, b[1] + ny * r1);
  ctx.arc(b[0], b[1], r1, th + Math.PI / 2, th - Math.PI / 2, true);
  ctx.quadraticCurveTo(mx - nx * (2 * rb - rm), my - ny * (2 * rb - rm), a[0] - nx * r0, a[1] - ny * r0);
  ctx.arc(a[0], a[1], r0, th - Math.PI / 2, th + Math.PI / 2, true);
  ctx.closePath();
}

function drawShoe(ctx, f, fwd, st, k) {
  const up = [fwd[1], -fwd[0]];
  const P = (a, b) => [f[0] + fwd[0] * a + up[0] * b, f[1] + fwd[1] * a + up[1] * b];
  ctx.beginPath();
  mv(ctx, P(-1.6, 3.8));
  qc(ctx, P(-3.0, 2.6), P(-2.6, 0));
  ln(ctx, P(5.4, 0));
  if (st.baggy) qc(ctx, P(7.6, 0.1), P(7.2, 1.9));
  else qc(ctx, P(6.6, 0.3), P(6.0, 1.6));
  qc(ctx, P(3.6, 2.2), P(1.4, 4.0));
  ctx.closePath();
  let fill = shade(st.shoe, k);
  if (!SIL) {
    const t = P(0, 4), b = P(0, 0);
    fill = ctx.createLinearGradient(t[0], t[1], b[0], b[1]);
    fill.addColorStop(0, shade(st.shoe, k * 1.25));
    fill.addColorStop(1, shade(st.shoe, k * 0.7));
  }
  paint(ctx, fill, 0.6, 0.7);
}

function drawLeg(ctx, J, s, st, back, planted) {
  const { knee, foot } = J.legs[s];
  const hip = J.hip;
  const k = back ? 0.72 : 1;
  const sl = Math.hypot(foot[0] - knee[0], foot[1] - knee[1]) || 1;
  const sd = [(foot[0] - knee[0]) / sl, (foot[1] - knee[1]) / sl];
  const fwd = planted && foot[1] > -1.5 ? [1, 0] : [sd[1], -sd[0]];
  drawShoe(ctx, foot, fwd, st, k);
  const pc = back ? st.pantsShade : st.pants;
  if (st.baggy) {
    capsule(ctx, hip, knee, 5.6, 4.4, 6.0, 6.5);
    paint(ctx, formFill(ctx, hip, knee, 6.5, pc, k));
    const ank = along(knee, foot, 0.88);
    capsule(ctx, knee, ank, 4.4, 2.2, 5.7, 4.8);
    paint(ctx, formFill(ctx, knee, ank, 5.7, pc, k));
    hideSeam(ctx, knee, knee, ank, 3.6, pc, k);
    const fold = `rgba(40,28,16,${(back ? 0.25 : 0.4) * (st.grime ?? 1) ** 0.5})`;
    const n = [-sd[1], sd[0]];
    for (const t of [0.35, 0.6]) {
      const c = along(knee, ank, t);
      strokeDetail(ctx, fold, 0.6, [[c[0] + n[0] * 3.5, c[1] + n[1] * 3.5], [c[0] + sd[0] * 2, c[1] + sd[1] * 2], [c[0] - n[0] * 3, c[1] - n[1] * 3 + 1]]);
    }
    const th = along(hip, knee, 0.55);
    strokeDetail(ctx, fold, 0.6, [[th[0] - 2, th[1] - 3], [th[0] + 1, th[1]], [th[0] + 3, th[1] + 3.5]]);
    capsule(ctx, along(knee, foot, 0.82), along(knee, foot, 0.95), 2.4, 2.2);
    paint(ctx, shade(st.shoe, k * 1.1), 0.5, 0.5);
  } else {
    capsule(ctx, hip, knee, 5.0, 3.7, 5.2, 5.5);
    paint(ctx, formFill(ctx, hip, knee, 5.5, pc, k));
    capsule(ctx, knee, foot, 3.7, 2.3, 4.4, 3.5);
    paint(ctx, formFill(ctx, knee, foot, 4.4, pc, k));
    hideSeam(ctx, knee, knee, foot, 3.0, pc, k);
    if (st.boots) {
      const b0 = along(knee, foot, 0.42), b1 = along(knee, foot, 0.9);
      capsule(ctx, b0, b1, 3.4, 2.7, 3.6, 3.2);
      paint(ctx, formFill(ctx, b0, b1, 3.6, st.shoe, k * 1.15), 0.6, 0.7);
    }
  }
}

function drawHand(ctx, arm, st, k, fist) {
  const h = arm.hand;
  const col = shade(st.skin, k);
  if (arm.grip && Math.hypot(arm.grip.off[0], arm.grip.off[1]) < 2.5) {
    // fingers hooked over the lip (m=0) or palm flat on the ledge top (m=1)
    const m = arm.grip.m;
    const K = [h[0] + 1.5 + 2.0 * m, h[1] - 2.5 + 3.1 * m];
    const F = [K[0] + 3.5 - 1.0 * m, K[1] + 0.1];
    const path = () => { ctx.beginPath(); mv(ctx, h); ln(ctx, K); ln(ctx, F); };
    if (!SIL) {
      path();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.4;
      ctx.stroke();
    }
    path();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    strokeDetail(ctx, "rgba(40,20,10,0.45)", 0.45, [[K[0] + 0.6, K[1] - 1.1], [K[0] + 0.6, K[1] + 1.1]]);
    return;
  }
  const dx = Math.sin(arm.angle), dy = Math.cos(arm.angle);
  const rot = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.ellipse(h[0] + dx * 1.3, h[1] + dy * 1.3, fist ? 1.9 : 2.4, fist ? 1.7 : 1.35, rot, 0, Math.PI * 2);
  paint(ctx, col, 0.55, 0);
  if (!fist) {
    ctx.beginPath();
    ctx.ellipse(h[0] + dx * 0.9 - dy * 1.1, h[1] + dy * 0.9 + dx * 1.1, 1.1, 0.65, rot + 0.5, 0, Math.PI * 2);
    paint(ctx, shade(st.skin, k * 0.85), 0.45, 0);
  }
}

function drawArm(ctx, J, s, st, back, fist) {
  const arm = J.arms[s];
  const { elbow, hand } = arm;
  const sh = J.shoulder;
  const k = back ? 0.7 : 1;
  capsule(ctx, sh, elbow, 2.9, 2.0, 3.1, 2.9);
  paint(ctx, formFill(ctx, sh, elbow, 3.1, st.sleeves ? st.sleeve : st.skin, k));
  capsule(ctx, elbow, hand, 2.1, 1.35, 2.35, 2.15);
  paint(ctx, formFill(ctx, elbow, hand, 2.35, st.skin, k));
  if (!st.sleeves) hideSeam(ctx, elbow, elbow, hand, 1.5, st.skin, k);
  if (st.sleeves) {
    const e1 = along(elbow, hand, 0.62);
    capsule(ctx, elbow, e1, 2.6, 2.2, 2.7, 2.6);
    paint(ctx, formFill(ctx, elbow, e1, 2.7, st.sleeve, k));
  } else if (st.bracer) {
    const b0 = along(elbow, hand, 0.48), b1 = along(elbow, hand, 0.92);
    capsule(ctx, b0, b1, 2.0, 1.65);
    paint(ctx, formFill(ctx, b0, b1, 2.0, st.bracer, k * 1.2), 0.55, 0.8);
  }
  drawHand(ctx, arm, st, k, fist);
}

function drawRobe(ctx, J, st) {
  const c = st.robe || st.dress;
  const lf = J.legs.l.foot, rf = J.legs.r.foot;
  const lowY = Math.max(lf[1], rf[1]) - (st.dress ? 1 : 5);
  const x0 = Math.min(lf[0], rf[0]) - 8, x1 = Math.max(lf[0], rf[0]) + 8;
  const [sx, sy] = J.shoulder;
  ctx.beginPath();
  ctx.moveTo(sx - 5, sy);
  ctx.lineTo(sx + 5, sy);
  ctx.quadraticCurveTo(x1 - 1, (sy + lowY) / 2, x1, lowY);
  ctx.quadraticCurveTo((x0 + x1) / 2, lowY + 2, x0, lowY);
  ctx.quadraticCurveTo(x0 + 1, (sy + lowY) / 2, sx - 5, sy);
  ctx.closePath();
  let fill = c;
  if (!SIL) {
    fill = ctx.createLinearGradient(x1, sy, x0, lowY);
    fill.addColorStop(0, shade(c, 1.2));
    fill.addColorStop(0.5, shade(c, 0.9));
    fill.addColorStop(1, shade(c, 0.55));
  }
  paint(ctx, fill);
  const fold = "rgba(10,4,12,0.4)";
  for (const t of [0.25, 0.5, 0.75]) {
    const bx = x0 + (x1 - x0) * t;
    strokeDetail(ctx, fold, 0.6, [[sx + (t - 0.5) * 6, sy + 12], [bx + 1, (sy + lowY) / 2 + 6], [bx, lowY - 1]]);
  }
  strokeDetail(ctx, st.sash, 0.9, [[x0 + 1, lowY - 1.5], [(x0 + x1) / 2, lowY + 0.5], [x1 - 1, lowY - 1.5]]);
}

function drawTorso(ctx, J, st) {
  const [hx, hy] = J.hip, [sx, sy] = J.neck;
  const tl = Math.hypot(sx - hx, sy - hy) || 1;
  const ux = (sx - hx) / tl, uy = (sy - hy) / tl, fx = -uy, fy = ux;
  const P = (t, f) => [hx + ux * tl * t + fx * f, hy + uy * tl * t + fy * f];
  const body = () => {
    ctx.beginPath();
    mv(ctx, P(0, 4.8));
    qc(ctx, P(0.3, 4.0), P(0.62, 5.9));
    qc(ctx, P(0.92, 6.8), P(1.02, 2.2));
    qc(ctx, P(1.1, -1.8), P(0.9, -5.0));
    qc(ctx, P(0.6, -5.6), P(0.3, -4.5));
    qc(ctx, P(0.1, -4.2), P(0, -5.3));
    qc(ctx, P(-0.1, 0), P(0, 4.8));
    ctx.closePath();
  };
  const across = (c, kf = 1) => {
    if (SIL) return c;
    const a = P(0.6, 6.5), b = P(0.6, -6);
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, shade(c, 1.15 * kf));
    g.addColorStop(0.45, shade(c, 0.92 * kf));
    g.addColorStop(1, shade(c, 0.55 * kf));
    return g;
  };

  if (st.belly) {
    const b = P(0.35, 4.2);
    ctx.beginPath();
    ctx.ellipse(b[0], b[1], 5.5, 6.5, Math.atan2(uy, ux), 0, Math.PI * 2);
    paint(ctx, across(st.vest));
  }
  body();
  paint(ctx, across(st.bareChest ? st.skin : st.vest));
  if (st.bareChest) {
    strokeDetail(ctx, "rgba(50,25,12,0.45)", 0.6, [P(0.78, 6.0), P(0.66, 4.2), P(0.7, 2.4)]);
    strokeDetail(ctx, "rgba(50,25,12,0.3)", 0.5, [P(0.48, 4.6), P(0.42, 3.6), P(0.44, 2.8)]);
    strokeDetail(ctx, "rgba(50,25,12,0.3)", 0.5, [P(0.3, 4.4), P(0.25, 3.5), P(0.27, 2.6)]);
    // open vest over the back and shoulders
    ctx.beginPath();
    mv(ctx, P(1.02, 1.0));
    qc(ctx, P(0.75, 3.4), P(0.42, 2.3));
    ln(ctx, P(0.12, 3.2));
    ln(ctx, P(0.06, -5.0));
    qc(ctx, P(0.3, -4.6), P(0.6, -5.7));
    qc(ctx, P(0.95, -5.2), P(1.08, -1.8));
    ctx.closePath();
    paint(ctx, across(st.vest));
    strokeDetail(ctx, st.trim || "rgba(210,180,130,0.35)", st.trim ? 0.7 : 0.5, [P(1.0, 0.8), P(0.75, 3.1), P(0.42, 2.1)]);
  } else if (st.strap) {
    strokeDetail(ctx, INK, 2.2, [P(0.95, -4.2), P(0.15, 4.4)]);
    strokeDetail(ctx, shade("#4a3220", 1), 1.4, [P(0.95, -4.2), P(0.15, 4.4)]);
  }

  // sash, knotted at the back with two ragged tails
  ctx.beginPath();
  mv(ctx, P(0.03, -5.4));
  ln(ctx, P(0.03, 5.1));
  qc(ctx, P(0.13, 5.3), P(0.22, 4.3));
  ln(ctx, P(0.22, -4.7));
  ctx.closePath();
  paint(ctx, across(st.sash, 1.1), 0.6, 0.5);
  if (!st.robe && !st.dress) {
    const sway = Math.sin(performance.now() / 200) * 1.2;
    const knot = P(0.12, -5.3);
    for (const [len, off] of [[10, 0], [7.5, 2]]) {
      const end = [knot[0] - fx * (5 + off) - 2, knot[1] + len + sway * (1 + off / 2)];
      capsule(ctx, knot, end, 1.4, 0.6, 1.3, 1.1);
      paint(ctx, formFill(ctx, knot, end, 1.4, st.sash, 0.85), 0.5, 0.5);
    }
  }
}

function drawHead(ctx, J, st, opts) {
  const [hdx, hdy] = J.head;
  const ha = J.headAngle;
  const base = [hdx + Math.cos(ha) * -0.4 - Math.sin(ha) * 4.2, hdy + Math.sin(ha) * -0.4 + Math.cos(ha) * 4.2];
  const nk = [J.neck[0], J.neck[1] + 1];
  capsule(ctx, nk, base, 2.2, 1.9);
  paint(ctx, formFill(ctx, nk, base, 2.2, st.skin, 0.85), 0.6, 0.4);

  ctx.save();
  ctx.translate(hdx, hdy);
  ctx.rotate(ha);
  const skin = st.skin;
  const lit = (c, a = [4, -5], b = [-4, 4]) => {
    if (SIL) return c;
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, shade(c, 1.18));
    g.addColorStop(0.55, shade(c, 0.9));
    g.addColorStop(1, shade(c, 0.58));
    return g;
  };

  if (st.longHair) {
    ctx.beginPath();
    ctx.ellipse(-3.4, 5, 3.6, 9.5, 0.15, 0, Math.PI * 2);
    paint(ctx, lit(st.hair));
  }
  if (st.tail && st.turban) {
    const sway = Math.sin(performance.now() / 260) * 0.8;
    capsule(ctx, [-4.6, -1.5], [-7.2 + sway, 5.5], 1.6, 0.8, 1.5, 1.3);
    paint(ctx, formFill(ctx, [-4.6, -1.5], [-7.2, 5.5], 1.6, st.turban, 0.8), 0.6, 0.6);
  }

  // skull and profile in a single outline
  ctx.beginPath();
  mv(ctx, [-1.8, 4.4]);
  qc(ctx, [-5.2, 3.2], [-4.9, -1.2]);
  qc(ctx, [-4.4, -5.0], [-0.4, -5.3]);
  qc(ctx, [3.4, -5.4], [4.1, -2.3]);
  ln(ctx, [4.55, -1.2]);
  ln(ctx, [4.25, -0.5]);
  ln(ctx, [5.9, 1.5]);
  qc(ctx, [5.6, 2.0], [4.7, 1.9]);
  ln(ctx, [4.95, 2.5]);
  ln(ctx, [4.55, 2.9]);
  ln(ctx, [4.75, 3.4]);
  qc(ctx, [4.9, 4.6], [3.6, 5.0]);
  qc(ctx, [1.6, 5.3], [0.1, 3.9]);
  ln(ctx, [-1.8, 4.4]);
  ctx.closePath();
  paint(ctx, lit(skin), 0.7, 0.45);

  if (!SIL) {
    if (st.stubble) {
      ctx.beginPath();
      mv(ctx, [0.3, 1.8]);
      ln(ctx, [4.7, 2.0]);
      ln(ctx, [4.8, 3.6]);
      qc(ctx, [4.6, 4.8], [3.6, 5.0]);
      qc(ctx, [1.6, 5.3], [0.1, 3.9]);
      ctx.closePath();
      ctx.fillStyle = `rgba(25,15,8,${st.stubble})`;
      ctx.fill();
    }
    ctx.fillStyle = "rgba(30,15,8,0.45)";
    ctx.beginPath();
    ctx.ellipse(2.8, -0.6, 1.5, 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#120a06";
    ctx.beginPath();
    ctx.ellipse(3.15, -0.55, 0.65, 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    strokeDetail(ctx, shade(st.hair, 1), 0.8, [[1.9, -1.9], [4.3, -1.5]]);
    strokeDetail(ctx, "rgba(40,20,10,0.3)", 0.5, [[2.0, 1.3], [3.0, 1.6], [3.8, 1.2]]);
    strokeDetail(ctx, "rgba(40,15,8,0.6)", 0.45, [[4.0, 2.75], [4.6, 2.85]]);
    ctx.beginPath();
    ctx.ellipse(-0.8, 0.7, 1.0, 1.5, 0.1, 0, Math.PI * 2);
    paint(ctx, shade(skin, 0.72), 0.4, 0);
  } else {
    ctx.fillStyle = opts.eye || "#8ff";
    ctx.beginPath();
    ctx.ellipse(3.1, -0.6, 1.3, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (st.beard) {
    ctx.beginPath();
    mv(ctx, [0.2, 1.6]);
    ln(ctx, [4.7, 2.3]);
    ln(ctx, [4.9, 3.6]);
    if (st.beard === "long") qc(ctx, [4.4, 8], [2.6, 10.8]);
    else qc(ctx, [4.8, 6.0], [2.6, 6.4]);
    qc(ctx, [0.6, 6.0], [-0.8, 3.8]);
    ctx.closePath();
    paint(ctx, lit(st.hair), 0.55, 0.5);
    strokeDetail(ctx, shade(skin, 0.5), 0.4, [[3.9, 2.8], [4.7, 2.9]]);
  }

  if (st.tall) {
    ctx.beginPath();
    mv(ctx, [-5.2, 0.2]);
    qc(ctx, [-7, -12], [0.5, -17.5]);
    qc(ctx, [7.5, -10], [5.0, -1.2]);
    qc(ctx, [0, -3.2], [-5.2, 0.2]);
    ctx.closePath();
    paint(ctx, lit(st.turban, [5, -16], [-5, 0]));
    strokeDetail(ctx, "rgba(0,0,0,0.4)", 0.6, [[4.6, -4], [-0.5, -6.5], [-5.6, -3]]);
    strokeDetail(ctx, "rgba(0,0,0,0.4)", 0.6, [[3.8, -8.5], [-0.5, -11], [-5.0, -7.5]]);
    ctx.beginPath();
    ctx.arc(2.4, -5.2, 1.5, 0, Math.PI * 2);
    paint(ctx, st.sash, 0.5, 0);
  } else if (st.cap) {
    ctx.beginPath();
    mv(ctx, [4.1, -2.2]);
    qc(ctx, [3.8, -6.8], [-0.8, -6.7]);
    qc(ctx, [-5.4, -6.3], [-5.1, -0.4]);
    qc(ctx, [-0.5, -2.9], [4.1, -2.2]);
    ctx.closePath();
    paint(ctx, lit(st.cap));
    strokeDetail(ctx, "rgba(200,170,120,0.25)", 0.5, [[3.6, -2.6], [-0.4, -3.4], [-4.8, -1.0]]);
  } else if (st.turban) {
    ctx.beginPath();
    mv(ctx, [4.3, -1.6]);
    qc(ctx, [5.3, -7.6], [-0.5, -8.6]);
    qc(ctx, [-6.6, -7.8], [-5.5, 0.8]);
    qc(ctx, [-1.5, -2.6], [4.3, -1.6]);
    ctx.closePath();
    paint(ctx, lit(st.turban, [4, -9], [-5, 0]));
    strokeDetail(ctx, "rgba(30,18,8,0.4)", 0.6, [[3.9, -3.4], [-0.5, -6.0], [-5.2, -1.4]]);
    strokeDetail(ctx, "rgba(30,18,8,0.35)", 0.6, [[3.0, -5.8], [-1.0, -8.0], [-5.5, -4.2]]);
    strokeDetail(ctx, "rgba(255,240,210,0.2)", 0.5, [[3.6, -4.4], [-0.5, -7.0], [-5.3, -2.8]]);
    if (st.jewel) {
      ctx.beginPath();
      ctx.ellipse(2.6, -4.4, 1.1, 1.4, 0.2, 0, Math.PI * 2);
      paint(ctx, st.jewel, 0.45, 0);
      if (!SIL) {
        ctx.fillStyle = "#7a1a1e";
        ctx.beginPath();
        ctx.arc(2.6, -4.4, 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.beginPath();
    mv(ctx, [4.0, -2.6]);
    qc(ctx, [2.2, -6.4], [-1.0, -5.9]);
    qc(ctx, [-5.4, -5.2], [-5.0, 1.0]);
    qc(ctx, [-1.0, -2.2], [4.0, -2.6]);
    ctx.closePath();
    paint(ctx, lit(st.hair), 0.6, 0.5);
  }
  ctx.restore();
}

function drawSword(ctx, J) {
  const [hx, hy] = J.arms.r.hand;
  const a = J.swordAngle;
  const dx = Math.sin(a), dy = Math.cos(a);
  const nx = -dy, ny = dx;
  const L = 27;
  const tip = [hx + dx * L, hy + dy * L];
  capsule(ctx, [hx - dx * 3.6, hy - dy * 3.6], [hx, hy], 0.9, 0.9);
  paint(ctx, "#2e1c10", 0.5, 0);
  ctx.beginPath();
  ctx.arc(hx - dx * 4.3, hy - dy * 4.3, 1.2, 0, Math.PI * 2);
  paint(ctx, "#8a6a2c", 0.5, 0);
  ctx.beginPath();
  ctx.moveTo(hx + nx * 1.4, hy + ny * 1.4);
  ctx.quadraticCurveTo(hx + dx * L * 0.6 + nx * 4.5, hy + dy * L * 0.6 + ny * 4.5, tip[0] + nx * 2.5, tip[1] + ny * 2.5);
  ctx.quadraticCurveTo(hx + dx * L * 0.55 + nx * 1, hy + dy * L * 0.55 + ny * 1, hx - nx * 1.4, hy - ny * 1.4);
  ctx.closePath();
  let fill = SIL_COLOR;
  if (!SIL) {
    const m = [hx + dx * L * 0.5, hy + dy * L * 0.5];
    fill = ctx.createLinearGradient(m[0] - nx * 1.5, m[1] - ny * 1.5, m[0] + nx * 4, m[1] + ny * 4);
    fill.addColorStop(0, "#e2e6e8");
    fill.addColorStop(0.4, "#9aa2a6");
    fill.addColorStop(1, "#5c6468");
  }
  paint(ctx, fill, 0.6, 0.35);
  strokeDetail(ctx, "rgba(30,34,38,0.5)", 0.5, [[hx + dx * 3 + nx * 1.2, hy + dy * 3 + ny * 1.2], [hx + dx * L * 0.45 + nx * 3, hy + dy * L * 0.45 + ny * 3], [hx + dx * L * 0.78 + nx * 3.2, hy + dy * L * 0.78 + ny * 3.2]]);
  ctx.lineCap = "round";
  if (!SIL) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(hx + nx * 4, hy + ny * 4);
    ctx.lineTo(hx - nx * 4, hy - ny * 4);
    ctx.stroke();
  }
  ctx.strokeStyle = SIL ? SIL_COLOR : "#a3802e";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(hx + nx * 4, hy + ny * 4);
  ctx.lineTo(hx - nx * 4, hy - ny * 4);
  ctx.stroke();
  return tip;
}

// opts.grip = { x, y, w }: world-space ledge corner the hands should hold, blended by w.
export function drawFigure(ctx, x, y, facing, pose, st, opts = {}) {
  const J = solve(pose);
  if (opts.grip && opts.grip.w > 0) applyGrip(J, [(opts.grip.x - x) * facing, opts.grip.y - y], opts.grip.w);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  SIL = !!opts.silhouette;
  GRIME = st.grime ?? 1;
  if (SIL) {
    st = silhouetteOf(st);
    ctx.shadowColor = opts.glow || "rgba(80,220,255,0.9)";
    ctx.shadowBlur = 10;
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const robed = st.robe || st.dress;
  drawArm(ctx, J, "l", st, true, false);
  drawLeg(ctx, J, "l", st, true, J.planted);
  if (robed) {
    drawLeg(ctx, J, "r", st, false, J.planted);
    drawRobe(ctx, J, st);
  }
  drawTorso(ctx, J, st);
  if (!robed) drawLeg(ctx, J, "r", st, false, J.planted);
  drawHead(ctx, J, st, opts);
  let tip = null;
  if (opts.sword) tip = drawSword(ctx, J);
  drawArm(ctx, J, "r", st, false, !!opts.sword);
  ctx.restore();
  SIL = false;
  if (tip) return [x + tip[0] * facing, y + tip[1]];
  return null;
}
