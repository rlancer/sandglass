import { TW, TH, FT, ROOM_W, ROOM_H, GRAVITY, surfaceY } from "./config.js";
import { sfx } from "./audio.js";
import { particles } from "./particles.js";

const FLOORISH = new Set(["floor", "loose", "spikes", "gate", "plate", "exit", "chomper"]);

function parseCell(ch) {
  const cell = { t: "floor" };
  switch (ch) {
    case ".": case " ": cell.t = "empty"; break;
    case "#": cell.t = "wall"; break;
    case "~": cell.t = "loose"; cell.shake = -1; break;
    case "^": cell.t = "spikes"; cell.ext = 0; cell.stay = 0; break;
    case "K": cell.t = "chomper"; cell.jaw = 0; break;
    case "T": cell.torch = true; break;
    case "W": cell.window = true; break;
    case "I": cell.pillar = true; break;
    case "X": cell.t = "exit"; cell.open = 0; cell.opening = false; break;
    case "O": cell.t = "exit"; cell.open = 1; cell.opening = true; break;
    case "x": cell.t = "plate"; cell.letter = "x"; cell.down = 0; break;
    case "!": cell.item = "red"; break;
    case "$": cell.item = "life"; break;
    case "?": cell.item = "poison"; break;
    case "S": cell.item = "sword"; break;
    case "E": cell.item = "shard"; break;
    default:
      if (ch >= "A" && ch <= "F") Object.assign(cell, { t: "gate", letter: ch, open: 0, hold: 0 });
      else if (ch >= "a" && ch <= "f") Object.assign(cell, { t: "plate", letter: ch.toUpperCase(), down: 0 });
  }
  return cell;
}

