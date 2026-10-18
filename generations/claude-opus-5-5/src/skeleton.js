// Procedural "rotoscope" figures: keyframed joint angles, smooth interpolation,
// forward kinematics, automatic foot planting.
const THIGH = 16, SHIN = 16, TORSO = 20, UPPER = 11, FORE = 11, HEAD = 6;

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
    frames: [P({ air: 1, lean: -0.05, rh: 0.1, lh: -0.1, ra: 3.0, re: 0.05, la: 2.9, le: 0.05 })],
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
    frames: [P({ air: 1, lean: -0.08, hd: -0.1, rh: 0.12, rk: 0.15, lh: -0.1, lk: 0.25, ra: 3.05, re: 0.0, la: 3.0, le: 0.05 }), P({ air: 1, lean: -0.05, hd: -0.1, rh: 0.05, rk: 0.25, lh: -0.02, lk: 0.15, ra: 3.05, re: 0.0, la: 3.0, le: 0.05 })],
    loop: true,
    dur: 2.4,
  },
  climb: {
    frames: [
      P({ air: 1, lean: -0.05, rh: 0.1, rk: 0.1, lh: -0.1, lk: 0.2, ra: 3.05, re: 0.0, la: 3.0, le: 0.05 }),
      P({ air: 1, lean: 0.2, rh: 0.9, rk: 1.6, lh: 0.5, lk: 1.2, ra: 2.2, re: 1.9, la: 2.1, le: 2.0 }),
      P({ air: 1, lean: 0.6, rh: 1.6, rk: 2.4, lh: 0.4, lk: 1.6, ra: 1.0, re: 0.6, la: 0.9, le: 0.6 }),
      P({ lean: 0.35, rh: 0.9, rk: 1.6, lh: 0.3, lk: 1.3, ra: 0.5, re: 0.5, la: 0.3, le: 0.5 }),
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
  const head = [neck[0] + Math.sin(ha) * (HEAD + 2), neck[1] - Math.cos(ha) * (HEAD + 2)];
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
  if (!p.air) {
    let maxY = -Infinity;
    const pts = p.rot ? allPoints(J) : [legs.l.foot, legs.r.foot];
    for (const pt of pts) maxY = Math.max(maxY, pt[1]);
    const lift = p.rot ? maxY + 2 : maxY;
    for (const pt of allPoints(J)) pt[1] -= lift;
  }
  return J;
}

function allPoints(J) {
  return [J.hip, J.neck, J.shoulder, J.head, J.legs.l.knee, J.legs.l.foot, J.legs.r.knee, J.legs.r.foot, J.arms.l.elbow, J.arms.l.hand, J.arms.r.elbow, J.arms.r.hand];
}

// ---------- drawing ----------
export const STYLES = {
  prince: { skin: "#e0ac7e", pants: "#f4efe6", pantsShade: "#c9c2b6", vest: "#efe9df", sash: "#c8323c", turban: "#f7f3ea", hair: "#2a1a10", shoe: "#5a3420", sleeves: false },
  jailer: { skin: "#b98458", pants: "#3f4a35", pantsShade: "#2c3426", vest: "#6b4a2b", sash: "#8a6a2a", turban: "#4a5a30", hair: "#1a1008", shoe: "#2a1a10", sleeves: true, sleeve: "#5a4026", belly: true },
  shade: { skin: "#7ba7b8", pants: "#1d3a48", pantsShade: "#132833", vest: "#24566a", sash: "#56d8ff", turban: "#1a2f3a", hair: "#0a1418", shoe: "#0e1a20", sleeves: true, sleeve: "#1d4a5c" },
  palace: { skin: "#c48d60", pants: "#7a1e22", pantsShade: "#5a1418", vest: "#2a3e7a", sash: "#e0b040", turban: "#c42c30", hair: "#1a1008", shoe: "#3a1a10", sleeves: true, sleeve: "#22346a" },
  jaffar: { skin: "#c9946a", pants: "#3a1050", pantsShade: "#2a0a3a", vest: "#5a1a78", sash: "#e0b040", turban: "#2a0838", hair: "#120610", shoe: "#1a0820", sleeves: true, sleeve: "#4a1466", robe: "#5a1a78", tall: true, beard: true },
  princess: { skin: "#e8b48c", pants: "#d77a9a", pantsShade: "#b85a7c", vest: "#f2c6d4", sash: "#e8c050", turban: null, hair: "#1a0c06", shoe: "#a04060", sleeves: true, sleeve: "#f2c6d4", dress: "#e07fa2", longHair: true },
};

function limb(ctx, a, b, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
}

function drawLeg(ctx, J, s, st, dark) {
  const { knee, foot } = J.legs[s];
  const k = dark ? 0.78 : 1;
  ctx.lineCap = "round";
  limb(ctx, J.hip, knee, 10.5, shade(dark ? st.pantsShade : st.pants, dark ? 0.95 : 1));
  limb(ctx, knee, foot, 7.5, shade(dark ? st.pantsShade : st.pants, k));
  // curled slipper
  ctx.fillStyle = shade(st.shoe, k);
  ctx.beginPath();
  ctx.moveTo(foot[0] - 3, foot[1] - 2);
  ctx.quadraticCurveTo(foot[0] + 5, foot[1] + 1, foot[0] + 8, foot[1] - 3);
  ctx.lineTo(foot[0] + 4, foot[1] + 1.5);
  ctx.lineTo(foot[0] - 3, foot[1] + 1.5);
  ctx.closePath();
  ctx.fill();
}

function drawArm(ctx, J, s, st, dark) {
  const { elbow, hand } = J.arms[s];
  const k = dark ? 0.75 : 1;
  ctx.lineCap = "round";
  limb(ctx, J.shoulder, elbow, 5.2, shade(st.sleeves ? st.sleeve : st.skin, k));
  limb(ctx, elbow, hand, 4.2, shade(st.skin, k));
  ctx.fillStyle = shade(st.skin, k);
  ctx.beginPath();
  ctx.arc(hand[0], hand[1], 2.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawSword(ctx, J) {
  const [hx, hy] = J.arms.r.hand;
  const a = J.swordAngle;
  const dx = Math.sin(a), dy = Math.cos(a);
  const nx = -dy, ny = dx;
  const L = 27;
  const tip = [hx + dx * L, hy + dy * L];
  // guard
  ctx.strokeStyle = "#d9a83a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hx + nx * 4, hy + ny * 4);
  ctx.lineTo(hx - nx * 4, hy - ny * 4);
  ctx.stroke();
  // curved blade
  const g = ctx.createLinearGradient(hx, hy, tip[0], tip[1]);
  g.addColorStop(0, "#dfe6ee");
  g.addColorStop(1, "#ffffff");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(hx + nx * 1.4, hy + ny * 1.4);
  ctx.quadraticCurveTo(hx + dx * L * 0.6 + nx * 4.5, hy + dy * L * 0.6 + ny * 4.5, tip[0] + nx * 2.5, tip[1] + ny * 2.5);
  ctx.quadraticCurveTo(hx + dx * L * 0.55 + nx * 1, hy + dy * L * 0.55 + ny * 1, hx - nx * 1.4, hy - ny * 1.4);
  ctx.closePath();
  ctx.fill();
  return tip;
}

export function drawFigure(ctx, x, y, facing, pose, st, opts = {}) {
  const J = solve(pose);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.silhouette) {
    st = { skin: "#04060c", pants: "#04060c", pantsShade: "#020308", vest: "#04060c", sash: "#0b1a2a", turban: "#04060c", hair: "#04060c", shoe: "#020308", sleeves: false };
    ctx.shadowColor = opts.glow || "rgba(80,220,255,0.9)";
    ctx.shadowBlur = 10;
  }
  drawArm(ctx, J, "l", st, true);
  drawLeg(ctx, J, "l", st, true);

  // robe (vizier) / dress (princess)
  if (st.robe || st.dress) {
    const c = st.robe || st.dress;
    const lf = J.legs.l.foot, rf = J.legs.r.foot;
    const lowY = Math.max(lf[1], rf[1]) - (st.dress ? 1 : 6);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(J.shoulder[0] - 5, J.shoulder[1]);
    ctx.lineTo(J.shoulder[0] + 5, J.shoulder[1]);
    ctx.lineTo(Math.max(lf[0], rf[0]) + 8, lowY);
    ctx.lineTo(Math.min(lf[0], rf[0]) - 8, lowY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = st.sash;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // torso
  const [hx, hy] = J.hip, [sx, sy] = J.neck;
  const tdx = sx - hx, tdy = sy - hy;
  const tl = Math.hypot(tdx, tdy) || 1;
  const nx = -tdy / tl, ny = tdx / tl;
  ctx.fillStyle = st.vest;
  ctx.beginPath();
  ctx.moveTo(hx + nx * 5.5, hy + ny * 5.5);
  ctx.lineTo(sx + nx * 6.5, sy + ny * 6.5);
  ctx.quadraticCurveTo(sx, sy - 2, sx - nx * 6.5, sy - ny * 6.5);
  ctx.lineTo(hx - nx * 5.5, hy - ny * 5.5);
  ctx.closePath();
  ctx.fill();
  if (!st.sleeves && !opts.silhouette) {
    // open vest showing chest
    ctx.fillStyle = st.skin;
    ctx.beginPath();
    ctx.moveTo(sx + nx * 2, sy + ny * 2);
    ctx.lineTo(hx + tdx * 0.35 + nx * 0.5, hy + tdy * 0.35 + ny * 0.5);
    ctx.lineTo(sx - nx * 1.5, sy - ny * 1.5);
    ctx.closePath();
    ctx.fill();
  }
  if (st.belly) {
    ctx.fillStyle = st.vest;
    ctx.beginPath();
    ctx.ellipse(hx + tdx * 0.35 + 4, hy + tdy * 0.35, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // sash
  limb(ctx, [hx + nx * 5 + tdx * 0.12, hy + ny * 5 + tdy * 0.12], [hx - nx * 5 + tdx * 0.12, hy - ny * 5 + tdy * 0.12], 3.5, st.sash);
  if (!st.robe && !st.dress) {
    ctx.strokeStyle = st.sash;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - nx * 4, hy - ny * 4);
    ctx.quadraticCurveTo(hx - nx * 6 - 2, hy + 6, hx - nx * 8 - 3, hy + 9 + Math.sin(performance.now() / 200) * 1.2);
    ctx.stroke();
  }

  drawLeg(ctx, J, "r", st, false);

  // head
  const [hdx, hdy] = J.head;
  const ha = J.headAngle;
  ctx.save();
  ctx.translate(hdx, hdy);
  ctx.rotate(ha);
  if (st.longHair) {
    ctx.fillStyle = st.hair;
    ctx.beginPath();
    ctx.ellipse(-4, 6, 4.5, 11, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = st.skin;
  ctx.beginPath();
  ctx.ellipse(0.6, 0.5, HEAD * 0.92, HEAD, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); // nose
  ctx.moveTo(5, -1);
  ctx.lineTo(7.4, 1.6);
  ctx.lineTo(5, 2.4);
  ctx.fill();
  if (st.beard) {
    ctx.fillStyle = st.hair;
    ctx.beginPath();
    ctx.moveTo(-1, 3);
    ctx.quadraticCurveTo(3, 12, 6, 4);
    ctx.lineTo(4, 3);
    ctx.fill();
  }
  if (!opts.silhouette) {
    ctx.fillStyle = "#1a0d06";
    ctx.fillRect(2.8, -1.4, 1.6, 1.4);
  } else {
    ctx.fillStyle = opts.eye || "#8ff";
    ctx.fillRect(2.6, -1.6, 2.4, 1.6);
  }
  if (st.turban) {
    ctx.fillStyle = st.turban;
    ctx.beginPath();
    if (st.tall) {
      ctx.moveTo(-6, -1);
      ctx.quadraticCurveTo(-7, -14, 0, -20);
      ctx.quadraticCurveTo(8, -12, 7, -1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e0b040";
      ctx.beginPath();
      ctx.arc(2, -6, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.ellipse(-0.5, -3, 7.2, 5.4, -0.15, Math.PI * 0.95, Math.PI * 2.1);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-1, -6.5, 4.2, 0, Math.PI * 2);
      ctx.fill();
      if (!opts.silhouette) {
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(-1, -4, 6, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    }
  } else {
    ctx.fillStyle = st.hair;
    ctx.beginPath();
    ctx.ellipse(-0.5, -2.5, 6.6, 4.6, -0.2, Math.PI * 0.9, Math.PI * 2.05);
    ctx.fill();
  }
  ctx.restore();

  let tip = null;
  if (opts.sword) tip = drawSword(ctx, J);
  drawArm(ctx, J, "r", st, false);
  ctx.restore();
  if (tip) return [x + tip[0] * facing, y + tip[1]];
  return null;
}
