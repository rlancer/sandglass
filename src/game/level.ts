import { ROOM_COLS, ROOM_ROWS, TILE_H, TILE_W } from "./constants";
import { getLevels } from "./levels";
import type { Facing, GuardSpawn, LevelDef, PickupSpawn, RoomDef, SwitchSpawn, Tile, TileKind } from "./types";

const CHAR_MAP: Record<string, TileKind> = {
  ".": "empty",
  " ": "empty",
  "#": "wall",
  "=": "floor",
  "|": "pillar",
  "^": "spikes",
  "G": "gate",
  "~": "loose",
  "E": "exit",
  "T": "torch",
};

export interface Guard {
  x: number;
  y: number;
  vx: number;
  facing: Facing;
  hp: number;
  maxHp: number;
  anim: "idle" | "advance" | "retreat" | "strike" | "hurt" | "die";
  animT: number;
  strikeT: number;
  hurtT: number;
  dead: boolean;
  engage: boolean;
}

export interface Pickup {
  type: "sword" | "heal" | "life";
  x: number;
  y: number;
  taken: boolean;
  bob: number;
}

export interface SwitchPad {
  x: number;
  y: number;
  gates: { room: string; col: number; row: number }[];
  pressed: boolean;
}

export class Room {
  id: string;
  tiles: Tile[][];
  links: RoomDef["links"];
  mood: NonNullable<RoomDef["mood"]>;
  guards: Guard[];
  pickups: Pickup[];
  switches: SwitchPad[];
  spawnX: number;
  spawnY: number;

  constructor(def: RoomDef) {
    this.id = def.id;
    this.links = def.links;
    this.mood = def.mood ?? "dungeon";
    this.tiles = [];
    for (let r = 0; r < ROOM_ROWS; r++) {
      const row: Tile[] = [];
      const line = def.map[r] ?? "".padEnd(ROOM_COLS, ".");
      for (let c = 0; c < ROOM_COLS; c++) {
        const ch = line[c] ?? ".";
        const kind = CHAR_MAP[ch] ?? "empty";
        row.push({
          kind,
          state: kind === "gate" ? 0 : 0,
          solid: kind === "wall" || kind === "pillar" || kind === "gate" || kind === "floor" || kind === "loose" || kind === "exit" || kind === "torch",
        });
      }
      this.tiles.push(row);
    }
    this.guards = (def.guards ?? []).map((g) => makeGuard(g));
    this.pickups = (def.pickups ?? []).map((p) => ({
      type: p.type,
      x: p.x,
      y: p.y,
      taken: false,
      bob: Math.random() * Math.PI * 2,
    }));
    this.switches = (def.switches ?? []).map((s) => ({
      x: s.x,
      y: s.y,
      gates: s.gates,
      pressed: false,
    }));
    // Prefer a bottom-row floor spawn
    this.spawnX = TILE_W * 1.2;
    this.spawnY = floorY(this, ROOM_ROWS - 1);
    for (let r = ROOM_ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < ROOM_COLS; c++) {
        const k = this.tiles[r][c].kind;
        if (k === "floor" || k === "exit" || k === "loose" || k === "torch") {
          this.spawnX = c * TILE_W + TILE_W * 0.35;
          this.spawnY = this.surfaceY(c, r) ?? floorY(this, r);
          return;
        }
      }
    }
  }

  tileAt(col: number, row: number): Tile | null {
    if (col < 0 || row < 0 || col >= ROOM_COLS || row >= ROOM_ROWS) return null;
    return this.tiles[row][col];
  }

  /** Top surface Y of a floor-like tile, or null */
  surfaceY(col: number, row: number): number | null {
    const t = this.tileAt(col, row);
    if (!t) return null;
    if (
      t.kind === "floor" ||
      t.kind === "loose" ||
      t.kind === "exit" ||
      t.kind === "torch" ||
      t.kind === "spikes"
    ) {
      return row * TILE_H + 18;
    }
    if (t.kind === "gate" && t.state < 0.55) {
      return row * TILE_H + 18;
    }
    return null;
  }
}

function makeGuard(g: GuardSpawn): Guard {
  const hp = g.hp ?? 3;
  return {
    x: g.x,
    y: g.y,
    vx: 0,
    facing: g.facing ?? -1,
    hp,
    maxHp: hp,
    anim: "idle",
    animT: 0,
    strikeT: 0,
    hurtT: 0,
    dead: false,
    engage: false,
  };
}

function floorY(_room: Room, row: number): number {
  return row * TILE_H + 18;
}

export class World {
  rooms = new Map<string, Room>();
  currentId: string;
  /** Cross-room gate state sync */
  private gateKeys = new Map<string, number>();

  constructor(defs: RoomDef[], startId: string) {
    for (const d of defs) {
      this.rooms.set(d.id, new Room(d));
    }
    this.currentId = startId;
  }

  get room(): Room {
    return this.rooms.get(this.currentId)!;
  }

  gateKey(room: string, col: number, row: number) {
    return `${room}:${col},${row}`;
  }

  setGate(roomId: string, col: number, row: number, open: number) {
    this.gateKeys.set(this.gateKey(roomId, col, row), open);
    const room = this.rooms.get(roomId);
    const t = room?.tileAt(col, row);
    if (t && t.kind === "gate") {
      t.state = open;
      t.solid = open < 0.55;
    }
  }

