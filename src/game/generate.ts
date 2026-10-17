import { ROOM_COLS, ROOM_ROWS, TILE_H, TILE_W } from "./constants";
import { Rng } from "./rng";
import type {
  GuardSpawn,
  LevelDef,
  PickupSpawn,
  RoomDef,
  RoomLink,
  SwitchSpawn,
} from "./types";

type Mood = NonNullable<RoomDef["mood"]>;
type Dir = "left" | "right" | "up" | "down";

interface GridCell {
  gx: number;
  gy: number;
  id: string;
  open: Record<Dir, boolean>;
  role: "start" | "exit" | "combat" | "puzzle" | "climb" | "hazard" | "normal";
}

interface LockPlan {
  gateRoom: string;
  gateCol: number;
  gateRow: number;
  switchRoom: string;
  switchX: number;
  switchY: number;
}

const DIRS: { dir: Dir; dx: number; dy: number; opp: Dir }[] = [
  { dir: "left", dx: -1, dy: 0, opp: "right" },
  { dir: "right", dx: 1, dy: 0, opp: "left" },
  { dir: "up", dx: 0, dy: -1, opp: "down" },
  { dir: "down", dx: 0, dy: 1, opp: "up" },
];

const NAMES = [
  "The Dungeons",
  "The Palace",
  "Hourglass Tower",
  "Mirror Crypt",
  "Saffron Bastion",
  "The Silent Court",
  "Vizier's Spire",
  "Sandstone Labyrinth",
];

const SUBS = [
  "Gates bar the way — find their plates.",
  "Loose stone and iron teeth. Mind your step.",
  "Climb, leap, and cut a path upward.",
  "The walls remember every footfall.",
  "A blade, a plate, a door — then the next.",
];

export interface GenOptions {
  tier: number; // 1..3
  seed: number;
  levelId: number;
}

/**
 * Procedural PoP-style palace: room graph + decorated tiles,
 * critical-path gate locks, combat, and platforming.
 */
export function generateLevel(opts: GenOptions): LevelDef {
  const rng = new Rng(opts.seed ^ (opts.tier * 0x9e3779b9) ^ (opts.levelId * 0x85ebca6b));
  const tier = Math.max(1, Math.min(3, opts.tier));

  const width = tier === 1 ? 3 : tier === 2 ? 4 : 4;
  const height = tier === 1 ? 2 : tier === 2 ? 3 : 3;
  const targetRooms = tier === 1 ? 6 : tier === 2 ? 9 : 11;

  const cells = carveGraph(rng, width, height, targetRooms);
  assignRoles(rng, cells, tier);
  const locks = planLocks(rng, cells, tier);

  const rooms: RoomDef[] = [];
  const closedGates: LevelDef["closedGates"] = [];

  for (const cell of cells.values()) {
    const locksHere = locks.filter((l) => l.gateRoom === cell.id);
    const switchesHere = locks.filter((l) => l.switchRoom === cell.id);
    const def = decorateRoom(rng, cell, locksHere, switchesHere, tier);
    rooms.push(def);
    for (const L of locksHere) {
      closedGates.push({ room: L.gateRoom, col: L.gateCol, row: L.gateRow });
    }
  }

  const start = [...cells.values()].find((c) => c.role === "start")!;
  const moodName = NAMES[(opts.seed + tier * 3) % NAMES.length]!;

  return {
    id: opts.levelId,
    name: moodName,
    subtitle: rng.pick(SUBS),
    startRoom: start.id,
    startX: 96,
    closedGates,
    rooms,
    startWithSword: tier >= 2,
  };
}

function key(gx: number, gy: number) {
  return `${gx},${gy}`;
}

