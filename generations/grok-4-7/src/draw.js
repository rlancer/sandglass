import {
  W,
  H,
  COLS,
  TILE,
  surfaceY,
  rooms,
  spikeVisual,
  bladeVisual,
  fmtTime,
} from "./levels.js";
import { drawFigure } from "./figure.js";

const SERIF = '"Bodoni Moda", Palatino, "Palatino Linotype", serif';
const SANS = 'Sora, "Segoe UI", sans-serif';

const DAY = {
  stone: "#d7b07a",
  hi: "#f3ddb4",
  lo: "#8d6238",
  joint: "#5c3d28",
  metal: "#e6b34a",
  pit: "rgba(12,7,4,0.72)",
  mark: "#e6b34a",
};
const NIGHT = {
  stone: "#3a4b74",
  hi: "#d5def2",
  lo: "#1a223c",
  joint: "#12182c",
  metal: "#c9d6ea",
  pit: "rgba(4,6,14,0.78)",
  mark: "#d5deef",
};

const PRINCE = {
  skin: "#c4814d",
  skinHi: "#db9a64",
  hair: "#16110e",
  scarf: "#f7f1e6",
  vest: "#8f1d32",
  inner: "#243e86",
  gold: "#e6b34a",
  cloth: "#f3ecdf",
  boot: "#2a1c14",
  blade: "#e7eef6",
};
const GUARD_D = {
  skin: "#a86b42",
  skinHi: "#c4814d",
  hair: "#1a120e",
  scarf: "#5c1a28",
  vest: "#8a6234",
  inner: "#4a3018",
  gold: "#e6c98a",
  cloth: "#6e2430",
  boot: "#1a120e",
  blade: "#f0e2c4",
  helm: true,
  plume: "#e6b34a",
};
const GUARD_N = {
  ...GUARD_D,
  vest: "#6d7c98",
  inner: "#2a3350",
  gold: "#d5deef",
  plume: "#d5deef",
  blade: "#e4ecf6",
};
const LALEH = {
  skin: "#c4814d",
  skinHi: "#db9a64",
  hair: "#16110e",
  scarf: "#f3e2c0",
  vest: "#2c4f9a",
  inner: "#e6b34a",
  gold: "#e6b34a",
  cloth: "#2c4f9a",
  boot: "#1c2748",
  blade: "#e7eef6",
  gown: true,
};

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => {
    const av = (pa >> s) & 255;
    const bv = (pb >> s) & 255;
    return Math.round(av + (bv - av) * t);
  });
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function pal(t) {
  const o = {};
  for (const k of Object.keys(DAY)) {
    if (DAY[k].startsWith("#") && NIGHT[k].startsWith("#")) o[k] = mix(DAY[k], NIGHT[k], t);
    else o[k] = t < 0.5 ? DAY[k] : NIGHT[k];
  }
  return o;
}

function solid(game, rm, col, row, phase, live) {
  if (!rm || col < 0 || col >= COLS || row < 0 || row > 2) return false;
  const b = rm.bridge;
  if (b && b.row === row && b.cols.includes(col) && game.dead.has(b.guard)) {
    const risen = live ? game.bridgeT : 1;
    if (risen > 0.82) return true;
  }
  if (live && game.looseGone.has(`${row},${col}`)) return false;
  const ch = rm.grid[row][col];
  if (ch === "#" || ch === "~" || ch === "^") return true;
  if (ch === "D" || ch === "d") return phase === "day";
  if (ch === "N" || ch === "n") return phase === "night";
  return false;
}

function ease(p) {
  return p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
}

function slide(tr) {
  const e = ease(Math.min(1, tr.t / tr.dur));
  if (tr.dir === "right") return { fx: -e * W, fy: 0, tx: (1 - e) * W, ty: 0 };
  if (tr.dir === "left") return { fx: e * W, fy: 0, tx: -(1 - e) * W, ty: 0 };
  if (tr.dir === "up") return { fx: 0, fy: -e * H, tx: 0, ty: (1 - e) * H };
  return { fx: 0, fy: e * H, tx: 0, ty: -(1 - e) * H };
}

function pointed(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h * 0.52);
  ctx.bezierCurveTo(x, y - h * 0.92, x + w * 0.42, y - h, x + w * 0.5, y - h);
  ctx.bezierCurveTo(x + w * 0.58, y - h, x + w, y - h * 0.92, x + w, y - h * 0.52);
  ctx.lineTo(x + w, y);
}

