import {
  drawActor,
  GUARD_PALETTE,
  poseFor,
  PRINCE_PALETTE,
  type ActorAnimName,
} from "./actor";
import { COLORS, ROOM_COLS, ROOM_ROWS, TILE_H, TILE_W, VIEW_H, VIEW_W } from "./constants";
import type { Guard, Pickup, Room, World } from "./level";
import { getLevels } from "./levels";
import type { Player } from "./player";
import { formatSeed } from "./rng";
import { drawGuardSprite, drawPrinceSprite } from "./sprites";
import type { GamePhase } from "./types";

export type LevelHud = {
  levelIndex: number;
  levelCount: number;
  levelName: string;
  levelSubtitle: string;
  selectedLevel: number;
  seed: number;
  roomCount: number;
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private sand: { x: number; y: number; v: number; a: number }[] = [];
  private shake = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    for (let i = 0; i < 60; i++) {
      this.sand.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        v: 0.3 + Math.random() * 0.9,
        a: 0.15 + Math.random() * 0.35,
      });
    }
  }

  bump(n = 3) {
    this.shake = Math.max(this.shake, n);
  }

  draw(
    world: World,
    player: Player,
    phase: GamePhase,
    timeLeft: number,
    banner: string,
    titlePulse: number,
    level: LevelHud,
  ) {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= 0.85;
      if (this.shake < 0.3) this.shake = 0;
    }

    const room = world.room;
    this.drawBackdrop(room);
    this.drawRoom(room);
    this.drawSwitches(room);
    for (const p of room.pickups) if (!p.taken) this.drawPickup(p);
    for (const g of room.guards) this.drawGuard(g);
    if (!player.dead || player.animT < 2) this.drawPlayer(player);
    this.drawSand(room.mood);
    this.drawVignette();
    if (phase === "playing" || phase === "paused") {
      this.drawHud(player, timeLeft, world.currentId, level);
    }
    if (banner && phase === "playing") this.drawBanner(banner);

    if (phase === "title") this.drawTitle(titlePulse, level);
    if (phase === "levelintro") this.drawLevelIntro(level);
    if (phase === "levelclear") {
      const next = level.levelIndex + 1 < level.levelCount;
      this.drawCenterMsg(
        `Level ${level.levelIndex + 1} clear`,
        next ? "Enter — next level" : "Enter — claim victory",
      );
    }
    if (phase === "paused") this.drawCenterMsg("Paused", "Press P to continue");
    if (phase === "dead") this.drawCenterMsg("The sand takes you", "Enter — rise again");
    if (phase === "win") this.drawCenterMsg("The hourglass stills", "You reached the princess");
    if (phase === "timeup") this.drawCenterMsg("Time has run out", "Enter — try once more");

    ctx.restore();
  }

  private drawBackdrop(room: Room) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    if (room.mood === "tower") {
      g.addColorStop(0, "#1a2a44");
      g.addColorStop(0.45, "#152238");
      g.addColorStop(1, "#0a0e16");
    } else if (room.mood === "palace") {
      g.addColorStop(0, "#243652");
      g.addColorStop(1, "#101820");
    } else if (room.mood === "mirror") {
      g.addColorStop(0, "#2a3048");
      g.addColorStop(0.5, "#1a2438");
      g.addColorStop(1, "#0c1018");
    } else {
      g.addColorStop(0, "#152030");
      g.addColorStop(1, "#080c14");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Warm ground wash
    const wash = ctx.createLinearGradient(0, VIEW_H * 0.55, 0, VIEW_H);
    wash.addColorStop(0, "rgba(80,50,20,0)");
    wash.addColorStop(1, "rgba(60,35,12,0.35)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (room.mood !== "dungeon") {
      const moon = ctx.createRadialGradient(530, 64, 4, 530, 64, 50);
      moon.addColorStop(0, "rgba(230,236,248,0.85)");
      moon.addColorStop(0.35, "rgba(200,214,236,0.35)");
      moon.addColorStop(1, "rgba(200,214,236,0)");
      ctx.fillStyle = moon;
      ctx.fillRect(470, 10, 120, 120);
    }

    // Distant arches with depth
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 128;
      const depth = 0.35 + (i % 3) * 0.08;
      ctx.fillStyle = `rgba(14,22,36,${depth})`;
      ctx.beginPath();
      ctx.moveTo(x, VIEW_H);
      ctx.lineTo(x, 70);
      ctx.arc(x + 38, 70, 38, Math.PI, 0);
      ctx.lineTo(x + 76, VIEW_H);
      ctx.fill();
      ctx.strokeStyle = "rgba(196,165,116,0.06)";
      ctx.stroke();
    }
  }

  private drawVignette() {
    const ctx = this.ctx;
    const v = ctx.createRadialGradient(
      VIEW_W / 2,
      VIEW_H * 0.45,
      VIEW_H * 0.25,
      VIEW_W / 2,
      VIEW_H * 0.5,
      VIEW_W * 0.72,
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private drawRoom(room: Room) {
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        const t = room.tiles[r][c];
        const x = c * TILE_W;
        const y = r * TILE_H;
        switch (t.kind) {
          case "wall":
            this.brick(x, y, TILE_W, TILE_H, true);
            break;
          case "pillar":
            this.pillar(x + 18, y, 28, TILE_H);
            break;
          case "floor":
          case "exit":
          case "torch":
          case "loose":
            this.floorTile(x, y, t.kind === "loose", t.kind === "exit");
            if (t.kind === "torch") this.torch(x + TILE_W / 2, y + 40);
            if (t.kind === "exit") this.exitDoor(x, y);
            break;
          case "spikes":
            this.floorTile(x, y, false, false);
            this.spikes(x, y + 18);
            break;
          case "gate":
            this.floorTile(x, y, false, false);
            this.gate(x, y, t.state);
            break;
        }
      }
    }
  }

  private brick(x: number, y: number, w: number, h: number, filled: boolean) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.stoneDark;
    if (filled) ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.stone;
    const bh = 16;
    const bw = 32;
    for (let row = 0; row < h / bh; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < w / bw + 1; col++) {
        const bx = x + col * bw + off;
        const by = y + row * bh;
        ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
        ctx.fillStyle = "rgba(196,165,116,0.08)";
        ctx.fillRect(bx + 1, by + 1, bw - 2, 2);
        ctx.fillStyle = COLORS.stone;
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  private floorTile(x: number, y: number, loose: boolean, exit: boolean) {
    const ctx = this.ctx;
    const top = y + 18;
    const thickness = 28;
    const grad = ctx.createLinearGradient(x, top, x, top + thickness);
    grad.addColorStop(0, exit ? "#3db8a8" : loose ? "#b89868" : "#e2c99a");
    grad.addColorStop(0.45, exit ? COLORS.turquoise : loose ? "#a89060" : COLORS.sand);
    grad.addColorStop(1, exit ? COLORS.turquoiseDark : COLORS.sandDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(x, top, TILE_W, thickness);
    // Carved diamond inlay
    ctx.strokeStyle = "rgba(58,46,30,0.28)";
    ctx.strokeRect(x + 4, top + 4, TILE_W - 8, thickness - 8);
    ctx.beginPath();
    ctx.moveTo(x + TILE_W / 2, top + 6);
    ctx.lineTo(x + TILE_W - 10, top + thickness / 2);
    ctx.lineTo(x + TILE_W / 2, top + thickness - 6);
    ctx.lineTo(x + 10, top + thickness / 2);
    ctx.closePath();
    ctx.strokeStyle = loose ? "rgba(194,59,34,0.4)" : "rgba(42,157,143,0.35)";
    ctx.stroke();
    // Lip highlight
    ctx.fillStyle = "rgba(255,240,200,0.18)";
    ctx.fillRect(x, top, TILE_W, 2);
    ctx.fillStyle = "rgba(6,10,18,0.5)";
    ctx.fillRect(x + 1, top + thickness, TILE_W - 2, 12);
  }

  private pillar(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, COLORS.stoneDark);
    g.addColorStop(0.4, COLORS.sand);
    g.addColorStop(1, COLORS.stoneDark);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.turquoiseDark;
    ctx.fillRect(x - 4, y + 10, w + 8, 12);
    ctx.fillRect(x - 4, y + h - 28, w + 8, 12);
  }

  private spikes(x: number, y: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#9aa3b0";
    for (let i = 0; i < 5; i++) {
      const sx = x + 6 + i * 12;
      ctx.beginPath();
      ctx.moveTo(sx, y + 16);
      ctx.lineTo(sx + 5, y);
      ctx.lineTo(sx + 10, y + 16);
      ctx.fill();
    }
  }

  private gate(x: number, y: number, open: number) {
    const ctx = this.ctx;
    const top = y + 18;
    const gap = open * 70;
    ctx.fillStyle = "#2a2218";
    ctx.fillRect(x + 8, top - 90 + gap, 48, 90 - gap);
    ctx.fillStyle = COLORS.saffron;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 14, top - 80 + gap + i * 18, 36, 3);
    }
  }

  private torch(x: number, y: number) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.stoneDark;
    ctx.fillRect(x - 3, y, 6, 28);
    const flicker = 0.7 + Math.random() * 0.3;
    const rg = ctx.createRadialGradient(x, y - 4, 2, x, y - 4, 28 * flicker);
    rg.addColorStop(0, "rgba(255,200,80,0.9)");
    rg.addColorStop(0.4, "rgba(255,120,40,0.35)");
    rg.addColorStop(1, "rgba(255,80,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y - 4, 28 * flicker, 0, Math.PI * 2);
    ctx.fill();
  }

  private exitDoor(x: number, y: number) {
    const ctx = this.ctx;
    const dx = x + 12;
    const dy = y - 70;
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(dx, dy, 40, 88);
    ctx.strokeStyle = COLORS.saffron;
    ctx.lineWidth = 2;
    ctx.strokeRect(dx + 2, dy + 2, 36, 84);
    ctx.beginPath();
    ctx.arc(dx + 20, dy, 20, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = COLORS.saffron;
    ctx.fillRect(dx + 30, dy + 44, 4, 4);
    ctx.font = "italic 11px 'Cormorant Garamond', serif";
    ctx.fillStyle = COLORS.parchment;
    ctx.fillText("EXIT", dx + 6, dy - 8);
  }

  private drawSwitches(room: Room) {
    const ctx = this.ctx;
    for (const s of room.switches) {
      ctx.fillStyle = s.pressed ? COLORS.turquoise : COLORS.sandDeep;
      ctx.fillRect(s.x - 14, s.y - 2, 28, 6);
      ctx.fillStyle = "rgba(233,163,25,0.7)";
      ctx.fillRect(s.x - 10, s.y - 4, 20, 3);
    }
  }

  private drawPickup(p: Pickup) {
    const ctx = this.ctx;
    p.bob += 0.05;
    const y = p.y - 28 + Math.sin(p.bob) * 3;
    if (p.type === "sword") {
      ctx.save();
      ctx.translate(p.x, y);
      ctx.rotate(-0.4);
      ctx.fillStyle = "#c0c8d4";
      ctx.fillRect(-2, -20, 4, 36);
      ctx.fillStyle = COLORS.saffron;
      ctx.fillRect(-8, 8, 16, 4);
      ctx.restore();
    } else {
      const col = p.type === "life" ? COLORS.turquoise : COLORS.blood;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(p.x, y, 7, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(p.x - 2, y - 3, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPlayer(p: Player) {
    const ctx = this.ctx;
    const flash = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
    if (flash) return;

    if (drawPrinceSprite(ctx, p)) return;

    // Fallback procedural actor while images load
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.facing * 1.15, 1.15);
    const pose = poseFor(p.anim as ActorAnimName, p.animT, {
      runPhase: p.runPhase,
      strikeT: p.strikeT,
      hasSword: p.hasSword,
      vy: p.vy,
    });
    drawActor(ctx, pose, PRINCE_PALETTE);
    ctx.restore();
  }

  private drawGuard(g: Guard) {
    const ctx = this.ctx;
    if (g.dead && g.animT > 2.5) return;

    if (!drawGuardSprite(ctx, g)) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.scale(g.facing * 1.12, 1.12);
      const anim: ActorAnimName =
        g.anim === "advance" || g.anim === "retreat"
          ? "walk"
          : g.anim === "strike"
            ? "strike"
            : g.anim === "hurt"
              ? "hurt"
              : g.anim === "die"
                ? "die"
                : "fight";
      const pose = poseFor(anim, g.animT, {
        runPhase: (g.animT * 0.6) % 1,
        strikeT: g.strikeT,
        hasSword: true,
      });
      drawActor(ctx, pose, GUARD_PALETTE, { helmet: true });
      ctx.restore();
    }

    if (!g.dead) {
      ctx.save();
      ctx.translate(g.x, g.y);
      for (let i = 0; i < g.maxHp; i++) {
        ctx.fillStyle = i < g.hp ? COLORS.blood : "#333";
        ctx.fillRect(-10 + i * 8, -84, 6, 4);
      }
      ctx.restore();
    }
  }

  private drawSand(mood: Room["mood"]) {
    const ctx = this.ctx;
    for (const s of this.sand) {
      s.y += s.v;
      if (s.y > VIEW_H) {
        s.y = -4;
        s.x = Math.random() * VIEW_W;
      }
      ctx.fillStyle =
        mood === "tower"
          ? `rgba(233,163,25,${s.a})`
          : `rgba(196,165,116,${s.a})`;
      ctx.fillRect(s.x, s.y, 1.5, 2.5);
    }
  }

  private drawHud(player: Player, timeLeft: number, roomId: string, level: LevelHud) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(6,10,18,0.55)";
    ctx.fillRect(0, 0, VIEW_W, 28);

    for (let i = 0; i < player.maxHp; i++) {
      const x = 16 + i * 18;
      const y = 14;
      ctx.fillStyle = i < player.hp ? COLORS.blood : "#2a2030";
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = COLORS.saffron;
    ctx.font = "500 10px 'IBM Plex Mono', monospace";
    const bladeX = 16 + player.maxHp * 18 + 8;
    ctx.fillText(`LV ${level.levelIndex + 1}/${level.levelCount}`, bladeX, 18);
    ctx.fillStyle = "#7a8aa0";
    ctx.fillText(`${level.roomCount}rm`, bladeX + 58, 18);
    if (player.hasSword) {
      ctx.fillStyle = COLORS.saffron;
      ctx.fillText("BLADE", bladeX + 96, 18);
    }

    const m = Math.floor(timeLeft / 60);
    const s = Math.floor(timeLeft % 60);
    const urgent = timeLeft < 60;
    ctx.fillStyle = urgent ? COLORS.blood : COLORS.parchment;
    ctx.font = "500 13px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${m}:${s.toString().padStart(2, "0")}`, VIEW_W / 2, 18);
    this.hourglass(VIEW_W / 2 + 48, 14, Math.min(1, timeLeft / (20 * 60)));

    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.sand;
    ctx.font = "italic 12px 'Cormorant Garamond', serif";
    ctx.fillText(roomId, VIEW_W - 14, 18);
    ctx.textAlign = "left";
  }

  private hourglass(x: number, y: number, full: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = COLORS.saffron;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 8);
    ctx.lineTo(x + 5, y - 8);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 5, y + 8);
    ctx.lineTo(x - 5, y + 8);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "rgba(233,163,25,0.55)";
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 7);
    ctx.lineTo(x + 4, y + 7);
    ctx.lineTo(x, y + 7 - 10 * full);
    ctx.fill();
  }

  private drawBanner(text: string) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(6,10,18,0.7)";
    ctx.fillRect(VIEW_W / 2 - 160, VIEW_H - 40, 320, 26);
    ctx.fillStyle = COLORS.parchment;
    ctx.font = "italic 14px 'Cormorant Garamond', serif";
    ctx.textAlign = "center";
    ctx.fillText(text, VIEW_W / 2, VIEW_H - 22);
    ctx.textAlign = "left";
  }

  private drawTitle(pulse: number, level: LevelHud) {
    const ctx = this.ctx;
    const levels = getLevels();
    ctx.fillStyle = "rgba(6,10,18,0.78)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.strokeStyle = COLORS.saffron;
    ctx.globalAlpha = 0.6 + pulse * 0.2;
    ctx.beginPath();
    ctx.moveTo(180, 88);
    ctx.lineTo(460, 88);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.saffron;
    ctx.font = "700 40px 'Cormorant Garamond', serif";
    ctx.textAlign = "center";
    ctx.fillText("SANDGLASS", VIEW_W / 2, 80);

    ctx.fillStyle = COLORS.parchment;
    ctx.font = "italic 14px 'Cormorant Garamond', serif";
    ctx.fillText("Procedural palace — each seed builds a new labyrinth", VIEW_W / 2, 108);

    ctx.fillStyle = "#7a8aa0";
    ctx.font = "500 11px 'IBM Plex Mono', monospace";
    ctx.fillText(`SEED ${formatSeed(level.seed)}`, VIEW_W / 2, 128);

    const cardW = 160;
    const gap = 18;
    const total = levels.length * cardW + (levels.length - 1) * gap;
    const x0 = (VIEW_W - total) / 2;
    for (let i = 0; i < levels.length; i++) {
      const L = levels[i]!;
      const x = x0 + i * (cardW + gap);
      const y = 148;
      const sel = i === level.selectedLevel;
      ctx.fillStyle = sel ? "rgba(233,163,25,0.16)" : "rgba(20,28,44,0.85)";
      ctx.fillRect(x, y, cardW, 118);
      ctx.strokeStyle = sel ? COLORS.saffron : "rgba(196,165,116,0.35)";
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cardW - 1, 118);

      ctx.fillStyle = COLORS.saffron;
      ctx.font = "500 11px 'IBM Plex Mono', monospace";
      ctx.fillText(`LEVEL ${L.id}`, x + cardW / 2, y + 24);

      ctx.fillStyle = COLORS.parchment;
      ctx.font = "700 15px 'Cormorant Garamond', serif";
      ctx.fillText(L.name, x + cardW / 2, y + 48);

      ctx.fillStyle = "#7a8aa0";
      ctx.font = "500 10px 'IBM Plex Mono', monospace";
      ctx.fillText(`${L.rooms.length} rooms · ${L.closedGates.length} gates`, x + cardW / 2, y + 70);

      ctx.font = "italic 11px 'Cormorant Garamond', serif";
      const words = L.subtitle.split(" ");
      ctx.fillText(words.slice(0, 4).join(" "), x + cardW / 2, y + 92);
      ctx.fillText(words.slice(4).join(" "), x + cardW / 2, y + 106);
    }

    ctx.fillStyle = COLORS.sandLit;
    ctx.font = "500 12px 'IBM Plex Mono', monospace";
    ctx.globalAlpha = 0.55 + pulse * 0.45;
    ctx.fillText("← → select   ENTER start   R new seed", VIEW_W / 2, 300);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#7a8aa0";
    ctx.font = "11px 'IBM Plex Mono', monospace";
    ctx.fillText("Arrows move · Z/Space jump · X strike · plates open gates · find EXIT", VIEW_W / 2, 340);
    ctx.textAlign = "left";
  }

  private drawLevelIntro(level: LevelHud) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(6,10,18,0.75)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.saffron;
    ctx.font = "500 12px 'IBM Plex Mono', monospace";
    ctx.fillText(`LEVEL ${level.levelIndex + 1} OF ${level.levelCount}`, VIEW_W / 2, VIEW_H / 2 - 36);
    ctx.fillStyle = COLORS.parchment;
    ctx.font = "700 34px 'Cormorant Garamond', serif";
    ctx.fillText(level.levelName, VIEW_W / 2, VIEW_H / 2 + 4);
    ctx.fillStyle = "#7a8aa0";
    ctx.font = "italic 15px 'Cormorant Garamond', serif";
    ctx.fillText(level.levelSubtitle, VIEW_W / 2, VIEW_H / 2 + 36);
    ctx.textAlign = "left";
  }

  private drawCenterMsg(title: string, sub: string) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(6,10,18,0.7)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.saffron;
    ctx.font = "700 32px 'Cormorant Garamond', serif";
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 10);
    ctx.fillStyle = COLORS.parchment;
    ctx.font = "italic 16px 'Cormorant Garamond', serif";
    ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 24);
    ctx.textAlign = "left";
  }
}