function carveGraph(rng: Rng, w: number, h: number, target: number): Map<string, GridCell> {
  const startX = 0;
  const startY = h - 1;
  const cells = new Map<string, GridCell>();

  const make = (gx: number, gy: number): GridCell => {
    const id = `r${gx}_${gy}`;
    const c: GridCell = {
      gx,
      gy,
      id,
      open: { left: false, right: false, up: false, down: false },
      role: "normal",
    };
    cells.set(key(gx, gy), c);
    return c;
  };

  make(startX, startY);
  const stack: GridCell[] = [cells.get(key(startX, startY))!];

  // Growing tree — prefer expanding until target room count
  while (stack.length && cells.size < target) {
    const cur = rng.chance(0.65) ? stack[stack.length - 1]! : rng.pick(stack);
    const opts = DIRS.map((d) => ({
      ...d,
      nx: cur.gx + d.dx,
      ny: cur.gy + d.dy,
    })).filter((d) => d.nx >= 0 && d.ny >= 0 && d.nx < w && d.ny < h && !cells.has(key(d.nx, d.ny)));

    if (!opts.length) {
      stack.splice(stack.indexOf(cur), 1);
      continue;
    }

    const pick = rng.pick(opts);
    const next = make(pick.nx, pick.ny);
    cur.open[pick.dir] = true;
    next.open[pick.opp] = true;
    stack.push(next);
  }

  // Extra loops for intrigue (1–3)
  const all = [...cells.values()];
  const loops = rng.range(1, 3);
  for (let i = 0; i < loops; i++) {
    const a = rng.pick(all);
    for (const d of rng.shuffle(DIRS)) {
      const b = cells.get(key(a.gx + d.dx, a.gy + d.dy));
      if (b && !a.open[d.dir]) {
        a.open[d.dir] = true;
        b.open[d.opp] = true;
        break;
      }
    }
  }

  return cells;
}

function assignRoles(rng: Rng, cells: Map<string, GridCell>, tier: number) {
  const list = [...cells.values()];
  const bottoms = list.filter((c) => c.gy === Math.max(...list.map((x) => x.gy)));
  const startCell = bottoms.reduce((a, b) => (a.gx <= b.gx ? a : b));
  startCell.role = "start";

  const dist = bfsDist(cells, startCell);
  let exit = startCell;
  let best = -1;
  for (const c of list) {
    const d = dist.get(c.id) ?? 0;
    if (d > best) {
      best = d;
      exit = c;
    }
  }
  exit.role = "exit";

  const rest = list.filter((c) => c.role === "normal");
  const shuffled = rng.shuffle(rest);

  const combatN = Math.min(shuffled.length, tier + 1);
  for (let i = 0; i < combatN; i++) shuffled[i]!.role = "combat";

  const climbCandidates = shuffled.filter(
    (c) => c.role === "normal" && (c.open.up || c.open.down),
  );
  for (const c of climbCandidates.slice(0, tier)) c.role = "climb";

  const hazardN = Math.min(
    shuffled.filter((c) => c.role === "normal").length,
    tier,
  );
  let h = 0;
  for (const c of shuffled) {
    if (c.role === "normal" && h < hazardN) {
      c.role = "hazard";
      h++;
    }
  }
}

function bfsDist(cells: Map<string, GridCell>, start: GridCell): Map<string, number> {
  const dist = new Map<string, number>();
  const q: GridCell[] = [start];
  dist.set(start.id, 0);
  while (q.length) {
    const cur = q.shift()!;
    const d = dist.get(cur.id)!;
    for (const { dir, dx, dy } of DIRS) {
      if (!cur.open[dir]) continue;
      const n = cells.get(key(cur.gx + dx, cur.gy + dy));
      if (!n || dist.has(n.id)) continue;
      dist.set(n.id, d + 1);
      q.push(n);
    }
  }
  return dist;
}