function drawBackdrop(ctx, game, assets) {
  const t = game.phaseBlend;
  const sky = mix("#1a120c", "#0b1020", t);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.72;
  if (assets.day) {
    ctx.globalAlpha = 0.78 * (1 - t);
    ctx.drawImage(assets.day, 0, 0, W, H);
  }
  if (assets.night) {
    ctx.globalAlpha = 0.78 * t;
    ctx.drawImage(assets.night, 0, 0, W, H);
  }
  ctx.restore();
  if (!assets.day && !assets.night) {
    ctx.fillStyle = t < 0.5 ? "#3a2a1c" : "#1a2238";
    for (let i = 0; i < 5; i++) {
      pointed(ctx, 28 + i * 190, 168, 150, 130);
      ctx.fill();
    }
  }
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, "rgba(0,0,0,0.15)");
  wash.addColorStop(0.35, "rgba(0,0,0,0)");
  wash.addColorStop(1, t < 0.5 ? "rgba(40,22,10,0.28)" : "rgba(6,8,18,0.35)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  const flame = t < 0.5 ? "#ffb45a" : "#b9d4ff";
  for (const x of [118, 842]) {
    const fy = 78 + Math.sin(game.time * 7 + x) * 2;
    const g = ctx.createRadialGradient(x, fy, 2, x, fy, 54);
    g.addColorStop(0, flame);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, fy, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2118";
    ctx.fillRect(x - 4, fy + 8, 8, 16);
  }
}

