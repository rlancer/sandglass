import { TW, TH, FT, ROOM_W, ROOM_H, VIEW_W, VIEW_H, HUD_H, SCREEN_W, SCREEN_H, surfaceY, ECHO_MAX, ECHO_LINGER, DT } from "./config.js";
import { drawFigure, samplePose, STYLES, blend } from "./skeleton.js";
import { particles } from "./particles.js";

export const THEMES = {
  dungeon: { back: "#3c4356", brick: [92, 102, 126], mortar: "#22262f", wall: [122, 132, 156], floorTop: "#c4ccdc", floorFront: "#6e7790", ambient: "rgb(48,56,90)", torch: [255, 165, 80], flame: ["#fff4c0", "#ffb040", "#e0501a"] },
  mirrors: { back: "#34465a", brick: [76, 100, 126], mortar: "#18202a", wall: [104, 134, 162], floorTop: "#c4d8ea", floorFront: "#5e7890", ambient: "rgb(44,64,100)", torch: [120, 210, 255], flame: ["#f0ffff", "#70e0ff", "#2070d0"] },
  palace: { back: "#7a5a40", brick: [168, 126, 90], mortar: "#4a3222", wall: [214, 168, 116], floorTop: "#f0d6ae", floorFront: "#a88058", ambient: "rgb(96,76,80)", torch: [255, 185, 100], flame: ["#fff8d0", "#ffc050", "#f06020"] },
  tower: { back: "#4a3858", brick: [104, 82, 124], mortar: "#241a2c", wall: [144, 116, 168], floorTop: "#cfbce0", floorFront: "#7a6494", ambient: "rgb(58,42,84)", torch: [255, 120, 220], flame: ["#fff0ff", "#ff80e0", "#a020c0"] },
};