function planLocks(rng: Rng, cells: Map<string, GridCell>, tier: number): LockPlan[] {
  const list = [...cells.values()];
  const start = list.find((c) => c.role === "start")!;
  const exit = list.find((c) => c.role === "exit")!;
  const dist = bfsDist(cells, start);
  const path = pathTo(cells, start, exit, dist);
  if (path.length < 3) return [];

  const lockCount = tier === 1 ? 1 : tier === 2 ? 2 : 3;
  const locks: LockPlan[] = [];
  const usedRooms = new Set<string>();

  // Place gates on rooms along the path (not start), switches earlier or in branches
  const gateSlots = path.slice(1, -1);
  for (let i = 0; i < lockCount && gateSlots.length; i++) {
    const gateCell = gateSlots[Math.floor(((i + 1) * gateSlots.length) / (lockCount + 1))]!;
    if (usedRooms.has(gateCell.id)) continue;

    // Switch: prefer a side room reachable with dist < gate dist, else earlier path room
    const gateDist = dist.get(gateCell.id) ?? 0;
    const branch = list.filter(
      (c) =>
        c.id !== gateCell.id &&
        c.role !== "exit" &&
        (dist.get(c.id) ?? 99) < gateDist &&
        !usedRooms.has(c.id),
    );
    const switchCell =
      branch.length > 0
        ? rng.pick(branch)
        : path[Math.max(0, path.indexOf(gateCell) - 1)]!;

    const gateCol = rng.range(3, 6);
    const gateRow = 1;
    const floorY = (ROOM_ROWS - 1) * TILE_H + 18;
    const switchCol = rng.range(2, 7);

    locks.push({
      gateRoom: gateCell.id,
      gateCol,
      gateRow,
      switchRoom: switchCell.id,
      switchX: switchCol * TILE_W + TILE_W / 2,
      switchY: floorY,
    });
    usedRooms.add(gateCell.id);
    usedRooms.add(switchCell.id);
    gateCell.role = gateCell.role === "exit" ? "exit" : "puzzle";
  }

  return locks;
}

function pathTo(
  cells: Map<string, GridCell>,
  start: GridCell,
  goal: GridCell,
  dist: Map<string, number>,
): GridCell[] {
  // Walk backward from goal using decreasing distance
  const path: GridCell[] = [goal];
  let cur = goal;
  for (let guard = 0; guard < 64; guard++) {
    if (cur.id === start.id) break;
    const d = dist.get(cur.id) ?? 0;
    let next: GridCell | null = null;
    for (const { dir, dx, dy } of DIRS) {
      if (!cur.open[dir]) continue;
      const n = cells.get(key(cur.gx + dx, cur.gy + dy));
      if (!n) continue;
      if ((dist.get(n.id) ?? 999) === d - 1) {
        next = n;
        break;
      }
    }
    if (!next) break;
    path.push(next);
    cur = next;
  }
  path.reverse();
  return path;
}