export class World {
  constructor(level) {
    this.level = level;
    this.rows = level.map.length;
    this.cols = level.map[0].length;
    this.roomsX = this.cols / ROOM_W;
    this.roomsY = this.rows / ROOM_H;
    this.grid = [];
    this.spawns = { guards: [] };
    this.debris = [];
    this.rubble = new Set();
    this.time = 0;
    this.gateCfg = level.gates || {};
    this.bossDead = false;
    this.dirtyRooms = new Set();
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        const ch = level.map[r][c];
        row.push(parseCell(ch));
        if (ch === "P") this.spawns.player = { c, r };
        if (ch === "G") this.spawns.guards.push({ c, r, kind: level.guard });
        if (ch === "J") this.spawns.guards.push({ c, r, kind: "jaffar" });
        if (ch === "Z") this.spawns.princess = { c, r };
      }
      this.grid.push(row);
    }
    this.plates = [];
    this.gates = [];
    this.exits = [];
    this.chompers = [];
    this.spikes = [];
    this.forEach((cell, c, r) => {
      if (cell.t === "plate") this.plates.push({ cell, c, r });
      if (cell.t === "gate") this.gates.push({ cell, c, r });
      if (cell.t === "exit") this.exits.push({ cell, c, r });
      if (cell.t === "chomper") this.chompers.push({ cell, c, r });
      if (cell.t === "spikes") this.spikes.push({ cell, c, r });
    });
  }

  forEach(fn) {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) fn(this.grid[r][c], c, r);
  }

  cell(c, r) {
    if (r < 0) return { t: "wall" };
    if (c < 0 || c >= this.cols) return { t: "wall" };
    if (r >= this.rows) return { t: "empty" };
    return this.grid[r][c];
  }

  isWall(c, r) {
    return this.cell(c, r).t === "wall";
  }

  hasFloor(c, r) {
    return FLOORISH.has(this.cell(c, r).t);
  }

  // Is there something to stand on at the bottom of cell (c, r)?
  surfaceAt(c, r) {
    return this.hasFloor(c, r) || this.isWall(c, r + 1);
  }

  // A cell an actor can occupy (not wall, no floor above blocking head-room is not required).
  openCell(c, r) {
    return !this.isWall(c, r);
  }

  roomOf(x, y) {
    return {
      rx: Math.max(0, Math.min(this.roomsX - 1, Math.floor(x / (TW * ROOM_W)))),
      ry: Math.max(0, Math.min(this.roomsY - 1, Math.floor(y / (TH * ROOM_H)))),
    };
  }

  // Solid rectangles touching an AABB region.
  solidsIn(x0, y0, x1, y1, out = []) {
    out.length = 0;
    const c0 = Math.floor(x0 / TW), c1 = Math.floor(x1 / TW);
    const r0 = Math.floor(y0 / TH) - 1, r1 = Math.floor(y1 / TH) + 1;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = this.cell(c, r);
        const left = c * TW;
        if (cell.t === "wall") {
          out.push({ x0: left, x1: left + TW, y0: r * TH - FT, y1: (r + 1) * TH, c, r, kind: "wall" });
        } else if (FLOORISH.has(cell.t)) {
          out.push({ x0: left, x1: left + TW, y0: surfaceY(r), y1: (r + 1) * TH, c, r, kind: cell.t });
          if (cell.t === "gate") {
            const gb = this.gateBottom(c, r);
            if (gb > r * TH + 2) out.push({ x0: left + TW / 2 - 4, x1: left + TW / 2 + 4, y0: r * TH - FT, y1: gb, c, r, kind: "gatebar" });
          }
        }
      }
    }
    return out;
  }

  gateBottom(c, r) {
    const cell = this.cell(c, r);
    return r * TH + (1 - cell.open) * (TH - FT);
  }

  triggerLoose(c, r) {
    const cell = this.cell(c, r);
    if (cell.t === "loose" && cell.shake < 0) {
      cell.shake = 0;
      sfx.rattle();
    }
  }

  // Called by actors each step to register weight on a plate / loose floor.
  stepOn(c, r) {
    const cell = this.cell(c, r);
    if (cell.t === "plate") cell.weighted = true;
    if (cell.t === "loose") this.triggerLoose(c, r);
  }

  update(dt, actors, playerRoom) {
    this.time += dt;
    const inRoom = (c, r) => {
      const rx = Math.floor(c / ROOM_W), ry = Math.floor(r / ROOM_H);
      return rx === playerRoom.rx && ry === playerRoom.ry;
    };

    // plates
    for (const p of this.plates) {
      const key = `${p.c},${p.r}`;
      const w = p.cell.weighted || this.rubble.has(key);
      if (w && !p.cell.wasDown) {
        if (inRoom(p.c, p.r)) sfx.click();
        if (p.cell.letter === "x") this.openExits(inRoom);
      }
      p.cell.wasDown = w;
      p.cell.down += ((w ? 1 : 0) - p.cell.down) * Math.min(1, dt * 20);
    }

    // gates
    for (const g of this.gates) {
      const cfg = { hold: 5, close: 3, mode: "any", ...this.gateCfg[g.cell.letter] };
      let active;
      if (cfg.mode === "boss") active = this.bossDead;
      else {
        const plates = this.plates.filter((p) => p.cell.letter === g.cell.letter);
        const states = plates.map((p) => p.cell.wasDown);
        active = plates.length > 0 && (cfg.mode === "all" ? states.every(Boolean) : states.some(Boolean));
      }
      if (active) g.cell.hold = cfg.mode === "boss" ? Infinity : cfg.hold;
      else g.cell.hold -= dt;
      const prev = g.cell.open;
      if (active || g.cell.hold > 0) g.cell.open = Math.min(1, g.cell.open + dt / 0.7);
      else g.cell.open = Math.max(0, g.cell.open - dt / Math.max(0.05, cfg.close));
      if (prev !== g.cell.open && inRoom(g.c, g.r)) {
        g.cell.tick = (g.cell.tick || 0) + dt;
        if (g.cell.tick > 0.07) {
          g.cell.tick = 0;
          sfx.gateTick();
        }
        if (g.cell.open === 0 && prev > 0) sfx.gateSlam();
      }
    }

    // exits
    for (const e of this.exits) {
      if (e.cell.opening && e.cell.open < 1) {
        e.cell.open = Math.min(1, e.cell.open + dt / 2.2);
        if (inRoom(e.c, e.r) && Math.random() < dt * 12) sfx.gateTick();
      }
    }

    // loose floors
    this.forEach((cell, c, r) => {
      if (cell.t !== "loose" || cell.shake < 0) return;
      cell.shake += dt;
      if (cell.shake > 0.5) {
        cell.t = "empty";
        this.debris.push({ c, x: c * TW, y: surfaceY(r), vy: 0, r });
        particles.dust(c * TW + TW / 2, surfaceY(r) + 4, 10);
        if (inRoom(c, r)) sfx.crumble();
      }
    });

    // debris
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      const prevBottom = d.y + FT;
      d.vy = Math.min(900, d.vy + GRAVITY * dt);
      d.y += d.vy * dt;
      const bottom = d.y + FT;
      for (const a of actors) {
        if (!a.alive || a.ghost) continue;
        const top = a.y - a.h;
        if (Math.abs(a.x - (d.x + TW / 2)) < TW / 2 + a.hw - 4 && prevBottom <= top + 6 && bottom > top + 6 && d.y < a.y - a.h) {
          a.hitByDebris?.();
        }
      }
      let landed = false;
      for (let r = Math.floor(prevBottom / TH) - 1; r <= Math.floor(bottom / TH) + 1; r++) {
        if (r < 0 || !this.surfaceAt(d.c, r)) continue;
        const sy = surfaceY(r);
        if (prevBottom <= sy + 0.01 && bottom > sy) {
          landed = true;
          const target = this.cell(d.c, r);
          if (target.t === "loose") this.triggerLoose(d.c, r);
          if (this.hasFloor(d.c, r)) this.rubble.add(`${d.c},${r}`);
          particles.dust(d.x + TW / 2, sy, 26);
          particles.chips(d.x + TW / 2, sy, 14);
          if (inRoom(d.c, r)) sfx.crash();
          break;
        }
      }
      if (landed || d.y > this.rows * TH + 300) this.debris.splice(i, 1);
    }

    // spikes
    for (const s of this.spikes) {
      const cx = s.c * TW + TW / 2, sy = surfaceY(s.r);
      const near = actors.some((a) => a.alive && !a.ghost && Math.abs(a.x - cx) < 78 && a.y > sy - 150 && a.y <= sy + 2);
      if (near) {
        if (s.cell.stay <= 0 && s.cell.ext < 0.5 && inRoom(s.c, s.r)) sfx.spikes();
        s.cell.stay = 1.0;
      } else s.cell.stay -= dt;
      const target = s.cell.stay > 0 ? 1 : 0;
      s.cell.ext += Math.sign(target - s.cell.ext) * dt * (target ? 12 : 3);
      s.cell.ext = Math.max(0, Math.min(1, s.cell.ext));
    }

    // chompers: a shared rhythm, like the palace's heartbeat
    const period = 1.8;
    for (const k of this.chompers) {
      const t = (this.time + k.c * 0.0) % period;
      let jaw = 0;
      if (t >= 1.2 && t < 1.28) jaw = (t - 1.2) / 0.08;
      else if (t >= 1.28 && t < 1.52) jaw = 1;
      else if (t >= 1.52) jaw = 1 - (t - 1.52) / 0.28;
      if (jaw === 1 && k.cell.jaw < 1 && inRoom(k.c, k.r)) sfx.chomp();
      k.cell.jaw = jaw;
    }

    // weights are re-registered every step
    for (const p of this.plates) p.cell.weighted = false;
  }

  openExits(inRoom) {
    for (const e of this.exits) {
      if (!e.cell.opening) {
        e.cell.opening = true;
        if (inRoom(e.c, e.r)) sfx.doorOpen();
      }
    }
  }
}