function drawStar(ctx, x, y, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.38;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSlab(ctx, x, sy, h, p, ch, loose) {
  const wobble = loose > 0 && loose < 1 ? Math.sin(loose * 40) * 2.2 * loose : 0;
  ctx.save();
  ctx.translate(wobble, 0);
  ctx.fillStyle = p.stone;
  ctx.fillRect(x, sy, TILE, h);
  ctx.fillStyle = p.hi;
  ctx.fillRect(x + 3, sy, TILE - 6, 7);
  ctx.fillStyle = p.lo;
  ctx.fillRect(x, sy + h - 8, TILE, 8);
  ctx.fillStyle = p.joint;
  ctx.fillRect(x, sy, 2, h);
  if (h > 48) {
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = p.joint;
    ctx.lineWidth = 1;
    for (let yy = sy + 16; yy < sy + h - 8; yy += 14) {
      const shift = ((yy / 14) | 0) % 2 === 0 ? 0 : 10;
      ctx.beginPath();
      ctx.moveTo(x + 4 + shift, yy);
      ctx.lineTo(x + TILE - 4, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.55;
  drawStar(ctx, x + TILE * 0.5, sy + Math.min(22, h * 0.45), 5, p.metal);
  ctx.globalAlpha = 1;
  if (ch === "D" || ch === "N") {
    ctx.fillStyle = ch === "D" ? "#e6b34a" : "#d5deef";
    ctx.beginPath();
    ctx.arc(x + 14, sy + 16, 4, 0, Math.PI * 2);
    ctx.fill();
    if (ch === "N") {
      ctx.fillStyle = p.stone;
      ctx.beginPath();
      ctx.arc(x + 16, sy + 15, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSpikes(ctx, x, sy, up, warn) {
  const rise = up ? 0 : 16;
  ctx.save();
  ctx.translate(0, rise);
  if (warn) ctx.translate(Math.sin(performance.now() / 30) * 0.8, 0);
  for (let i = 0; i < 4; i++) {
    const bx = x + 12 + i * 20;
    ctx.beginPath();
    ctx.moveTo(bx, sy);
    ctx.lineTo(bx + 8, sy);
    ctx.lineTo(bx + 4, sy - 22);
    ctx.closePath();
    ctx.fillStyle = up ? "#d7dde4" : "#6a6258";
    ctx.fill();
    ctx.strokeStyle = "#2a241e";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = up ? "#f4f7fb" : "#8a8074";
    ctx.beginPath();
    ctx.moveTo(bx + 4, sy - 22);
    ctx.lineTo(bx + 8, sy);
    ctx.lineTo(bx + 5, sy);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBottle(ctx, x, y, kind) {
  const liquid = kind === "life" ? "#9d1c2b" : kind === "sand" ? "#e6b34a" : "#6f8f32";
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(220,230,240,0.35)";
  ctx.fillRect(x - 7, y - 26, 14, 22);
  ctx.fillStyle = liquid;
  ctx.fillRect(x - 5, y - 16, 10, 10);
  ctx.fillStyle = "#f3ecdf";
  ctx.fillRect(x - 3, y - 32, 6, 8);
  if (kind === "bile") {
    ctx.strokeStyle = "#1a120e";
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 22);
    ctx.lineTo(x + 2, y - 14);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 24);
  ctx.lineTo(x - 4, y - 10);
  ctx.stroke();
}

function drawItem(ctx, item) {
  const x = (item.col + 0.5) * TILE;
  const y = surfaceY(item.row);
  if (item.kind === "sword") {
    ctx.save();
    ctx.translate(x, y - 8);
    ctx.rotate(-1.15);
    ctx.fillStyle = "#e7eef6";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(16, -18, 40, -8);
    ctx.quadraticCurveTo(18, -8, 0, 4);
    ctx.fill();
    ctx.fillStyle = "#e6b34a";
    ctx.fillRect(-4, 2, 10, 5);
    ctx.restore();
    ctx.fillStyle = "#8d6238";
    ctx.fillRect(x - 14, y - 8, 28, 8);
    return;
  }
  drawBottle(ctx, x, y, item.kind);
}

function drawGate(ctx, gate, open, p) {
  const x = gate.col * TILE;
  const sy = surfaceY(gate.row);
  const lift = open * 118;
  ctx.save();
  ctx.translate(0, -lift);
  ctx.fillStyle = p.lo;
  ctx.fillRect(x + 8, sy - 122, TILE - 16, 10);
  ctx.fillStyle = p.metal;
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x + 16 + i * 13, sy - 112, 4, 112);
  }
  ctx.fillRect(x + 14, sy - 70, TILE - 28, 4);
  const cx = x + TILE / 2;
  ctx.beginPath();
  ctx.moveTo(x + 14, sy - 112);
  ctx.lineTo(cx, sy - 132);
  ctx.lineTo(x + TILE - 14, sy - 112);
  ctx.strokeStyle = p.metal;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawBlade(ctx, blade, vis) {
  const x = blade.col * TILE;
  const sy = surfaceY(blade.row);
  const top = sy - 150;
  const drop = top + vis.h * 132;
  if (vis.warn) {
    ctx.fillStyle = "rgba(180,40,40,0.18)";
    ctx.fillRect(x + 24, sy - 4, TILE - 48, 4);
  }
  ctx.fillStyle = "#2a241c";
  ctx.fillRect(x + 18, top, TILE - 36, 8);
  ctx.fillStyle = "#c5ccd4";
  ctx.beginPath();
  ctx.moveTo(x + 28, drop);
  ctx.lineTo(x + TILE - 28, drop);
  ctx.lineTo(x + TILE - 36, drop + 18);
  ctx.lineTo(x + 36, drop + 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f4f7fb";
  ctx.fillRect(x + TILE / 2 - 2, drop, 3, 16);
}

function drawArch(ctx, col, row, p, time) {
  const x = col * TILE + TILE / 2;
  const sy = surfaceY(row);
  const pulse = 0.45 + Math.sin(time * 3) * 0.15;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = p.metal;
  ctx.lineWidth = 2;
  pointed(ctx, x - 28, sy - 8, 56, 78);
  ctx.stroke();
  ctx.restore();
}

function drawRoom(ctx, game, rm, ox, oy, live) {
  const phase = game.phase;
  const other = phase === "day" ? "night" : "day";
  const p = pal(game.phaseBlend);
  const ghostPal = other === "night" ? NIGHT : DAY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, W, H);
  ctx.clip();
  ctx.translate(ox, oy);

  for (let row = 2; row >= 0; row--) {
    const sy = surfaceY(row);
    for (let col = 0; col < COLS; col++) {
      const here = solid(game, rm, col, row, phase, live);
      const there = solid(game, rm, col, row, other, live);
      const x = col * TILE;
      const ch = rm.grid[row][col];
      if (!here && !there) {
        const g = ctx.createLinearGradient(0, sy - 20, 0, sy + 120);
        g.addColorStop(0, "rgba(0,0,0,0.05)");
        g.addColorStop(1, p.pit);
        ctx.fillStyle = g;
        ctx.fillRect(x, sy - 8, TILE, row === 0 ? H - sy + 8 : 150);
        continue;
      }
      if (!here && there) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        const h = row === 0 ? H - sy : 32;
        drawSlab(ctx, x, sy, h, ghostPal, ch, 0);
        ctx.restore();
        continue;
      }
      let h = row === 0 ? H - sy : 32;
      const b = rm.bridge;
      const bridging =
        b && b.row === row && b.cols.includes(col) && game.dead.has(b.guard) && ch === ".";
      if (bridging) {
        const t = live ? game.bridgeT : 1;
        ctx.save();
        ctx.translate(0, (1 - t) * 48);
        ctx.globalAlpha = 0.4 + t * 0.6;
        drawSlab(ctx, x, sy, h, p, "#", 0);
        ctx.restore();
        continue;
      }
      const looseKey = `${row},${col}`;
      const loose =
        ch === "~" && live ? Math.min(1, (game.looseTimer.get(looseKey) || 0) / 0.52) : 0;
      drawSlab(ctx, x, sy, h, p, ch, loose);
      const spike = spikeVisual(game.time, col, row, ch, phase);
      if (spike) drawSpikes(ctx, x, sy, spike.up, spike.warn);
    }
  }

  for (const plate of rm.plates || []) {
    const x = (plate.col + 0.5) * TILE;
    const y = surfaceY(plate.row);
    const down = live && game.plateDown(plate);
    ctx.beginPath();
    ctx.arc(x, y - (down ? 1 : 4), 16, 0, Math.PI * 2);
    ctx.fillStyle = down ? p.metal : p.lo;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.metal;
    ctx.stroke();
    drawStar(ctx, x, y - (down ? 1 : 4), 6, down ? "#fff4d0" : p.hi);
  }

  if (live) {
    for (const item of rm.items || []) {
      if (game.taken.has(item.id)) continue;
      drawItem(ctx, item);
    }
  } else {
    for (const item of rm.items || []) {
      if (game.taken.has(item.id)) continue;
      drawItem(ctx, item);
    }
  }

  if (rm.upCols && rm.up) {
    for (const c of rm.upCols) drawArch(ctx, c, 2, p, game.time);
  }
  if (rm.downCols && rm.down) {
    ctx.globalAlpha = 0.7;
    for (const c of rm.downCols) {
      const x = c * TILE;
      const y = surfaceY(0);
      ctx.strokeStyle = p.metal;
      ctx.strokeRect(x + 20, y - 8, TILE - 40, 8);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, W, H);
  ctx.clip();
  ctx.translate(ox, oy);
  for (const gate of rm.gates || []) {
    const open = live ? game.gateAnim[gate.id] ?? 0 : game.latched.has(gate.id) ? 1 : 0;
    drawGate(ctx, gate, open, p);
  }
  for (const blade of rm.blades || []) {
    drawBlade(ctx, blade, bladeVisual(game.time, blade.offset));
  }
  ctx.restore();
}

function drawPeople(ctx, game, ox, oy) {
  ctx.save();
  ctx.translate(ox, oy);
  const phase = game.phase;
  if (game.echo) {
    drawFigure(
      ctx,
      { ...game.echo, kind: "prince", swordOut: game.echo.swordOut, vx: 0, mode: "ground" },
      game.echo.phase,
      game.time,
      0.38,
    );
  }
  if (game.laleh) drawFigure(ctx, game.laleh, phase, game.time, 1);
  for (const g of game.guards) {
    if (g.mode === "gone") continue;
    const here = game.guardHere(g);
    drawFigure(ctx, g, phase, game.time, here ? 1 : 0.28);
    if (here && g.alive && g.alert) {
      const y = g.y - 130;
      for (let i = 0; i < g.maxHp; i++) {
        ctx.fillStyle = i < g.hp ? "#c4323c" : "rgba(255,255,255,0.2)";
        ctx.fillRect(g.x - g.maxHp * 4 + i * 8, y, 6, 6);
      }
    }
  }
  const prince = game.player;
  prince.sheathed = game.hasSword && !prince.swordOut;
  const blink = game.iframe > 0 && Math.floor(game.time * 18) % 2 === 0 && prince.mode !== "dead";
  if (!blink) drawFigure(ctx, prince, phase, game.time, 1);
  ctx.restore();
}

function diamond(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawHUD(ctx, game) {
  const p = pal(game.phaseBlend);
  ctx.save();
  const hp = game.player?.hp ?? 0;
  const max = game.player?.maxHp ?? 5;
  for (let i = 0; i < max; i++) {
    diamond(ctx, 28 + i * 18, 26, 6, i < hp ? "#9d1c2b" : "rgba(243,226,192,0.25)");
    ctx.strokeStyle = p.metal;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const cx = W / 2;
  const sand = Math.max(0, game.sand);
  const frac = Math.min(1, sand / 540);
  ctx.strokeStyle = p.metal;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 10, 10);
  ctx.lineTo(cx + 10, 10);
  ctx.lineTo(cx + 2, 28);
  ctx.lineTo(cx - 2, 28);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 2, 30);
  ctx.lineTo(cx + 2, 30);
  ctx.lineTo(cx + 10, 48);
  ctx.lineTo(cx - 10, 48);
  ctx.closePath();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = sand < 30 ? "#c4323c" : "#e6b34a";
  const upper = 18 * (1 - frac);
  ctx.fillRect(cx - 10, 10 + upper, 20, 18 - upper);
  ctx.fillRect(cx - 10, 30 + 18 * (1 - frac), 20, 18 * frac);
  ctx.restore();
  ctx.fillStyle = "#f3e2c0";
  ctx.font = `500 13px ${SANS}`;
  ctx.textAlign = "left";
  ctx.fillText(fmtTime(sand), cx + 18, 34);

  const mx = W - 46;
  const my = 30;
  ctx.beginPath();
  ctx.arc(mx, my, 16, 0, Math.PI * 2);
  ctx.strokeStyle = p.metal;
  ctx.stroke();
  if (game.phase === "day") {
    ctx.fillStyle = "#e6b34a";
    ctx.beginPath();
    ctx.arc(mx - 2, my, 7, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#d5deef";
    ctx.beginPath();
    ctx.arc(mx + 1, my, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#12182c";
    ctx.beginPath();
    ctx.arc(mx + 4, my - 1, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f3e2c0";
  ctx.font = `500 10px ${SANS}`;
  ctx.textAlign = "right";
  ctx.fillText(game.phase === "day" ? "DAY" : "NIGHT", mx - 22, 34);

  if (game.hasSword) {
    ctx.save();
    ctx.globalAlpha = game.player.swordOut ? 1 : 0.35;
    ctx.translate(36, 58);
    ctx.rotate(-0.9);
    ctx.fillStyle = "#e7eef8";
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.quadraticCurveTo(14, -8, 28, 0);
    ctx.quadraticCurveTo(14, -2, 0, -2);
    ctx.fill();
    ctx.fillStyle = "#e6b34a";
    ctx.fillRect(-4, -3, 6, 6);
    ctx.restore();
  }

  if (game.bannerT > 0 && game.banner) {
    ctx.globalAlpha = Math.min(1, game.bannerT);
    ctx.fillStyle = "#f3e2c0";
    ctx.font = `italic 500 26px ${SERIF}`;
    ctx.textAlign = "center";
    ctx.fillText(game.banner, W / 2, 78);
    ctx.globalAlpha = 1;
  }

  const rm = rooms[game.roomId];
  if (game.screen === "play" && rm?.hint && !game.hintsDone.has(rm.id)) {
    ctx.fillStyle = "rgba(8,6,4,0.62)";
    ctx.fillRect(0, H - 36, W, 36);
    ctx.fillStyle = "#f3e2c0";
    ctx.font = `400 13px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText(rm.hint, W / 2, H - 14);
  }

  let ty = H - 52;
  ctx.textAlign = "center";
  ctx.font = `500 13px ${SANS}`;
  for (const toast of game.toasts) {
    ctx.globalAlpha = Math.min(1, toast.life);
    ctx.fillStyle = "#f3e2c0";
    ctx.fillText(toast.text, W / 2, ty);
    ty -= 18;
  }
  ctx.globalAlpha = 1;

  if (game.shiftFlash > 0) {
    const u = game.shiftFlash / 0.48;
    ctx.globalAlpha = Math.min(0.55, u);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "#e6b34a");
    g.addColorStop(0.5, "rgba(255,255,255,0.2)");
    g.addColorStop(1, "#d5deef");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (game.hurtFlash > 0) {
    ctx.globalAlpha = Math.min(0.4, game.hurtFlash);
    ctx.fillStyle = "#6e1020";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function paint(ctx, canvas, game, assets) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth || W;
  const ch = canvas.clientHeight || H;
  const pw = Math.round(cw * dpr);
  const ph = Math.round(ch * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (!game.reduce && game.shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }
  drawBackdrop(ctx, game, assets);
  if (game.transition) {
    const sl = slide(game.transition);
    drawRoom(ctx, game, rooms[game.transition.from], sl.fx, sl.fy, true);
    drawPeople(ctx, game, sl.fx, sl.fy);
    const dest = rooms[game.transition.to];
    const prev = game.roomId;
    drawRoom(ctx, game, dest, sl.tx, sl.ty, false);
    game.roomId = prev;
  } else {
    const rm = rooms[game.roomId];
    if (rm) drawRoom(ctx, game, rm, 0, 0, true);
    drawPeople(ctx, game, 0, 0);
  }
  for (const particle of game.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const vig = ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 560);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  if (game.screen === "play" || game.screen === "pause" || game.screen === "fail" || game.screen === "over") {
    drawHUD(ctx, game);
  }
  ctx.restore();
}