function decorateRoom(
  rng: Rng,
  cell: GridCell,
  locksHere: LockPlan[],
  switchesHere: LockPlan[],
  tier: number,
): RoomDef {
  const grid = emptyGrid();
  // Base floor
  for (let c = 0; c < ROOM_COLS; c++) grid[2]![c] = "=";

  // Side walls only on top rows when no exit that way — keep walkway clear
  if (!cell.open.left) {
    grid[0]![0] = "#";
    grid[1]![0] = "#";
  }
  if (!cell.open.right) {
    grid[0]![9] = "#";
    grid[1]![9] = "#";
  }

  // Vertical connectivity platforms
  if (cell.open.up || cell.role === "climb") {
    stampClimb(grid, rng);
  }
  if (cell.open.down && !cell.open.up) {
    // landing pads near top for falling in
    grid[0]![rng.range(3, 6)] = "=";
  }

  // Role motifs
  if (cell.role === "hazard" || (cell.role === "normal" && rng.chance(0.35 * tier))) {
    stampHazards(grid, rng, tier);
  }
  if (cell.role === "combat" || cell.role === "puzzle") {
    stampPillars(grid, rng);
  }
  if (cell.role === "puzzle" && rng.chance(0.55)) {
    // Raised gallery — switch often sits below, gate above path
    grid[1]![rng.range(2, 4)] = "=";
    grid[1]![rng.range(6, 8)] = "=";
  }
  if (rng.chance(0.55)) {
    grid[0]![rng.range(2, 7)] = "T";
  }
  // Ornamental upper rubble for denser silhouette
  if (tier >= 2 && rng.chance(0.4)) {
    const c = rng.range(2, 7);
    if (grid[0]![c] === ".") grid[0]![c] = rng.chance(0.5) ? "|" : "#";
  }

  // Gates
  for (const L of locksHere) {
    grid[L.gateRow]![L.gateCol] = "G";
    // Ensure floor under gate column
    grid[2]![L.gateCol] = "=";
  }

  // Exit doorway
  if (cell.role === "exit") {
    const ec = rng.range(4, 6);
    grid[0]![ec] = "E";
    grid[1]![ec] = "=";
    // clear nearby
    grid[1]![ec - 1] = ".";
    grid[1]![ec + 1] = ".";
  }

  // Start: open floor, maybe mid ledge
  if (cell.role === "start") {
    for (let c = 1; c < 9; c++) grid[2]![c] = "=";
    if (rng.chance(0.5)) grid[1]![5] = "=";
  }

  // Ensure openings at edges are walkable (no wall blocking transition band)
  if (cell.open.left) {
    grid[2]![0] = "=";
    grid[1]![0] = ".";
  }
  if (cell.open.right) {
    grid[2]![9] = "=";
    grid[1]![9] = ".";
  }
  if (cell.open.up) {
    // gap in top for leave-up
    const c = rng.range(3, 6);
    grid[0]![c] = ".";
    if (grid[1]![c] === "#") grid[1]![c] = ".";
  }
  if (cell.open.down) {
    // pit or drop — leave a soft gap but keep ledges
    if (rng.chance(0.4)) {
      const c = rng.range(3, 6);
      if (grid[2]![c] === "=") grid[2]![c] = rng.chance(0.5) ? "~" : "=";
    }
  }

  // Don't put spikes on entire critical walk — leave safe tiles
  ensureSafePath(grid);

  const links = linksFrom(cell);
  const mood = moodFor(cell, tier, rng);
  const floorY = (ROOM_ROWS - 1) * TILE_H + 18;

  const guards: GuardSpawn[] = [];
  const pickups: PickupSpawn[] = [];
  const switches: SwitchSpawn[] = [];

  if (cell.role === "start" && tier === 1) {
    pickups.push({ type: "sword", x: 360, y: floorY });
  }

  for (const L of switchesHere) {
    switches.push({
      x: L.switchX,
      y: L.switchY,
      gates: [{ room: L.gateRoom, col: L.gateCol, row: L.gateRow }],
    });
  }

  if (cell.role === "combat" || (cell.role === "puzzle" && rng.chance(0.5))) {
    const n = cell.role === "combat" ? (tier >= 3 ? 2 : 1) : 1;
    for (let i = 0; i < n; i++) {
      const col = rng.range(4, 8);
      guards.push({
        x: col * TILE_W + 20,
        y: floorY,
        facing: -1,
        hp: 1 + tier + (rng.chance(0.3) ? 1 : 0),
      });
    }
  }

  if (cell.role === "exit" && tier >= 2) {
    guards.push({ x: 280, y: floorY, facing: 1, hp: 2 + tier });
  }

  if (rng.chance(0.4 + tier * 0.1) && cell.role !== "start") {
    const col = rng.range(2, 7);
    const mid = grid[1]![col] === "=";
    pickups.push({
      type: rng.chance(0.15) ? "life" : "heal",
      x: col * TILE_W + TILE_W / 2,
      y: mid ? 1 * TILE_H + 18 : floorY,
    });
  }

  // Bonus heal near start for higher tiers
  if (cell.role === "start" && tier >= 2) {
    pickups.push({ type: "heal", x: 220, y: floorY });
  }

  return {
    id: cell.id,
    mood,
    map: grid.map((row) => row.join("")),
    links,
    guards: guards.length ? guards : undefined,
    pickups: pickups.length ? pickups : undefined,
    switches: switches.length ? switches : undefined,
  };
}