  pressSwitches(px: number, py: number, onToggle: () => void) {
    const room = this.room;
    for (const s of room.switches) {
      const on =
        Math.abs(px - s.x) < 22 &&
        py >= s.y - 8 &&
        py <= s.y + 24;
      if (on && !s.pressed) {
        s.pressed = true;
        for (const g of s.gates) {
          this.setGate(g.room, g.col, g.row, 1);
        }
        onToggle();
      } else if (!on) {
        s.pressed = false;
      }
    }
  }

  tryExit(px: number, py: number, facing: Facing): { room: string; x: number; y: number } | null {
    const room = this.room;
    const links = room.links;
    // Keep spawn clear of side wall columns (tiles 0-1 / 8-9)
    if (px < 10 && links.left) {
      return { room: links.left, x: VIEW_EDGE_RIGHT - 80, y: py };
    }
    if (px > VIEW_EDGE_RIGHT - 10 && links.right) {
      return { room: links.right, x: 96, y: py };
    }
    if (py < 8 && links.up) {
      return { room: links.up, x: px, y: VIEW_EDGE_BOTTOM - 50 };
    }
    if (py > VIEW_EDGE_BOTTOM - 10 && links.down) {
      return { room: links.down, x: px, y: 60 };
    }
    void facing;
    return null;
  }

  enter(roomId: string, x: number, y: number) {
    this.currentId = roomId;
    return { x, y };
  }
}

const VIEW_EDGE_RIGHT = ROOM_COLS * TILE_W - 16;
const VIEW_EDGE_BOTTOM = ROOM_ROWS * TILE_H - 8;

export function loadLevel(levelIndex: number): {
  world: World;
  level: LevelDef;
  start: { room: string; x: number; y: number };
} {
  const levels = getLevels();
  const level = levels[Math.max(0, Math.min(levels.length - 1, levelIndex))]!;
  const world = new World(level.rooms, level.startRoom);
  for (const g of level.closedGates) {
    world.setGate(g.room, g.col, g.row, 0);
  }
  const startRoom = world.rooms.get(level.startRoom)!;
  return {
    world,
    level,
    start: {
      room: level.startRoom,
      x: level.startX,
      y: startRoom.spawnY,
    },
  };
}

export type SolidHit = {
  kind: "floor" | "wall" | "spikes" | "gate" | "loose" | "exit";
  col: number;
  row: number;
  top: number;
  left: number;
  right: number;
};

/** Axis-aligned collision helpers against room tiles */
export function probeFloor(room: Room, x: number, y: number, feetW: number): SolidHit | null {
  const feetY = y;
  const left = x - feetW * 0.35;
  const right = x + feetW * 0.35;
  const row = Math.floor(feetY / TILE_H);
  const cols = [Math.floor(left / TILE_W), Math.floor(x / TILE_W), Math.floor(right / TILE_W)];
  let best: SolidHit | null = null;
  for (const col of cols) {
    for (let r = Math.max(0, row - 1); r <= Math.min(ROOM_ROWS - 1, row + 1); r++) {
      const t = room.tileAt(col, r);
      if (!t) continue;
      const top = room.surfaceY(col, r);
      if (top == null) continue;
      if (
        feetY >= top - 12 &&
        feetY <= top + 22 &&
        right > col * TILE_W + 4 &&
        left < (col + 1) * TILE_W - 4
      ) {
        const hit: SolidHit = {
          kind: t.kind as SolidHit["kind"],
          col,
          row: r,
          top,
          left: col * TILE_W,
          right: (col + 1) * TILE_W,
        };
        if (!best || hit.top < best.top) best = hit;
      }
    }
  }
  return best;
}

export function probeWall(room: Room, x: number, y: number, halfW: number, height: number): SolidHit | null {
  // Only torso/head samples — feet may stand on a floor under a wall tile above
  const points = [
    { x: x - halfW, y: y - height * 0.85 },
    { x: x + halfW, y: y - height * 0.85 },
    { x: x - halfW, y: y - height * 0.45 },
    { x: x + halfW, y: y - height * 0.45 },
  ];
  for (const p of points) {
    const col = Math.floor(p.x / TILE_W);
    const row = Math.floor(p.y / TILE_H);
    const t = room.tileAt(col, row);
    if (!t) continue;
    const isGate = t.kind === "gate" && t.state < 0.55;
    if (t.kind === "wall" || t.kind === "pillar" || isGate) {
      // Walls/pillars don't block the walkway on the floor row beneath them
      if (!isGate) {
        const floorBelow = room.surfaceY(col, row + 1);
        if (floorBelow != null && y >= floorBelow - 2 && y <= floorBelow + 10) {
          continue;
        }
      }
      return {
        kind: isGate ? "gate" : "wall",
        col,
        row,
        top: row * TILE_H,
        left: col * TILE_W,
        right: (col + 1) * TILE_W,
      };
    }
  }
  return null;
}

export function ledgeAt(room: Room, x: number, y: number, facing: Facing): { x: number; y: number } | null {
  const col = Math.floor((x + facing * 18) / TILE_W);
  const row = Math.floor((y - 40) / TILE_H);
  for (let r = row; r <= row + 1; r++) {
    const top = room.surfaceY(col, r);
    if (top == null) continue;
    if (y > top + 10 && y < top + 90 && Math.abs(x + facing * 14 - (col * TILE_W + (facing > 0 ? 0 : TILE_W))) < 28) {
      return { x: col * TILE_W + (facing > 0 ? 4 : TILE_W - 4), y: top + 36 };
    }
  }
  return null;
}

export type { PickupSpawn, SwitchSpawn };
