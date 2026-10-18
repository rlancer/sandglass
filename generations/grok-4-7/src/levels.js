export const W = 960;
export const H = 540;
export const COLS = 10;
export const TILE = 96;
export const PITCH = 158;
export const SURFACE0 = 468;
export const SLAB = 32;
export const CHAR_H = 96;
export const CHAR_R = 14;
export const GRAV = 2300;
export const JUMP_V = -860;
export const RUN = 300;

export function surfaceY(row) {
  return SURFACE0 - row * PITCH;
}

function room(def) {
  const [top, mid, bot] = def.rows;
  for (const line of [top, mid, bot]) {
    if (line.length !== COLS) throw new Error(`${def.id} grid is ${line.length}`);
  }
  return { ...def, grid: [[...bot], [...mid], [...top]] };
}

export const rooms = {
  cell: room({
    id: "cell",
    name: "The Quiet Cell",
    hint: "Arrows move. Space jumps.",
    rows: ["..........", "..........", "##########"],
    right: "runway",
  }),
  runway: room({
    id: "runway",
    name: "The Broken Walk",
    hint: "Run, then jump. A standing hop will not cross this.",
    rows: ["..........", "..........", "###..#####"],
    left: "cell",
    right: "gallery",
  }),
  gallery: room({
    id: "gallery",
    name: "The High Gallery",
    hint: "Hold ↑ and jump to catch the ledge. ↓ takes the sword.",
    rows: ["..........", "....####..", "####....##"],
    left: "runway",
    right: "needles",
    items: [{ id: "sword", col: 5, row: 1, kind: "sword" }],
  }),
  needles: room({
    id: "needles",
    name: "The Needle Court",
    hint: "Cross while the spikes are asleep. The balcony is safe.",
    rows: ["..........", "..####....", "##^##^####"],
    left: "gallery",
    right: "gatehouse",
    items: [{ id: "needles-life", col: 3, row: 1, kind: "life" }],
  }),
  gatehouse: room({
    id: "gatehouse",
    name: "Shahin's Seal",
    hint: "Step on the bronze seal. X strikes. Z parries. C sheaths, so you can run.",
    rows: ["..........", "..........", "##########"],
    left: "needles",
    right: "eclipse",
    plates: [{ col: 1, row: 0, id: "gatehouse", latch: true }],
    gates: [{ col: 3, row: 0, id: "gatehouse" }],
    guards: [
      { id: "gatekeep", col: 8, row: 0, phase: "both", hp: 3, min: 5, max: 9, slow: true },
    ],
  }),
  eclipse: room({
    id: "eclipse",
    name: "Where the Hours Meet",
    hint: "F steps into the other hour. Stone of the wrong hour will not hold you.",
    rows: ["..........", "..........", "DDD#NNN###"],
    left: "gatehouse",
    right: "seal",
  }),
  seal: room({
    id: "seal",
    name: "Weight of a Shadow",
    hint: "Shift while you stand on the seal. The hour you leave behind can hold it.",
    rows: ["..........", "..........", "####..####"],
    left: "eclipse",
    right: "crumbles",
    plates: [{ col: 2, row: 0, id: "shadow", latch: false }],
    gates: [{ col: 6, row: 0, id: "shadow" }],
  }),
  crumbles: room({
    id: "crumbles",
    name: "The Crumbling Court",
    hint: "The first loose stone warns you. The next ones do not.",
    rows: ["..........", "..~~~##...", "###....###"],
    left: "seal",
    right: "blades",
  }),
  blades: room({
    id: "blades",
    name: "The Patient Blades",
    hint: "Wait in the gaps. The blades tell you when.",
    rows: ["..........", "..........", "##########"],
    left: "crumbles",
    right: "watch",
    blades: [
      { col: 2, row: 0, offset: 0 },
      { col: 6, row: 0, offset: 1.05 },
    ],
  }),
  watch: room({
    id: "watch",
    name: "The Night Watch",
    hint: "The bridge exists only at night. So does the guard. The ledges exist in both.",
    rows: ["..........", "..........", "##NNNNNN##"],
    left: "blades",
    right: "cloister",
    items: [{ id: "watch-life", col: 1, row: 0, kind: "life" }],
    guards: [
      { id: "watchman", col: 5, row: 0, phase: "night", hp: 3, min: 2, max: 7 },
    ],
  }),
  cloister: room({
    id: "cloister",
    name: "The Cloister",
    hint: "Red heals. Amber returns sand. Cracked green bites.",
    rows: ["..........", ".#.#.#....", "##########"],
    left: "watch",
    right: "warden",
    items: [
      { id: "cloister-life", col: 1, row: 1, kind: "life" },
      { id: "cloister-sand", col: 3, row: 1, kind: "sand" },
      { id: "cloister-bile", col: 5, row: 1, kind: "bile" },
    ],
  }),
  warden: room({
    id: "warden",
    name: "The Hour Warden",
    hint: "He follows you across hours, a moment late. The pit is also a weapon.",
    rows: ["..........", ".#........", "####....##"],
    left: "cloister",
    right: "stair",
    items: [{ id: "warden-life", col: 1, row: 1, kind: "life" }],
    guards: [
      { id: "warden", col: 2, row: 0, phase: "both", hp: 5, min: 0, max: 3, boss: true },
    ],
    bridge: { guard: "warden", cols: [4, 5, 6, 7], row: 0 },
  }),
  stair: room({
    id: "stair",
    name: "The Sun Steps",
    hint: "Climb toward the light. ↑ at the arch.",
    rows: ["......####", "..####....", "####......"],
    left: "warden",
    up: "tower",
    upCols: [8, 9],
  }),
  tower: room({
    id: "tower",
    name: "The Solar Tower",
    hint: "↑ take her hand.",
    rows: ["..........", "..........", "##########"],
    down: "stair",
    downCols: [8, 9],
    laleh: { col: 4, row: 0 },
  }),
};

export function fmtTime(t) {
  const s = Math.max(0, Math.ceil(t - 1e-4));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function spikeVisual(time, col, row, ch, phase) {
  const armed =
    ch === "^" || (ch === "d" && phase === "day") || (ch === "n" && phase === "night");
  if (!armed) return null;
  const period = 1.75;
  const p = (((time + col * 0.47 + row) % period) + period) % period / period;
  return { up: p >= 0.16 && p < 0.52, warn: p < 0.16, p };
}

export function bladeVisual(time, offset) {
  const period = 2.25;
  const p = (((time + offset) % period) + period) % period / period;
  let h = 0;
  if (p < 0.48) h = 0;
  else if (p < 0.62) h = ((p - 0.48) / 0.14) * 0.12;
  else if (p < 0.7) h = 0.12 + ((p - 0.62) / 0.08) * 0.88;
  else if (p < 0.82) h = 1;
  else h = 1 - (p - 0.82) / 0.18;
  return {
    p,
    h: Math.max(0, Math.min(1, h)),
    deadly: p >= 0.66 && p < 0.82,
    warn: p >= 0.48 && p < 0.66,
  };
}