function emptyGrid(): string[][] {
  return Array.from({ length: ROOM_ROWS }, () => Array.from({ length: ROOM_COLS }, () => "."));
}

function stampClimb(grid: string[][], rng: Rng) {
  // Staggered ledges for hang/climb
  const a = rng.range(2, 4);
  const b = rng.range(5, 7);
  grid[1]![a] = "=";
  grid[1]![b] = "=";
  if (rng.chance(0.6)) grid[0]![rng.range(a, b)] = "=";
  if (rng.chance(0.4)) grid[1]![rng.range(3, 6)] = "T";
}

function stampHazards(grid: string[][], rng: Rng, tier: number) {
  const spikes = rng.range(1, 1 + tier);
  for (let i = 0; i < spikes; i++) {
    const c = rng.range(3, 8);
    if (grid[2]![c] === "=") grid[2]![c] = "^";
  }
  const loose = rng.range(0, tier);
  for (let i = 0; i < loose; i++) {
    const c = rng.range(3, 8);
    if (grid[2]![c] === "=") grid[2]![c] = "~";
  }
  // Occasional broken mid run — forces a jump or careful ledge use
  if (tier >= 2 && rng.chance(0.35)) {
    const gap = rng.range(4, 6);
    grid[2]![gap] = ".";
    grid[1]![gap - 1] = "=";
    grid[1]![gap + 1] = "=";
  }
}

function stampPillars(grid: string[][], rng: Rng) {
  const c = rng.range(3, 6);
  grid[1]![c] = "|";
  if (rng.chance(0.4)) grid[1]![c + 1] = "|";
}

function ensureSafePath(grid: string[][]) {
  // Guarantee at least 4 solid floor tiles on bottom
  let solid = 0;
  for (let c = 0; c < ROOM_COLS; c++) {
    if (grid[2]![c] === "=" || grid[2]![c] === "T" || grid[2]![c] === "E") solid++;
  }
  if (solid < 4) {
    for (let c = 0; c < ROOM_COLS && solid < 5; c++) {
      if (grid[2]![c] === "^" || grid[2]![c] === "~" || grid[2]![c] === ".") {
        grid[2]![c] = "=";
        solid++;
      }
    }
  }
  // Left spawn band safe
  grid[2]![1] = "=";
  grid[2]![2] = "=";
}

function linksFrom(cell: GridCell): RoomLink {
  const links: RoomLink = {};
  if (cell.open.left) links.left = `r${cell.gx - 1}_${cell.gy}`;
  if (cell.open.right) links.right = `r${cell.gx + 1}_${cell.gy}`;
  if (cell.open.up) links.up = `r${cell.gx}_${cell.gy - 1}`;
  if (cell.open.down) links.down = `r${cell.gx}_${cell.gy + 1}`;
  return links;
}

function moodFor(cell: GridCell, tier: number, rng: Rng): Mood {
  if (cell.role === "exit") return "tower";
  if (cell.role === "climb") return rng.chance(0.5) ? "tower" : "palace";
  if (tier === 1) return "dungeon";
  if (tier === 2) return rng.chance(0.4) ? "dungeon" : "palace";
  return rng.pick(["palace", "tower", "mirror", "dungeon"] as const);
}

/** Generate all campaign levels from one run seed */
export function generateCampaign(seed: number): LevelDef[] {
  return [1, 2, 3].map((tier) =>
    generateLevel({
      tier,
      seed,
      levelId: tier,
    }),
  );
}