function hash(c, r, k = 0) {
  let h = (c * 374761393 + r * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const rgb = (a, k = 1, add = 0) => `rgb(${Math.max(0, Math.min(255, a[0] * k + add)) | 0},${Math.max(0, Math.min(255, a[1] * k + add)) | 0},${Math.max(0, Math.min(255, a[2] * k + add)) | 0})`;

export class Renderer {
  constructor(canvas, art) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.art = art;
    this.cache = new Map();
    this.light = document.createElement("canvas");
    this.light.width = VIEW_W / 2;
    this.light.height = VIEW_H / 2;
    this.lctx = this.light.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const s = Math.min(window.innerWidth / SCREEN_W, window.innerHeight / SCREEN_H);
    this.scale = s;
    const dpr = window.devicePixelRatio || 1;
    this.k = s * dpr;
    this.canvas.style.width = `${Math.floor(SCREEN_W * s)}px`;
    this.canvas.style.height = `${Math.floor(SCREEN_H * s)}px`;
    this.canvas.width = Math.floor(SCREEN_W * this.k);
    this.canvas.height = Math.floor(SCREEN_H * this.k);
    this.cache.clear();
  }

  begin() {
    const ctx = this.ctx;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  // ---------- static room layers ----------
  roomLayers(world, rx, ry) {
    const key = `${world.level.name}|${rx},${ry}|${world.staticVersion || 0}`;
    let L = this.cache.get(key);
    if (L) return L;
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = Math.ceil(VIEW_W * this.k);
      c.height = Math.ceil(VIEW_H * this.k);
      const g = c.getContext("2d");
      g.setTransform(this.k, 0, 0, this.k, 0, 0);
      return [c, g];
    };
    const [bg, b] = mk();
    const [fg, f] = mk();
    this.paintRoom(b, f, world, rx, ry);
    L = { bg, fg };
    this.cache.set(key, L);
    if (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value);
    return L;
  }

  paintRoom(b, f, world, rx, ry) {
    const T = THEMES[world.level.theme];
    const c0 = rx * ROOM_W, r0 = ry * ROOM_H;
    b.fillStyle = T.back;
    b.fillRect(0, 0, VIEW_W, VIEW_H);

    // back-wall bricks
    for (let y = -16; y < VIEW_H; y += 16) {
      const row = Math.floor((y + r0 * TH) / 16);
      const off = row % 2 ? 16 : 0;
      for (let x = -32 + off; x < VIEW_W; x += 32) {
        const gx = x + c0 * TW;
        const h = hash(Math.floor(gx / 32), row, 7);
        b.fillStyle = rgb(T.brick, 0.82 + h * 0.3);
        b.fillRect(x + 1, y + 1, 30, 14);
        b.fillStyle = "rgba(255,255,255,0.05)";
        b.fillRect(x + 1, y + 1, 30, 2);
        b.fillStyle = "rgba(0,0,0,0.18)";
        b.fillRect(x + 1, y + 13, 30, 2);
        if (h > 0.93) {
          b.strokeStyle = "rgba(0,0,0,0.35)";
          b.lineWidth = 0.8;
          b.beginPath();
          b.moveTo(x + 6, y + 2);
          b.lineTo(x + 12, y + 8);
          b.lineTo(x + 9, y + 14);
          b.stroke();
        }
      }
    }
    this.themeBackDecor(b, world, rx, ry, T);

    for (let r = r0; r < r0 + ROOM_H; r++) {
      for (let c = c0; c < c0 + ROOM_W; c++) {
        const cell = world.cell(c, r);
        const x = (c - c0) * TW, y = (r - r0) * TH, s = surfaceY(r) - r0 * TH;
        if (cell.window) this.paintWindow(b, x, s, c, r);
        if (cell.t === "exit") this.paintExitFrame(b, x, s, T);
        if (cell.torch) this.paintSconce(b, x, s);
      }
    }

    // slab shadows on the back wall
    for (let r = r0 - 1; r < r0 + ROOM_H; r++) {
      for (let c = c0; c < c0 + ROOM_W; c++) {
        const cell = world.cell(c, r);
        const x = (c - c0) * TW, s = surfaceY(r) - r0 * TH;
        if (world.hasFloor(c, r) && cell.t !== "loose" && !world.isWall(c, r + 1)) {
          const g = b.createLinearGradient(0, s + FT, 0, s + FT + 26);
          g.addColorStop(0, "rgba(0,0,0,0.45)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          b.fillStyle = g;
          b.fillRect(x, s + FT, TW, 26);
        }
        if (world.isWall(c, r) && !world.isWall(c + 1, r)) {
          const g = b.createLinearGradient(x + TW, 0, x + TW + 22, 0);
          g.addColorStop(0, "rgba(0,0,0,0.4)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          b.fillStyle = g;
          b.fillRect(x + TW, (r - r0) * TH - FT, 22, TH);
        }
      }
    }

    // walls and floors
    for (let r = r0 - 1; r <= r0 + ROOM_H; r++) {
      for (let c = c0 - 1; c <= c0 + ROOM_W; c++) {
        const cell = world.cell(c, r);
        const x = (c - c0) * TW, y = (r - r0) * TH, s = surfaceY(r) - r0 * TH;
        if (cell.t === "wall") this.paintWall(b, world, c, r, x, y, T);
        else if (world.hasFloor(c, r) && cell.t !== "loose") this.paintSlab(b, x, s, T, c, r);
        if (cell.pillar) this.paintPillar(f, x, y, s, T);
      }
    }
  }

  themeBackDecor(b, world, rx, ry, T) {
    const theme = world.level.theme;
    const c0 = rx * ROOM_W, r0 = ry * ROOM_H;
    for (let r = r0; r < r0 + ROOM_H; r++) {
      for (let c = c0; c < c0 + ROOM_W; c++) {
        if (world.isWall(c, r)) continue;
        const x = (c - c0) * TW, s = surfaceY(r) - r0 * TH;
        const h = hash(c, r, 3);
        const cell = world.cell(c, r);
        if (cell.window || cell.torch || cell.t === "exit") continue;
        if (theme === "dungeon" && h < 0.18 && !world.hasFloor(c, r - 1)) {
          // hanging chain
          b.strokeStyle = "rgba(20,22,28,0.9)";
          b.lineWidth = 1.5;
          const len = 30 + h * 200;
          for (let i = 0; i < len; i += 5) {
            b.beginPath();
            b.ellipse(x + 20 + h * 30, s - 116 + i, 1.5, 3, 0, 0, Math.PI * 2);
            b.stroke();
          }
        } else if (theme === "dungeon" && h > 0.86 && world.hasFloor(c, r)) {
          // skull and bones
          const bx = x + 14 + h * 30;
          b.fillStyle = "#bdb6a0";
          b.beginPath();
          b.ellipse(bx, s - 4, 4.5, 4, 0, 0, Math.PI * 2);
          b.fill();
          b.fillRect(bx + 6, s - 3, 12, 2);
          b.fillStyle = "#222";
          b.fillRect(bx - 2.5, s - 5, 1.6, 1.6);
          b.fillRect(bx + 0.8, s - 5, 1.6, 1.6);
        } else if (theme === "mirrors" && h < 0.35) {
          // broken mirror panel
          const mx = x + 14, my = s - 98;
          b.fillStyle = "#3a4a5a";
          b.beginPath();
          b.moveTo(mx, my + 70);
          b.lineTo(mx, my + 14);
          b.quadraticCurveTo(mx + 18, my - 8, mx + 36, my + 14);
          b.lineTo(mx + 36, my + 70);
          b.closePath();
          b.fill();
          const g = b.createLinearGradient(mx, my, mx + 36, my + 70);
          g.addColorStop(0, "#9cc8de");
          g.addColorStop(0.5, "#1a2836");
          g.addColorStop(1, "#5a8aa6");
          b.fillStyle = g;
          b.beginPath();
          b.moveTo(mx + 3, my + 67);
          b.lineTo(mx + 3, my + 15);
          b.quadraticCurveTo(mx + 18, my - 3, mx + 33, my + 15);
          b.lineTo(mx + 33, my + 67);
          b.closePath();
          b.fill();
          b.strokeStyle = "rgba(10,14,20,0.9)";
          b.lineWidth = 1;
          b.beginPath();
          const cx = mx + 10 + h * 40, cy = my + 30 + h * 30;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + h * 5;
            b.moveTo(cx, cy);
            b.lineTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
          }
          b.stroke();
          b.strokeStyle = "#c9a24a";
          b.lineWidth = 2;
          b.beginPath();
          b.moveTo(mx, my + 70);
          b.lineTo(mx, my + 14);
          b.quadraticCurveTo(mx + 18, my - 8, mx + 36, my + 14);
          b.lineTo(mx + 36, my + 70);
          b.stroke();
        } else if (theme === "palace") {
          // tile frieze
          const fy = s - 70;
          b.fillStyle = "#1f3f7a";
          b.fillRect(x, fy, TW, 14);
          b.fillStyle = "#d9b048";
          for (let i = 0; i < 4; i++) {
            const px = x + 8 + i * 16;
            b.beginPath();
            b.moveTo(px, fy + 2);
            b.lineTo(px + 5, fy + 7);
            b.lineTo(px, fy + 12);
            b.lineTo(px - 5, fy + 7);
            b.closePath();
            b.fill();
          }
          b.fillStyle = "#7a2a24";
          b.fillRect(x, fy - 2, TW, 2);
          b.fillRect(x, fy + 14, TW, 2);
          if (h < 0.4) {
            b.fillStyle = "rgba(0,0,0,0.22)";
            b.beginPath();
            b.moveTo(x + 14, s);
            b.lineTo(x + 14, s - 44);
            b.quadraticCurveTo(x + 32, s - 66, x + 50, s - 44);
            b.lineTo(x + 50, s);
            b.fill();
          }
        } else if (theme === "tower" && h < 0.3) {
          b.strokeStyle = "rgba(200,120,255,0.35)";
          b.lineWidth = 1.2;
          const cx = x + 32, cy = s - 70;
          b.beginPath();
          b.arc(cx, cy, 12, 0, Math.PI * 2);
          b.moveTo(cx, cy - 12);
          b.lineTo(cx + 10, cy + 6);
          b.lineTo(cx - 10, cy + 6);
          b.closePath();
          b.stroke();
        }
      }
    }
  }

  paintWall(b, world, c, r, x, y, T) {
    const top = y - FT;
    b.fillStyle = rgb(T.wall, 0.75);
    b.fillRect(x, top, TW, TH + FT);
    const rows = 3;
    const bh = (TH + FT) / rows;
    for (let i = 0; i < rows; i++) {
      const by = top + i * bh;
      const split = 0.3 + hash(c, r * 3 + i, 1) * 0.4;
      const parts = [[0, split], [split, 1]];
      for (const [a, z] of parts) {
        const bx = x + a * TW, bw = (z - a) * TW;
        const h = hash(c * 2 + a * 10, r * 3 + i, 2);
        b.fillStyle = rgb(T.wall, 0.85 + h * 0.25);
        b.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
        b.fillStyle = "rgba(255,255,255,0.12)";
        b.fillRect(bx + 1, by + 1, bw - 2, 2);
        b.fillRect(bx + 1, by + 1, 2, bh - 2);
        b.fillStyle = "rgba(0,0,0,0.25)";
        b.fillRect(bx + 1, by + bh - 3, bw - 2, 2);
        b.fillRect(bx + bw - 3, by + 1, 2, bh - 2);
        if (h > 0.85) {
          b.strokeStyle = "rgba(0,0,0,0.4)";
          b.lineWidth = 1;
          b.beginPath();
          b.moveTo(bx + bw * 0.3, by + 3);
          b.lineTo(bx + bw * 0.45, by + bh * 0.5);
          b.lineTo(bx + bw * 0.35, by + bh - 4);
          b.stroke();
        }
        if (world.level.theme === "dungeon" && h < 0.12) {
          b.fillStyle = "rgba(70,110,60,0.45)";
          b.beginPath();
          b.ellipse(bx + bw / 2, by + bh - 3, bw / 2.5, 3, 0, 0, Math.PI * 2);
          b.fill();
        }
      }
    }
    if (!world.isWall(c, r - 1)) {
      b.fillStyle = T.floorTop;
      b.fillRect(x, top - 4, TW, 5);
      b.fillStyle = "rgba(255,255,255,0.15)";
      b.fillRect(x, top - 4, TW, 1);
    }
  }

  paintSlab(b, x, s, T, c, r, jitter = 0) {
    b.save();
    if (jitter) b.translate((Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter);
    b.fillStyle = T.floorTop;
    b.fillRect(x, s - 5, TW, 6);
    b.fillStyle = "rgba(255,255,255,0.18)";
    b.fillRect(x, s - 5, TW, 1);
    b.fillStyle = T.floorFront;
    b.fillRect(x, s + 1, TW, FT - 1);
    b.fillStyle = "rgba(0,0,0,0.35)";
    const seam = 10 + hash(c, r, 9) * 44;
    b.fillRect(x + seam, s + 1, 1.5, FT - 1);
    b.fillRect(x, s + FT - 2, TW, 2);
    b.fillStyle = "rgba(0,0,0,0.2)";
    b.fillRect(x + TW - 1, s - 5, 1, FT + 5);
    b.restore();
  }

  paintSconce(b, x, s) {
    b.fillStyle = "#2a2018";
    b.fillRect(x + 30, s - 62, 4, 16);
    b.fillStyle = "#4a3a28";
    b.beginPath();
    b.moveTo(x + 24, s - 66);
    b.lineTo(x + 40, s - 66);
    b.lineTo(x + 36, s - 60);
    b.lineTo(x + 28, s - 60);
    b.closePath();
    b.fill();
  }

  paintWindow(b, x, s, c, r) {
    const img = this.art.skyline;
    const wx = x + 12, wy = s - 100, ww = 40, wh = 72;
    b.save();
    b.beginPath();
    b.moveTo(wx, wy + wh);
    b.lineTo(wx, wy + 18);
    b.quadraticCurveTo(wx + ww / 2, wy - 8, wx + ww, wy + 18);
    b.lineTo(wx + ww, wy + wh);
    b.closePath();
    b.clip();
    if (img) {
      const sw = img.width * 0.22, sh = img.height * 0.5;
      const sx = ((c * 37) % 70) / 100 * (img.width - sw);
      b.drawImage(img, sx, img.height * 0.1, sw, sh, wx, wy - 8, ww, wh + 8);
    } else {
      b.fillStyle = "#1a2550";
      b.fillRect(wx, wy - 8, ww, wh + 8);
    }
    b.restore();
    b.strokeStyle = "#1a1410";
    b.lineWidth = 3;
    b.beginPath();
    b.moveTo(wx, wy + wh);
    b.lineTo(wx, wy + 18);
    b.quadraticCurveTo(wx + ww / 2, wy - 8, wx + ww, wy + 18);
    b.lineTo(wx + ww, wy + wh);
    b.closePath();
    b.stroke();
    b.lineWidth = 1.5;
    b.beginPath();
    for (let i = 1; i < 4; i++) {
      b.moveTo(wx + (ww * i) / 4, wy);
      b.lineTo(wx + (ww * i) / 4, wy + wh);
    }
    b.moveTo(wx, wy + 40);
    b.lineTo(wx + ww, wy + 40);
    b.stroke();
    b.fillStyle = "#3a2c20";
    b.fillRect(wx - 4, wy + wh, ww + 8, 4);
  }

  paintExitFrame(b, x, s, T) {
    const dx = x + 8, dw = 48, dh = 86, dy = s - dh;
    b.fillStyle = "#07060a";
    b.beginPath();
    b.moveTo(dx, s);
    b.lineTo(dx, dy + 18);
    b.quadraticCurveTo(dx + dw / 2, dy - 10, dx + dw, dy + 18);
    b.lineTo(dx + dw, s);
    b.closePath();
    b.fill();
    // stairs inside
    for (let i = 0; i < 6; i++) {
      b.fillStyle = `rgba(255,210,140,${0.08 + i * 0.05})`;
      b.fillRect(dx + 4 + i * 6, s - 8 - i * 12, dw - 8 - i * 6, 3);
    }
    b.strokeStyle = "#c9a24a";
    b.lineWidth = 3;
    b.beginPath();
    b.moveTo(dx - 2, s);
    b.lineTo(dx - 2, dy + 18);
    b.quadraticCurveTo(dx + dw / 2, dy - 13, dx + dw + 2, dy + 18);
    b.lineTo(dx + dw + 2, s);
    b.stroke();
  }

  paintPillar(f, x, y, s, T) {
    const px = x + 20, pw = 24, top = y, bot = s;
    const g = f.createLinearGradient(px, 0, px + pw, 0);
    g.addColorStop(0, rgb(T.wall, 0.6));
    g.addColorStop(0.35, rgb(T.wall, 1.25));
    g.addColorStop(1, rgb(T.wall, 0.5));
    f.fillStyle = g;
    f.fillRect(px, top + 10, pw, bot - top - 16);
    f.fillStyle = rgb(T.wall, 1.1);
    f.fillRect(px - 5, top, pw + 10, 10);
    f.fillRect(px - 5, bot - 8, pw + 10, 8);
    f.fillStyle = "rgba(0,0,0,0.25)";
    f.fillRect(px - 5, top + 8, pw + 10, 2);
    f.fillRect(px - 5, bot - 2, pw + 10, 2);
  }

  // ---------- dynamic world ----------
  drawDynamic(ctx, world, rx, ry, t) {
    const T = THEMES[world.level.theme];
    const c0 = rx * ROOM_W, r0 = ry * ROOM_H;
    for (let r = r0 - 1; r <= r0 + ROOM_H; r++) {
      for (let c = c0 - 1; c <= c0 + ROOM_W; c++) {
        const cell = world.cell(c, r);
        const x = c * TW, s = surfaceY(r), y = r * TH;
        if (cell.t === "loose") {
          this.paintSlab(ctx, x, s, T, c, r, cell.shake >= 0 ? 2.5 : 0);
          ctx.strokeStyle = "rgba(0,0,0,0.45)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 18, s - 4);
          ctx.lineTo(x + 26, s + 4);
          ctx.lineTo(x + 22, s + FT);
          ctx.moveTo(x + 44, s - 4);
          ctx.lineTo(x + 38, s + 6);
          ctx.stroke();
        }
        if (cell.t === "plate") {
          const d = cell.down * 3;
          ctx.fillStyle = cell.letter === "x" ? "#c9a24a" : T.floorTop;
          ctx.fillRect(x + 10, s - 8 + d, TW - 20, 4);
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.fillRect(x + 10, s - 4 + d, TW - 20, 1.5);
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.fillRect(x + 10, s - 8 + d, TW - 20, 1);
        }
        if (cell.t === "gate") this.drawGate(ctx, x, y, world.gateBottom(c, r), T);
        if (cell.t === "spikes") this.drawSpikes(ctx, x, s, cell.ext);
        if (cell.t === "chomper") this.drawChomper(ctx, x, s, cell.jaw);
        if (cell.t === "exit") this.drawExitDoor(ctx, x, s, cell.open, T);
        if (cell.torch) this.drawFlame(ctx, x + 32, s - 66, t + c * 1.7, T);
        if (cell.item) this.drawItem(ctx, cell.item, x + TW / 2, s, t + c);
        if (world.rubble.has(`${c},${r}`)) this.drawRubble(ctx, x, s, c, r, T);
      }
    }
    for (const d of world.debris) {
      ctx.save();
      ctx.translate(d.x + TW / 2, d.y + FT / 2);
      ctx.rotate(Math.min(0.3, d.vy / 3000));
      this.paintSlab(ctx, -TW / 2, -FT / 2, T, d.c, d.r);
      ctx.restore();
    }
  }

  drawGate(ctx, x, y, bottom, T) {
    const gx = x + TW / 2 - 7, gw = 14;
    const top = y;
    // stone door frame so an open gate still reads as a doorway
    const s = y + TH - FT;
    ctx.fillStyle = rgb(T.wall, 0.8);
    ctx.fillRect(gx - 9, top - FT, 5, s - top + FT);
    ctx.fillRect(gx + gw + 4, top - FT, 5, s - top + FT);
    ctx.fillRect(gx - 11, top - FT, gw + 22, 9);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(gx - 9, top - FT, 1.5, s - top + FT);
    ctx.fillRect(gx + gw + 4, top - FT, 1.5, s - top + FT);
    ctx.fillStyle = "#1a1a1e";
    ctx.fillRect(gx - 3, top - 3, gw + 6, 5);
    if (bottom <= top + 2) return;
    ctx.strokeStyle = "#2c2c34";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= 2; i++) {
      ctx.moveTo(gx + i * 7, top);
      ctx.lineTo(gx + i * 7, bottom);
    }
    for (let yy = bottom - 6; yy > top; yy -= 14) {
      ctx.moveTo(gx - 1, yy);
      ctx.lineTo(gx + gw + 1, yy);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(160,160,180,0.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i <= 2; i++) {
      ctx.moveTo(gx + i * 7 - 0.6, top);
      ctx.lineTo(gx + i * 7 - 0.6, bottom);
    }
    ctx.stroke();
    ctx.fillStyle = "#2c2c34";
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(gx + i * 7 - 2, bottom - 2);
      ctx.lineTo(gx + i * 7, bottom + 3);
      ctx.lineTo(gx + i * 7 + 2, bottom - 2);
      ctx.fill();
    }
  }

  drawSpikes(ctx, x, s, ext) {
    // retracted stubs are always visible as a warning
    const h = 3 + ext * 20;
    for (let i = 0; i < 5; i++) {
      const sx = x + 10 + i * 11;
      const g = ctx.createLinearGradient(sx, s - h, sx, s);
      g.addColorStop(0, "#eef");
      g.addColorStop(1, "#556");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx - 3, s - 2);
      ctx.lineTo(sx, s - 2 - h);
      ctx.lineTo(sx + 3, s - 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawChomper(ctx, x, s, jaw) {
    const bx = x + 40;
    const mid = s - 36;
    const upBot = s - 96 + (mid - (s - 96)) * jaw;
    const loTop = s - 6 + (mid - (s - 6)) * jaw;
    ctx.fillStyle = "#3a3640";
    ctx.fillRect(bx - 5, s - 112, 10, 8);
    ctx.fillRect(bx - 5, s - 6, 10, 6);
    const blade = (y0, y1, dir) => {
      const g = ctx.createLinearGradient(bx - 6, 0, bx + 6, 0);
      g.addColorStop(0, "#8a8f9c");
      g.addColorStop(0.5, "#f4f6ff");
      g.addColorStop(1, "#6a6e7a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx - 4, y0);
      ctx.lineTo(bx + 4, y0);
      ctx.lineTo(bx + 4, y1 - dir * 6);
      ctx.lineTo(bx, y1);
      ctx.lineTo(bx - 4, y1 - dir * 6);
      ctx.closePath();
      ctx.fill();
    };
    blade(s - 104, upBot, 1);
    blade(s - 6, loTop, -1);
    if (jaw > 0.95) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(bx - 8, mid - 1, 16, 2);
    }
  }

  drawExitDoor(ctx, x, s, open, T) {
    const dx = x + 8, dw = 48, dh = 86;
    const panelBottom = s - open * (dh - 6);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dx, s);
    ctx.lineTo(dx, s - dh + 18);
    ctx.quadraticCurveTo(dx + dw / 2, s - dh - 10, dx + dw, s - dh + 18);
    ctx.lineTo(dx + dw, s);
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(dx, 0, dx + dw, 0);
    g.addColorStop(0, "#3a2414");
    g.addColorStop(0.5, "#6a4426");
    g.addColorStop(1, "#3a2414");
    ctx.fillStyle = g;
    ctx.fillRect(dx, s - dh - 12, dw, panelBottom - (s - dh - 12));
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.5;
    for (let yy = panelBottom - 10; yy > s - dh - 10; yy -= 16) {
      ctx.beginPath();
      ctx.moveTo(dx, yy);
      ctx.lineTo(dx + dw, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFlame(ctx, x, y, t, T) {
    const f = Math.sin(t * 13) * 0.5 + Math.sin(t * 7.3) * 0.5;
    const h = 14 + f * 3;
    ctx.globalCompositeOperation = "lighter";
    const cols = T.flame;
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.28;
      ctx.fillStyle = cols[2 - i];
      ctx.globalAlpha = 0.55 + i * 0.15;
      ctx.beginPath();
      ctx.moveTo(x - 5 * k, y);
      ctx.quadraticCurveTo(x - 6 * k, y - h * 0.5 * k, x + f * 2, y - h * k);
      ctx.quadraticCurveTo(x + 6 * k, y - h * 0.5 * k, x + 5 * k, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (Math.random() < 0.05) particles.ember(x, y - h);
  }

  drawItem(ctx, item, x, s, t) {
    if (item === "sword") {
      ctx.save();
      ctx.translate(x, s - 3);
      ctx.rotate(-0.05);
      ctx.fillStyle = "#e8eef6";
      ctx.beginPath();
      ctx.moveTo(-10, -1);
      ctx.quadraticCurveTo(6, -6, 18, -4);
      ctx.quadraticCurveTo(6, -2, -10, 1);
      ctx.fill();
      ctx.fillStyle = "#d9a83a";
      ctx.fillRect(-12, -4, 2, 7);
      ctx.fillStyle = "#5a3420";
      ctx.fillRect(-19, -1.5, 7, 3);
      ctx.restore();
      const gl = (Math.sin(t * 3) + 1) / 2;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,255,220,${gl * 0.8})`;
      ctx.fillRect(x + 4 + gl * 8, s - 7, 2, 2);
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    if (item === "shard") {
      const bob = Math.sin(t * 2) * 3;
      ctx.save();
      ctx.translate(x, s - 26 + bob);
      ctx.rotate(Math.sin(t) * 0.2);
      ctx.shadowColor = "#5ef";
      ctx.shadowBlur = 14;
      const g = ctx.createLinearGradient(-6, -10, 6, 10);
      g.addColorStop(0, "#e8ffff");
      g.addColorStop(0.5, "#40a8d8");
      g.addColorStop(1, "#b0f0ff");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(6, -2);
      ctx.lineTo(3, 11);
      ctx.lineTo(-5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (Math.random() < 0.2) particles.shade(x, s - 10, 1);
      return;
    }
    const col = { red: "#e0283a", life: "#30d060", poison: "#3060f0" }[item];
    const big = item === "life";
    const h = big ? 16 : 12;
    ctx.fillStyle = "rgba(200,230,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, s - h / 2 - 2, big ? 6 : 5, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, s - h / 2, big ? 5 : 4, h / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(220,240,255,0.6)";
    ctx.fillRect(x - 1.5, s - h - 6, 3, 6);
    ctx.fillStyle = "#6a4426";
    ctx.fillRect(x - 2, s - h - 8, 4, 3);
    if (Math.random() < 0.08) particles.bubble(x, s - h, col.replace("#", "").length ? hexA(col) : col);
  }

  drawRubble(ctx, x, s, c, r, T) {
    ctx.fillStyle = T.floorFront;
    for (let i = 0; i < 7; i++) {
      const h = hash(c, r, i + 20);
      ctx.fillRect(x + 6 + h * 50, s - 4 - (i % 3) * 2, 5 + (i % 2) * 4, 4);
    }
  }

  // ---------- characters ----------
  drawActor(ctx, a, styleKey, opts = {}) {
    const pose = samplePose(a.anim, a.animT);
    const st = STYLES[styleKey];
    let o = { sword: opts.sword, alpha: a.alpha ?? 1 };
    if (opts.silhouette) Object.assign(o, { silhouette: true, glow: opts.glow, eye: opts.eye });
    if (a.flash > 0 && Math.floor(a.flash * 30) % 2 === 0) o.alpha = (o.alpha ?? 1) * 0.5;
    drawFigure(ctx, a.x, a.y, a.facing, pose, st, o);
  }

  drawShadow(ctx, f, alpha) {
    const pose = samplePose(f.anim, f.animT);
    drawFigure(ctx, f.x, f.y, f.facing, pose, STYLES.prince, { silhouette: true, alpha, sword: f.sword });
  }

  // ---------- lighting ----------
  drawLighting(ctx, game, rx, ry, t) {
    const world = game.world;
    const T = THEMES[world.level.theme];
    const l = this.lctx;
    const ox = rx * VIEW_W, oy = ry * VIEW_H;
    l.setTransform(0.5, 0, 0, 0.5, 0, 0);
    l.globalCompositeOperation = "source-over";
    l.fillStyle = T.ambient;
    l.fillRect(0, 0, VIEW_W, VIEW_H);
    l.globalCompositeOperation = "lighter";
    const glow = (x, y, rad, [r, g, b], a) => {
      const gr = l.createRadialGradient(x - ox, y - oy, 0, x - ox, y - oy, rad);
      gr.addColorStop(0, `rgba(${r},${g},${b},${a})`);
      gr.addColorStop(0.4, `rgba(${r},${g},${b},${a * 0.45})`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      l.fillStyle = gr;
      l.fillRect(x - ox - rad, y - oy - rad, rad * 2, rad * 2);
    };
    const c0 = rx * ROOM_W - 2, r0 = ry * ROOM_H - 1;
    for (let r = r0; r <= r0 + ROOM_H + 1; r++) {
      for (let c = c0; c <= c0 + ROOM_W + 3; c++) {
        const cell = world.cell(c, r);
        const s = surfaceY(r);
        if (cell.torch) {
          const fl = 0.85 + Math.sin(t * 9 + c) * 0.08 + Math.sin(t * 23 + c * 3) * 0.05;
          glow(c * TW + 32, s - 74, 230 * fl, T.torch, 0.95);
        }
        if (cell.window) glow(c * TW + 32, s - 60, 110, [110, 140, 220], 0.5);
        if (cell.item === "shard") glow(c * TW + 32, s - 26, 90, [80, 220, 255], 0.9);
        else if (cell.item && cell.item !== "sword") {
          const col = { red: [255, 60, 60], life: [60, 255, 100], poison: [60, 100, 255] }[cell.item];
          glow(c * TW + 32, s - 8, 40, col, 0.6);
        }
        if (cell.t === "exit" && cell.open > 0) glow(c * TW + 32, s - 40, 110 * cell.open, [255, 210, 150], 0.6);
      }
    }
    const p = game.player;
    glow(p.x, p.y - 40, 120, [255, 230, 200], 0.28);
    const f = game.echo.frame;
    if (f && (game.echo.mode === "play" || game.echo.mode === "linger")) glow(f.x, f.y - 32, 80, [80, 220, 255], 0.55);
    for (const g of game.guards) if (g.cfg.wraith && g.alive) glow(g.x, g.y - 32, 70, [190, 100, 255], 0.5);
    if (game.echo.mode === "rec") glow(p.x, p.y - 32, 90, [80, 220, 255], 0.35 + Math.sin(t * 10) * 0.1);
    if (game.echo.rewindFrame) glow(p.x, p.y - 32, 140, [255, 200, 100], 0.6);

    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(this.light, 0, 0, VIEW_W, VIEW_H);
    // a touch of overbright so lit stone glows warm instead of just "less dark"
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.14;
    ctx.drawImage(this.light, 0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // ---------- frame ----------
  drawGame(game, t, debugGrid) {
    const ctx = this.ctx;
    const world = game.world;
    const { rx, ry } = game.camera();
    const L = this.roomLayers(world, rx, ry);
    const sh = game.shakeAmt;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();
    if (sh > 0) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    ctx.drawImage(L.bg, 0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(-rx * VIEW_W, -ry * VIEW_H);
    this.drawDynamic(ctx, world, rx, ry, t);

    // princess, guards, shadow, prince
    if (game.princess) {
      const pz = game.princess;
      this.drawActor(ctx, pz, "princess");
    }
    for (const g of game.guards) {
      if (!g.cfg.wraith) this.drawActor(ctx, g, g.cfg.style, { sword: true });
    }
    const e = game.echo;
    const p = game.player;
    if (e.rewindFrame) {
      const f = e.rewindFrame;
      const pose = samplePose(f.anim, f.animT);
      drawFigure(ctx, f.x, f.y, f.facing, pose, STYLES.prince, { sword: f.sword, alpha: 0.85 });
      // ghostly afterimages of the path being unwound
      for (let k = 1; k <= 3; k++) {
        const g = e.frames[Math.min(e.frames.length - 1, Math.floor(e.idx + k * e.rate * 4))];
        if (g) drawFigure(ctx, g.x, g.y, g.facing, samplePose(g.anim, g.animT), STYLES.prince, { silhouette: true, glow: "rgba(255,200,100,0.9)", eye: "#fd8", alpha: 0.35 / k });
      }
    } else {
      this.drawActor(ctx, p, "prince", { sword: p.swordOut });
    }
    ctx.restore();

    ctx.drawImage(L.fg, 0, 0, VIEW_W, VIEW_H);

    this.drawLighting(ctx, game, rx, ry, t);

    // shadow-world beings carry their own light: drawn after the lighting pass
    ctx.save();
    ctx.translate(-rx * VIEW_W, -ry * VIEW_H);
    for (const g of game.guards) {
      if (g.cfg.wraith) this.drawActor(ctx, g, g.cfg.style, { sword: true, silhouette: true, glow: "rgba(190,100,255,0.95)", eye: "#f8f" });
    }
    if ((e.mode === "play" || e.mode === "linger") && e.frame) {
      const a = e.mode === "linger" ? 0.45 + 0.4 * Math.min(1, e.t / ECHO_LINGER) + Math.sin(t * 12) * 0.12 * (e.t < 1.5 ? 1 : 0) : 0.85;
      this.drawShadow(ctx, e.frame, a);
    }
    particles.draw(ctx);
    ctx.restore();

    // additive bloom for flames
    ctx.save();
    ctx.translate(-rx * VIEW_W, -ry * VIEW_H);
    ctx.globalCompositeOperation = "lighter";
    for (let r = ry * ROOM_H; r < (ry + 1) * ROOM_H; r++) {
      for (let c = rx * ROOM_W; c < (rx + 1) * ROOM_W; c++) {
        if (!world.cell(c, r).torch) continue;
        const x = c * TW + 32, y = surfaceY(r) - 74;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
        const [R, G, B] = THEMES[world.level.theme].torch;
        g.addColorStop(0, `rgba(${R},${G},${B},0.45)`);
        g.addColorStop(1, `rgba(${R},${G},${B},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - 26, y - 26, 52, 52);
      }
    }
    ctx.restore();

    // vignette + flashes
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (game.echo.mode === "rec") {
      ctx.fillStyle = `rgba(60,200,255,${0.06 + Math.sin(t * 6) * 0.03})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (game.echo.rewindFrame) {
      ctx.fillStyle = "rgba(255,190,90,0.12)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (game.redFlash > 0) {
      ctx.fillStyle = `rgba(200,0,0,${game.redFlash * 0.6})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (game.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${game.whiteFlash})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (debugGrid) this.drawDebug(ctx, game, rx, ry);
    ctx.restore();
  }

  drawDebug(ctx, game, rx, ry) {
    ctx.save();
    ctx.translate(-rx * VIEW_W, -ry * VIEW_H);
    ctx.strokeStyle = "rgba(0,255,0,0.3)";
    ctx.lineWidth = 0.5;
    for (let c = rx * ROOM_W; c <= (rx + 1) * ROOM_W; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TW, ry * VIEW_H);
      ctx.lineTo(c * TW, (ry + 1) * VIEW_H);
      ctx.stroke();
    }
    const p = game.player;
    ctx.strokeStyle = "#f0f";
    ctx.strokeRect(p.x - p.hw, p.y - p.h, p.hw * 2, p.h);
    ctx.fillStyle = "#fff";
    ctx.font = "8px monospace";
    ctx.fillText(`${p.state} ${p.x.toFixed(0)},${p.y.toFixed(0)} vx${p.vx.toFixed(0)} vy${p.vy.toFixed(0)}`, rx * VIEW_W + 4, ry * VIEW_H + 10);
    ctx.restore();
  }

  drawHUD(game, t, timeLeft) {
    const ctx = this.ctx;
    const y0 = VIEW_H;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, y0, SCREEN_W, HUD_H);
    ctx.fillStyle = "#3a2a14";
    ctx.fillRect(0, y0, SCREEN_W, 1);
    const p = game.player;
    const tri = (x, filled, col) => {
      ctx.beginPath();
      ctx.moveTo(x, y0 + 19);
      ctx.lineTo(x + 5, y0 + 7);
      ctx.lineTo(x + 10, y0 + 19);
      ctx.closePath();
      if (filled) {
        ctx.fillStyle = col;
        ctx.fill();
      } else {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };
    const low = p.hp === 1 && Math.floor(t * 4) % 2 === 0;
    for (let i = 0; i < p.maxHp; i++) tri(8 + i * 13, i < p.hp && !low, "#e0283a");

    let ix = 14 + p.maxHp * 13;
    if (p.hasShard) {
      const e = game.echo;
      const cx = ix + 10, cy = y0 + 13;
      ctx.strokeStyle = "rgba(90,230,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.stroke();
      let frac = 0, col = "#5ef";
      if (e.mode === "rec") frac = e.frames.length / (ECHO_MAX / DT);
      else if (e.mode === "play") frac = 1 - e.idx / e.frames.length;
      else if (e.mode === "linger") {
        frac = e.t / ECHO_LINGER;
        col = "#9cf";
      }
      if (frac > 0) {
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = e.mode === "rec" ? (Math.floor(t * 4) % 2 ? "#f44" : "#a22") : "#5ef";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx + 3.5, cy);
      ctx.lineTo(cx, cy + 5);
      ctx.lineTo(cx - 3.5, cy);
      ctx.closePath();
      ctx.fill();
      ix += 26;
    }

    // enemy health
    const tgt = game.guards.find((g) => g.alive && Math.abs(g.y - p.y) < 20 && Math.abs(g.x - p.x) < 200);
    if (tgt) {
      const col = tgt.cfg.boss ? "#b040ff" : tgt.cfg.wraith ? "#c080ff" : "#3a8aff";
      for (let i = 0; i < tgt.maxHp; i++) tri(SCREEN_W - 18 - i * 13, i < tgt.hp, col);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let text, color = "#e8d8b0";
    if (game.hintT > 0 && game.hint) {
      text = game.hint;
      ctx.globalAlpha = Math.min(1, game.hintT * 2);
    } else {
      const m = Math.ceil(timeLeft / 60);
      text = m <= 1 ? `${Math.ceil(timeLeft)} SECONDS LEFT` : `${m} MINUTES LEFT`;
      color = m <= 5 ? "#ff7050" : "#8a7a5a";
    }
    ctx.fillStyle = color;
    ctx.font = "600 10px 'Cinzel', Georgia, serif";
    const maxW = SCREEN_W - ix - 30 - (tgt ? tgt.maxHp * 13 : 0);
    ctx.fillText(text, ix + (SCREEN_W - ix - (tgt ? tgt.maxHp * 13 + 10 : 0)) / 2, y0 + 13.5, maxW);
    ctx.globalAlpha = 1;
  }
}

function hexA(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},A)`;
}
