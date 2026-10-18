import {
  W,
  H,
  COLS,
  TILE,
  PITCH,
  CHAR_H,
  CHAR_R,
  GRAV,
  JUMP_V,
  RUN,
  surfaceY,
  rooms,
  spikeVisual,
  bladeVisual,
} from "./levels.js";

const AIR_VX = 310;
const STAND_VX = 155;

const FAIL = {
  pit: "The drop is farther than it looks.",
  spike: "The needles were awake.",
  blade: "The blade was patient.",
  fall: "The stones do not forgive a long fall.",
  hp: "The guard was faster.",
  bile: "The cracked bottle was bile.",
  time: "The sand ran out. The hours have sealed.",
};

function makePlayer(x, row) {
  const y = surfaceY(row);
  return {
    x,
    y,
    row,
    vx: 0,
    vy: 0,
    facing: 1,
    mode: "ground",
    act: null,
    hp: 5,
    maxHp: 5,
    iframe: 0,
    hurtT: 0,
    coyote: 0,
    jumpBuf: 0,
    upBuf: 0,
    grabLock: 0,
    magnet: null,
    fallFrom: y,
    runPhase: 0,
    swordOut: false,
    deathT: 0,
    reason: "",
    hang: null,
    climb: null,
    poison: 0,
    stepDist: 0,
    kind: "prince",
    sash: [0, 1, 2, 3].map((i) => ({ x: x - 10 - i * 8, y: y - 42 + i * 4 })),
  };
}

export function createGame(audio) {
  const s = {
    screen: "title",
    storyStep: 0,
    roomId: "eclipse",
    phase: "day",
    phaseBlend: 0,
    sand: 540,
    time: 0,
    hasSword: false,
    player: makePlayer(7.5 * TILE, 0),
    guards: [],
    echo: null,
    laleh: null,
    particles: [],
    taken: new Set(),
    latched: new Set(),
    dead: new Set(),
    looseGone: new Set(),
    looseTimer: new Map(),
    gateAnim: {},
    hintsDone: new Set(),
    toasts: [],
    bannerT: 0,
    banner: "",
    shake: 0,
    shiftFlash: 0,
    shiftLock: 0,
    shiftHang: 0,
    hitStop: 0,
    hurtFlash: 0,
    entryLock: 0,
    bridgeT: 0,
    transition: null,
    checkpoint: null,
    demo: true,
    attractT: 0,
    endingSand: 0,
    newBest: false,
    failText: "",
    showHit: false,
    reduce: false,
    muted: false,
  };

  function room() {
    return rooms[s.roomId];
  }

  function toast(text) {
    s.toasts.push({ text, life: 2.6 });
    if (s.toasts.length > 3) s.toasts.shift();
  }

  function puff(x, y, color, n, speed, grav = 80) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random());
      s.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - Math.abs(speed) * 0.3,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        color,
        r: 1.4 + Math.random() * 2.2,
        grav,
      });
    }
    if (s.particles.length > 200) s.particles.splice(0, s.particles.length - 200);
  }

  function charAt(col, row) {
    const rm = room();
    if (!rm || col < 0 || col >= COLS || row < 0 || row >= 3) return ".";
    return rm.grid[row][col];
  }

  function bridgeOn(col, row) {
    const b = room()?.bridge;
    if (!b || b.row !== row || !b.cols.includes(col)) return false;
    return s.dead.has(b.guard) && s.bridgeT > 0.82;
  }

  function floorAt(col, row, phase) {
    if (bridgeOn(col, row)) return true;
    if (s.looseGone.has(`${row},${col}`)) return false;
    const ch = charAt(col, row);
    if (ch === "#" || ch === "~" || ch === "^") return true;
    if (ch === "D" || ch === "d") return phase === "day";
    if (ch === "N" || ch === "n") return phase === "night";
    return false;
  }

  function supported(x, row, phase) {
    if (row < 0 || row > 2) return false;
    for (const o of [-12, 0, 12]) {
      if (floorAt(Math.floor((x + o) / TILE), row, phase)) return true;
    }
    return false;
  }

  function saveCheckpoint() {
    const p = s.player;
    s.checkpoint = {
      roomId: s.roomId,
      x: p.x,
      row: p.row,
      facing: p.facing,
      phase: s.phase,
      hp: p.hp,
      hasSword: s.hasSword,
      taken: [...s.taken],
      latched: [...s.latched],
      dead: [...s.dead],
    };
  }

  function spawnGuards() {
    s.guards = [];
    for (const spec of room().guards || []) {
      if (s.dead.has(spec.id)) continue;
      const x = (spec.col + 0.5) * TILE;
      s.guards.push({
        id: spec.id,
        col: spec.col,
        row: spec.row,
        phase: spec.phase,
        hp: spec.hp,
        maxHp: spec.hp,
        min: spec.min,
        max: spec.max,
        boss: !!spec.boss,
        slow: !!spec.slow,
        x,
        y: surfaceY(spec.row),
        vx: 40,
        vy: 0,
        facing: -1,
        mode: "ground",
        alive: true,
        alert: false,
        stagger: 0,
        hurtT: 0,
        blocking: 0,
        swing: null,
        decision: 0.6,
        touchCd: 0,
        lag: 0,
        kind: "guard",
        runPhase: 0,
        deathT: 0,
        swordOut: true,
      });
    }
  }

  function placePlayer(x, row) {
    const p = s.player;
    p.x = x;
    p.row = Math.max(0, Math.min(2, row | 0));
    p.vx = 0;
    p.vy = 0;
    p.mode = "ground";
    p.act = null;
    p.magnet = null;
    p.hang = null;
    p.climb = null;
    p.hurtT = 0;
    p.pendingFall = false;
    const other = s.phase === "day" ? "night" : "day";
    if (!supported(p.x, p.row, s.phase)) {
      if (supported(p.x, p.row, other)) s.phase = other;
      else {
        let found = false;
        for (const r of [p.row, 0, 1, 2]) {
          if (found) break;
          for (let c = 0; c < COLS; c++) {
            const xx = (c + 0.5) * TILE;
            if (supported(xx, r, s.phase)) {
              p.x = xx;
              p.row = r;
              found = true;
              break;
            }
            if (supported(xx, r, other)) {
              p.x = xx;
              p.row = r;
              s.phase = other;
              found = true;
              break;
            }
          }
        }
      }
    }
    p.y = surfaceY(p.row);
    p.fallFrom = p.y;
    for (let i = 0; i < p.sash.length; i++) {
      p.sash[i].x = p.x - p.facing * (12 + i * 9);
      p.sash[i].y = p.y - 44 + i * 3;
    }
  }

  function enterRoom(id, spawn) {
    s.roomId = id;
    s.looseGone = new Set();
    s.looseTimer = new Map();
    s.echo = null;
    s.particles = [];
    s.transition = null;
    const rm = rooms[id];
    for (const g of rm.gates || []) {
      if (s.latched.has(g.id)) s.gateAnim[g.id] = 1;
      else if (s.gateAnim[g.id] == null) s.gateAnim[g.id] = 0;
    }
    spawnGuards();
    placePlayer(spawn.x, spawn.row);
    if (rm.laleh) {
      s.laleh = {
        x: (rm.laleh.col + 0.5) * TILE,
        y: surfaceY(rm.laleh.row),
        row: rm.laleh.row,
        facing: -1,
        kind: "laleh",
        mode: "ground",
        vx: 0,
        hp: 1,
        swordOut: false,
      };
    } else s.laleh = null;
    s.banner = rm.name;
    s.bannerT = 2.7;
    s.failText = "";
    s.entryLock = 0.4;
    s.bridgeT = rm.bridge && s.dead.has(rm.bridge.guard) ? 1 : 0;
    if (!s.demo) saveCheckpoint();
  }

  function setupAttract() {
    s.screen = "title";
    s.demo = true;
    s.storyStep = 0;
    s.phase = "day";
    s.phaseBlend = 0;
    s.sand = 540;
    s.time = 0;
    s.hasSword = true;
    s.taken = new Set();
    s.latched = new Set();
    s.dead = new Set();
    s.looseGone = new Set();
    s.looseTimer = new Map();
    s.gateAnim = {};
    s.echo = null;
    s.guards = [];
    s.laleh = null;
    s.particles = [];
    s.transition = null;
    s.shiftFlash = 0;
    s.attractT = 0;
    s.roomId = "eclipse";
    s.player = makePlayer(7.5 * TILE, 0);
    s.player.swordOut = true;
    s.player.facing = 1;
    s.bannerT = 0;
  }

  function beginRun() {
    s.demo = false;
    s.taken = new Set();
    s.latched = new Set();
    s.dead = new Set();
    s.gateAnim = {};
    s.hintsDone = new Set();
    s.hasSword = false;
    s.phase = "day";
    s.phaseBlend = 0;
    s.sand = 540;
    s.time = 0;
    s.toasts = [];
    s.shiftFlash = 0;
    s.hurtFlash = 0;
    s.player = makePlayer(140, 0);
    s.player.swordOut = false;
    s.screen = "play";
    enterRoom("cell", { x: 140, row: 0 });
    audio.unlock();
  }

  function retry() {
    const c = s.checkpoint;
    if (!c) return beginRun();
    if (s.sand <= 0) {
      s.screen = "over";
      s.failText = FAIL.time;
      return;
    }
    s.taken = new Set(c.taken);
    s.latched = new Set(c.latched);
    s.dead = new Set(c.dead);
    s.hasSword = c.hasSword;
    s.phase = c.phase;
    s.demo = false;
    s.player.hp = c.hp;
    s.player.facing = c.facing;
    s.player.iframe = 0.4;
    s.player.poison = 0;
    s.player.deathT = 0;
    s.screen = "play";
    enterRoom(c.roomId, { x: c.x, row: c.row });
    s.player.hp = c.hp;
    s.hasSword = c.hasSword;
    s.phase = c.phase;
    placePlayer(c.x, c.row);
    s.player.facing = c.facing;
    s.checkpoint = {
      ...c,
      taken: [...c.taken],
      latched: [...c.latched],
      dead: [...c.dead],
    };
  }

  function killPlayer(reason) {
    if (s.demo || s.player.mode === "dead") return;
    const p = s.player;
    p.mode = "dead";
    p.reason = reason;
    p.deathT = 0;
    p.vx = 0;
    p.vy = 0;
    p.act = null;
    s.failText = FAIL[reason] || "You fall.";
    audio.death();
    s.shake = Math.max(s.shake, 9);
    puff(p.x, p.y - 40, reason === "time" ? "#e6b34a" : "#c4323c", 14, 80);
  }

  function hurtPlayer(amount, fromX, reason, stay) {
    const p = s.player;
    if (s.demo || p.mode === "dead" || p.iframe > 0) return;
    p.hp -= amount;
    p.iframe = 1.05;
    p.hurtT = 0.32;
    s.hurtFlash = 0.25;
    s.shake = Math.max(s.shake, 6);
    s.hitStop = s.reduce ? 0 : 0.045;
    audio.hurt();
    const dir = Math.sign(p.x - fromX) || -p.facing;
    if (!stay) {
      p.mode = "air";
      p.vy = -260;
      p.vx = dir * 240;
      p.fallFrom = p.y;
      p.grabLock = 0.15;
    }
    puff(p.x, p.y - 50, "#c4323c", 8, 70);
    if (p.hp <= 0) killPlayer(reason);
  }

  function slayGuard(g, how) {
    g.alive = false;
    g.deathT = 0;
    g.swing = null;
    s.dead.add(g.id);
    if (how === "pit") {
      g.mode = "gone";
      audio.hit();
    } else {
      g.mode = "corpse";
      audio.hit();
    }
    if (g.boss) {
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 2);
      toast("The bridge answers.");
      audio.drink();
      s.shake = Math.max(s.shake, 7);
    }
  }

  function tryShift() {
    const p = s.player;
    if (s.shiftLock > 0 || p.mode === "dead" || p.mode === "climb") return;
    if (p.act?.type === "drink") return;
    const prev = s.phase;
    if (p.mode === "ground") {
      s.echo = {
        x: p.x,
        y: p.y,
        row: p.row,
        phase: prev,
        facing: p.facing,
        mode: "ground",
        kind: "prince",
        swordOut: p.swordOut,
        vx: 0,
      };
    } else {
      s.echo = null;
    }
    s.phase = prev === "day" ? "night" : "day";
    s.shiftLock = 0.38;
    s.shiftHang = s.reduce ? 0.04 : 0.12;
    s.shiftFlash = s.reduce ? 0.08 : 0.48;
    audio.shift();
    const dust = s.phase === "night" ? "#d5deef" : "#e6b34a";
    puff(p.x, p.y - 48, dust, 18, 110, -20);
    for (const g of s.guards) if (g.boss && g.alive) g.lag = 0.72;
    if (p.mode === "ground" && !supported(p.x, p.row, s.phase)) p.pendingFall = true;
    if (p.mode === "hang") {
      p.mode = "air";
      p.vy = 20;
      p.fallFrom = p.y;
    }
  }

  function findMagnet() {
    const p = s.player;
    const row = p.row + 1;
    if (row > 2) return null;
    let best = null;
    let bestD = 188;
    for (let col = 0; col < COLS; col++) {
      if (!floorAt(col, row, s.phase)) continue;
      const lipX = p.facing === 1 ? col * TILE : (col + 1) * TILE;
      const behind = p.facing === 1 ? col - 1 : col + 1;
      if (floorAt(behind, row, s.phase)) continue;
      const d = (lipX - p.x) * p.facing;
      if (d < -10 || d > bestD) continue;
      bestD = d;
      best = { lipX, row, sy: surfaceY(row), col, dir: p.facing };
    }
    return best;
  }

  function doJump(vertical) {
    const p = s.player;
    p.mode = "air";
    p.vy = vertical ? JUMP_V * 1.05 : JUMP_V;
    p.fallFrom = p.y;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.upBuf = 0;
    p.grabLock = 0;
    p.pendingFall = false;
    if (vertical) {
      p.vx *= 0.2;
      p.magnet = findMagnet();
    } else if (Math.abs(p.vx) < 70) {
      p.vx = p.facing * STAND_VX;
      p.magnet = null;
    } else {
      const dir = Math.sign(p.vx) || p.facing;
      p.vx = dir * Math.max(Math.abs(p.vx), AIR_VX * 0.94);
      p.magnet = null;
    }
    p.act = null;
    audio.jump();
    puff(p.x, p.y, s.phase === "day" ? "#e6d2b0" : "#9aabc8", 5, 40);
  }

  function tryGrab() {
    const p = s.player;
    if (p.grabLock > 0 || p.vy < 30 || p.mode !== "air") return false;
    const hands = p.y - 72;
    let best = null;
    let bestD = p.magnet ? 68 : 44;
    for (let row = 0; row < 3; row++) {
      const sy = surfaceY(row);
      if (hands > sy + 30 || hands < sy - 40) continue;
      for (let col = 0; col < COLS; col++) {
        if (!floorAt(col, row, s.phase)) continue;
        const lips = [];
        if (!floorAt(col - 1, row, s.phase)) lips.push({ x: col * TILE, dir: 1 });
        if (!floorAt(col + 1, row, s.phase)) lips.push({ x: (col + 1) * TILE, dir: -1 });
        for (const lip of lips) {
          const dx = lip.x - p.x;
          const ad = Math.abs(dx);
          if (ad > bestD) continue;
          if (p.facing === 1 && dx < -18) continue;
          if (p.facing === -1 && dx > 18) continue;
          if (Math.abs(p.vx) > 60 && Math.sign(p.vx) && Math.sign(dx) && Math.sign(dx) !== Math.sign(p.vx) && ad > 16) {
            continue;
          }
          bestD = ad;
          best = { col, row, lipX: lip.x, dir: lip.dir, sy };
        }
      }
    }
    if (!best) return false;
    p.mode = "hang";
    p.hang = best;
    p.facing = best.dir;
    p.x = best.lipX - best.dir * 16;
    p.y = best.sy + 84;
    p.row = best.row;
    p.vx = 0;
    p.vy = 0;
    p.magnet = null;
    p.act = null;
    audio.land();
    return true;
  }

  function startClimb() {
    const p = s.player;
    const h = p.hang;
    if (!h) return;
    p.mode = "climb";
    p.climb = {
      t: 0,
      dur: 0.38,
      fromX: p.x,
      fromY: p.y,
      toX: h.lipX + h.dir * 32,
      toY: h.sy,
      toRow: h.row,
    };
    p.iframe = Math.max(p.iframe, 0.38);
  }

  function dropHang(leap) {
    const p = s.player;
    const h = p.hang;
    p.mode = "air";
    p.fallFrom = h ? h.sy : p.y;
    p.grabLock = 0.3;
    p.magnet = null;
    if (leap && h) {
      p.facing = -h.dir;
      p.vx = p.facing * 230;
      p.vy = -560;
      audio.jump();
    } else {
      p.vy = 60;
      p.vx = p.facing * 40;
    }
    p.hang = null;
  }

  function pushGates(ent) {
    let x = ent.x;
    for (const gate of room().gates || []) {
      if ((s.gateAnim[gate.id] ?? 0) > 0.72) continue;
      if (ent.row !== gate.row) continue;
      if (Math.abs(ent.y - surfaceY(gate.row)) > 50) continue;
      const x0 = gate.col * TILE + 16;
      const x1 = (gate.col + 1) * TILE - 16;
      if (x + CHAR_R > x0 && x - CHAR_R < x1) {
        const mid = (x0 + x1) / 2;
        x = x < mid ? x0 - CHAR_R - 0.8 : x1 + CHAR_R + 0.8;
      }
    }
    return x;
  }

  function bonk(prevY) {
    const p = s.player;
    if (p.vy >= 0) return;
    const prevHead = prevY - CHAR_H;
    const head = p.y - CHAR_H;
    if (head >= prevHead) return;
    for (let row = 0; row < 3; row++) {
      const slabBot = surfaceY(row) + 32;
      if (!(prevHead >= slabBot - 2 && head <= slabBot)) continue;
      for (const o of [-10, 0, 10]) {
        const c = Math.floor((p.x + o) / TILE);
        if (!floorAt(c, row, s.phase)) continue;
        p.y = slabBot + CHAR_H;
        p.vy = 0;
        return;
      }
    }
  }

  function land(prevY) {
    const p = s.player;
    if (p.mode !== "air" || p.vy < 0) return false;
    for (let row = 2; row >= 0; row--) {
      const sy = surfaceY(row);
      const crossed = prevY <= sy + 8 && p.y >= sy - 1;
      const tunneled = p.vy > 0 && prevY < sy && p.y > sy && p.y < sy + 80;
      if ((crossed || tunneled) && supported(p.x, row, s.phase)) {
        const drop = sy - p.fallFrom;
        p.y = sy;
        p.vy = 0;
        p.mode = "ground";
        p.row = row;
        p.magnet = null;
        p.pendingFall = false;
        audio.land();
        puff(p.x, sy, s.phase === "day" ? "#e4d0ae" : "#aeb8cc", 6, 50);
        if (!s.demo && drop > PITCH * 2.35) killPlayer("fall");
        else if (!s.demo && drop > PITCH * 1.5) hurtPlayer(2, p.x, "fall", true);
        return true;
      }
    }
    return false;
  }

  function itemUnder() {
    if (s.player.mode !== "ground") return null;
    const col = Math.floor(s.player.x / TILE);
    for (const item of room().items || []) {
      if (s.taken.has(item.id)) continue;
      if (item.col === col && item.row === s.player.row) return item;
    }
    return null;
  }

  function applyItem(item) {
    s.taken.add(item.id);
    const p = s.player;
    if (item.kind === "sword") {
      s.hasSword = true;
      p.swordOut = true;
      toast("The sword is yours.");
      audio.drink();
    } else if (item.kind === "life") {
      p.hp = Math.min(p.maxHp, p.hp + 2);
      toast("Life returns.");
      audio.drink();
    } else if (item.kind === "sand") {
      s.sand = Math.min(600, s.sand + 50);
      toast("The glass accepts more sand.");
      audio.drink();
    } else if (item.kind === "bile") {
      p.poison = 1.2;
      toast("The cracked seal was bile.");
      audio.hurt();
    }
    puff(p.x, p.y - 30, "#f0e2c0", 8, 40);
  }

  function blockedBetween(x0, x1, row) {
    const a = Math.floor(Math.min(x0, x1) / TILE);
    const b = Math.floor(Math.max(x0, x1) / TILE);
    for (const gate of room().gates || []) {
      if (gate.row !== row) continue;
      if ((s.gateAnim[gate.id] ?? 0) > 0.72) continue;
      if (gate.col >= a && gate.col <= b) return true;
    }
    return false;
  }

  function guardHere(g) {
    if (!g.alive || g.mode === "gone") return false;
    if (g.boss) return g.lag <= 0;
    if (g.phase === "both") return true;
    return g.phase === s.phase;
  }

  function standPhase(g) {
    return g.phase === "both" ? s.phase : g.phase;
  }

  function sees(g) {
    const p = s.player;
    if (!guardHere(g) || p.mode === "dead" || p.mode === "climb") return false;
    if (g.row !== p.row || Math.abs(g.y - p.y) > 30) return false;
    if (Math.abs(g.x - p.x) > 470) return false;
    if (blockedBetween(g.x, p.x, g.row)) return false;
    return true;
  }

  function inArc(att, def) {
    if (!def || att.row !== def.row) return false;
    if (Math.abs(att.y - def.y) > 32) return false;
    const dx = def.x - att.x;
    if (Math.abs(dx) <= 20) return Math.abs(dx) < 36;
    if (Math.sign(dx) !== att.facing) return false;
    return Math.abs(dx) < 118;
  }

  function updateGuard(g, dt) {
    if (!g.alive) {
      g.deathT += dt;
      return;
    }
    g.hurtT = Math.max(0, g.hurtT - dt);
    g.touchCd = Math.max(0, g.touchCd - dt);
    g.lag = Math.max(0, g.lag - dt);
    const phase = standPhase(g);
    if (!guardHere(g)) return;

    if (g.mode === "air") {
      g.vy += GRAV * dt;
      g.y += g.vy * dt;
      g.x += g.vx * dt;
      if (g.y > H + 30) {
        slayGuard(g, "pit");
        return;
      }
      const prev = g.y - g.vy * dt;
      for (let row = 2; row >= 0; row--) {
        const sy = surfaceY(row);
        if (g.vy >= 0 && prev <= sy + 2 && g.y >= sy && supported(g.x, row, phase)) {
          if (sy - (g.fallFrom ?? prev) > PITCH * 2.2) {
            slayGuard(g, "pit");
            return;
          }
          g.y = sy;
          g.vy = 0;
          g.mode = "ground";
          g.row = row;
          g.stagger = Math.max(g.stagger, 0.2);
          return;
        }
      }
      return;
    }

    g.y = surfaceY(g.row);
    if (g.stagger > 0) {
      g.stagger -= dt;
      g.x += g.vx * dt;
      g.vx *= Math.exp(-2.4 * dt);
      g.x = pushGates(g);
      if (!supported(g.x, g.row, phase)) {
        g.mode = "air";
        g.fallFrom = g.y;
        g.vy = 40;
      }
      return;
    }

    if (g.swing) {
      g.swing.t += dt;
      g.vx = 0;
      const sw = g.swing;
      const total = sw.wind + sw.active + sw.recover;
      if (sw.t >= total) g.swing = null;
      g.x = pushGates(g);
      return;
    }

    if (g.blocking > 0) {
      g.blocking -= dt;
      g.vx = 0;
      return;
    }

    const see = sees(g);
    if (see) g.alert = true;
    const p = s.player;
    if (g.alert && see && p.mode !== "hang") {
      const dx = p.x - g.x;
      g.facing = Math.sign(dx) || g.facing;
      const dist = Math.abs(dx);
      g.decision -= dt;
      const step = g.boss ? 92 : 70;
      if (dist > 76) {
        g.vx = g.facing * step;
        if (!supported(g.x + g.facing * 22, g.row, phase)) g.vx = 0;
      } else if (dist < 46) {
        g.vx = -g.facing * 48;
        if (!supported(g.x - g.facing * 22, g.row, phase)) g.vx = 0;
      } else {
        g.vx = 0;
        if (g.decision <= 0) {
          g.decision = (g.boss ? 0.45 : 0.75) + Math.random() * 0.45;
          const r = Math.random();
          if (r < (g.boss ? 0.62 : 0.5)) {
            g.swing = {
              t: 0,
              wind: g.boss ? 0.24 : g.slow ? 0.44 : 0.32,
              active: 0.1,
              recover: g.boss ? 0.28 : 0.36,
              hit: false,
            };
            audio.swing();
          } else if (r < 0.82) g.blocking = g.boss ? 0.38 : 0.5;
        }
      }
    } else {
      g.alert = see;
      const minX = g.min * TILE + 36;
      const maxX = (g.max + 1) * TILE - 36;
      if (g.vx === 0) g.vx = g.facing * 55;
      if (g.x < minX) {
        g.x = minX;
        g.facing = 1;
        g.vx = 55;
      } else if (g.x > maxX) {
        g.x = maxX;
        g.facing = -1;
        g.vx = -55;
      }
      if (!supported(g.x + g.facing * 26, g.row, phase)) {
        g.facing *= -1;
        g.vx = g.facing * 55;
      }
    }

    g.x += g.vx * dt;
    g.runPhase += Math.abs(g.vx) * dt * 0.02;
    g.x = pushGates(g);
    const minX = (g.min - 1) * TILE;
    const maxX = (g.max + 2) * TILE;
    if (g.alert && (g.x < minX || g.x > maxX) && supported(g.x, g.row, phase)) {
      /* chase within the room, still stop at real edges below */
    }
    if (!supported(g.x, g.row, phase)) {
      if (g.alert || g.hurtT > 0) {
        g.mode = "air";
        g.fallFrom = g.y;
        g.vy = 20;
      } else {
        g.x -= g.vx * dt;
        g.facing *= -1;
        g.vx = g.facing * 55;
      }
    }
  }

  function resolveCombat() {
    const p = s.player;
    if (p.mode === "dead" || s.demo) return;
    for (const g of s.guards) {
      if (!g.alive || !guardHere(g) || g.mode === "air") continue;
      const sw = g.swing;
      if (sw && !sw.hit && sw.t >= sw.wind && sw.t < sw.wind + sw.active && inArc(g, p)) {
        sw.hit = true;
        const parry = p.act?.type === "parry" && p.act.t < 0.2 && p.swordOut;
        if (parry && inArc(p, g)) {
          g.swing = null;
          g.stagger = 0.55;
          g.vx = Math.sign(g.x - p.x) * 80;
          audio.parry();
          s.shake = Math.max(s.shake, 4);
          puff((p.x + g.x) / 2, p.y - 62, "#f2e2b0", 7, 90, -10);
        } else if (p.iframe <= 0) {
          hurtPlayer(1, g.x, "hp", false);
        }
      }

      if (p.act?.type === "strike" && !p.act.hit) {
        const u = p.act.t;
        if (u >= 0.12 && u < 0.24 && inArc(p, g)) {
          p.act.hit = true;
          const facingYou = Math.sign(p.x - g.x) === g.facing || Math.abs(p.x - g.x) < 24;
          if (g.blocking > 0 && facingYou) {
            audio.parry();
            p.vx = Math.sign(p.x - g.x) * 160;
            p.act.t = Math.max(p.act.t, 0.24);
            puff((p.x + g.x) / 2, p.y - 60, "#d5deef", 6, 70, -10);
          } else {
            g.hp -= 1;
            g.hurtT = 0.28;
            g.stagger = 0.42;
            g.swing = null;
            g.blocking = 0;
            g.vx = Math.sign(g.x - p.x) || p.facing;
            g.vx *= g.boss ? 300 : 380;
            audio.hit();
            s.hitStop = s.reduce ? 0 : 0.04;
            s.shake = Math.max(s.shake, 5);
            puff(g.x - g.facing * 10, g.y - 58, "#f0d2a8", 8, 80);
            if (g.hp <= 0) slayGuard(g, "sword");
          }
        }
      }

      if (
        g.touchCd <= 0 &&
        g.stagger <= 0 &&
        p.iframe <= 0 &&
        g.row === p.row &&
        Math.abs(g.x - p.x) < 32 &&
        Math.abs(g.y - p.y) < 24 &&
        p.mode !== "climb"
      ) {
        g.touchCd = 0.85;
        hurtPlayer(1, g.x, "hp", false);
      }

      if (guardHere(g) && g.alive && g.row === p.row && Math.abs(p.y - g.y) < 24) {
        const dx = p.x - g.x;
        if (Math.abs(dx) < 34 && Math.abs(dx) > 0) {
          p.x += Math.sign(dx) * (34 - Math.abs(dx));
        }
      }
    }
  }

  function updateLoose(dt) {
    const p = s.player;
    if (p.mode !== "ground") return;
    const seen = new Set();
    for (const o of [-12, 0, 12]) {
      const c = Math.floor((p.x + o) / TILE);
      if (charAt(c, p.row) !== "~") continue;
      const key = `${p.row},${c}`;
      if (s.looseGone.has(key) || seen.has(key)) continue;
      seen.add(key);
      const t = (s.looseTimer.get(key) || 0) + dt;
      s.looseTimer.set(key, t);
      if (t > 0.52) {
        s.looseGone.add(key);
        audio.loose();
        s.shake = Math.max(s.shake, 4);
        puff((c + 0.5) * TILE, surfaceY(p.row) + 8, "#a68458", 8, 60);
      }
    }
  }

  function checkHazards() {
    const p = s.player;
    if (s.demo || p.mode === "dead" || p.mode === "hang" || p.mode === "climb") return;
    if (p.y > H + 20) {
      killPlayer("pit");
      return;
    }
    if (p.mode === "ground") {
      for (const o of [-8, 8]) {
        const c = Math.floor((p.x + o) / TILE);
        const ch = charAt(c, p.row);
        const st = spikeVisual(s.time, c, p.row, ch, s.phase);
        if (st?.up && floorAt(c, p.row, s.phase)) {
          killPlayer("spike");
          return;
        }
      }
    }
    for (const blade of room().blades || []) {
      const st = bladeVisual(s.time, blade.offset);
      if (!st.deadly || blade.row !== p.row) continue;
      const x0 = blade.col * TILE + 28;
      const x1 = (blade.col + 1) * TILE - 28;
      const nearFloor = Math.abs(p.y - surfaceY(blade.row)) < 36;
      if (nearFloor && p.x > x0 && p.x < x1) {
        audio.blade();
        killPlayer("blade");
        return;
      }
    }
  }

  function updateGates(dt) {
    const rm = room();
    for (const plate of rm.plates || []) {
      if (plate.latch && plateDown(plate)) s.latched.add(plate.id);
    }
    for (const gate of rm.gates || []) {
      const plates = (rm.plates || []).filter((p) => p.id === gate.id);
      const want = plates.some((p) => (p.latch ? s.latched.has(p.id) : plateDown(p)));
      const cur = s.gateAnim[gate.id] ?? 0;
      const next = Math.max(0, Math.min(1, cur + (want ? 1 : -1) * dt * 1.7));
      if (cur < 0.4 && next >= 0.4) audio.gate();
      if (cur > 0.6 && next <= 0.6 && !want) audio.gate();
      s.gateAnim[gate.id] = next;
    }
  }

  function plateDown(plate) {
    const p = s.player;
    if (
      p.mode === "ground" &&
      p.row === plate.row &&
      Math.floor(p.x / TILE) === plate.col &&
      p.mode !== "dead"
    ) {
      return true;
    }
    if (s.echo && s.echo.row === plate.row && Math.floor(s.echo.x / TILE) === plate.col) return true;
    return false;
  }

  function checkExits() {
    const p = s.player;
    if (s.entryLock > 0 || p.mode === "dead" || p.mode === "climb" || p.mode === "hang") return;
    const rm = room();
    if (p.mode !== "ground" && p.mode !== "air") return;
    if (p.x < 26 && rm.left) startTransition("left");
    else if (p.x > W - 26 && rm.right) startTransition("right");
  }

  function startTransition(dir) {
    const dest = room()[dir];
    if (!dest || !rooms[dest] || s.transition) return;
    s.hintsDone.add(s.roomId);
    s.transition = {
      dir,
      t: 0,
      dur: s.reduce ? 0.01 : 0.42,
      from: s.roomId,
      to: dest,
      row: s.player.row,
      x: s.player.x,
      phase: s.phase,
    };
  }

  function finishTransition() {
    const tr = s.transition;
    s.transition = null;
    let x = s.player.x;
    let row = tr.row;
    if (tr.dir === "right") x = 84;
    else if (tr.dir === "left") x = W - 84;
    else if (tr.dir === "up") row = 0;
    else if (tr.dir === "down") row = 2;
    s.phase = tr.phase;
    enterRoom(tr.to, { x, row });
  }

  function sash(dt) {
    const p = s.player;
    let ax = p.x - p.facing * 8;
    let ay = p.y - 46;
    const k = 1 - Math.exp(-7 * dt);
    for (const pt of p.sash) {
      pt.x += (ax - pt.x) * k;
      pt.y += (ay - pt.y) * k;
      ax = pt.x - p.facing * 8;
      ay = pt.y + 2;
    }
  }

  function updatePlayer(dt, input) {
    const p = s.player;
    p.iframe = Math.max(0, p.iframe - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.grabLock = Math.max(0, p.grabLock - dt);
    p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    p.upBuf = Math.max(0, p.upBuf - dt);
    if (input.jumpEdge) p.jumpBuf = 0.12;
    if (input.upEdge) p.upBuf = 0.12;

    if (p.poison > 0) {
      p.poison -= dt;
      if (p.poison <= 0) hurtPlayer(2, p.x, "bile", true);
    }

    if (p.act) {
      p.act.t += dt;
      if (p.act.t >= p.act.dur) {
        if (p.act.type === "drink" && p.act.item) applyItem(p.act.item);
        p.act = null;
      }
    }

    if (s.hasSword) {
      const threat = s.guards.some(
        (g) => g.alive && guardHere(g) && sees(g) && Math.abs(g.x - p.x) < 300,
      );
      if (threat) p.swordOut = true;
    }

    if (input.sheath && p.swordOut && !p.act) {
      const near = s.guards.some(
        (g) => g.alive && guardHere(g) && g.row === p.row && Math.abs(g.x - p.x) < 200,
      );
      if (!near) p.swordOut = false;
    }

    const busy = p.act && (p.act.type === "drink" || p.act.type === "strike" || p.act.type === "parry");
    if (input.strike && s.hasSword && p.mode !== "climb" && p.mode !== "hang" && (!p.act || p.act.type === "parry")) {
      p.swordOut = true;
      p.act = { type: "strike", t: 0, dur: 0.4, hit: false };
      audio.swing();
    } else if (input.strike && !s.hasSword) {
      toast("The sword is still in the gallery.");
    }
    if (input.parry && s.hasSword && p.mode !== "climb" && (!p.act || p.act.t > 0.24)) {
      p.swordOut = true;
      p.act = { type: "parry", t: 0, dur: 0.36 };
    }
    if (input.phaseEdge) tryShift();

    if (s.shiftHang > 0) {
      s.shiftHang -= dt;
      p.vx = 0;
      if (s.shiftHang <= 0 && p.pendingFall && p.mode === "ground") {
        p.mode = "air";
        p.vy = 40;
        p.fallFrom = p.y;
        p.pendingFall = false;
      }
      sash(dt);
      return;
    }

    if (p.mode === "climb" && p.climb) {
      p.climb.t += dt;
      const u = Math.min(1, p.climb.t / p.climb.dur);
      const e = u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
      p.x = p.climb.fromX + (p.climb.toX - p.climb.fromX) * e;
      p.y = p.climb.fromY + (p.climb.toY - p.climb.fromY) * e;
      if (u >= 1) {
        p.mode = "ground";
        p.row = p.climb.toRow;
        p.x = p.climb.toX;
        p.y = p.climb.toY;
        p.fallFrom = p.y;
        p.vx = 0;
        p.climb = null;
      }
      sash(dt);
      return;
    }

    if (p.mode === "hang") {
      p.vx = 0;
      p.vy = 0;
      if (input.up || p.upBuf > 0) {
        p.upBuf = 0;
        startClimb();
      } else if (input.downEdge) dropHang(false);
      else if (p.jumpBuf > 0) {
        p.jumpBuf = 0;
        dropHang(true);
      }
      sash(dt);
      return;
    }

    if (p.mode === "ground") {
      if (p.upBuf > 0 && !busy) {
        const rm = room();
        const col = Math.floor(p.x / TILE);
        if (rm.laleh && Math.abs(p.x - (rm.laleh.col + 0.5) * TILE) < 78 && p.row === rm.laleh.row) {
          p.upBuf = 0;
          win();
          return;
        }
        if (rm.up && p.row === 2 && rm.upCols?.includes(col)) {
          p.upBuf = 0;
          startTransition("up");
          return;
        }
      }
      if (input.downEdge && !busy) {
        const rm = room();
        const col = Math.floor(p.x / TILE);
        if (rm.down && p.row === 0 && rm.downCols?.includes(col)) {
          startTransition("down");
          return;
        }
        const item = itemUnder();
        if (item) {
          p.act = { type: "drink", t: 0, dur: item.kind === "sword" ? 0.35 : 0.5, item };
          p.vx = 0;
        }
      }

      const speed = p.swordOut ? 158 : RUN;
      if (!busy) {
        if (input.left && !input.right) {
          p.vx -= 1900 * dt;
          p.facing = -1;
        } else if (input.right && !input.left) {
          p.vx += 1900 * dt;
          p.facing = 1;
        } else p.vx *= Math.max(0, 1 - 12 * dt);
        p.vx = Math.max(-speed, Math.min(speed, p.vx));
      } else p.vx *= Math.max(0, 1 - 8 * dt);

      p.x += p.vx * dt;
      p.x = pushGates(p);
      if (!room().left && p.x < 34) p.x = 34;
      if (!room().right && p.x > W - 34) p.x = W - 34;

      if (!supported(p.x, p.row, s.phase)) {
        p.mode = "air";
        p.fallFrom = p.y;
        p.vy = 0;
        p.coyote = 0.1;
      } else {
        p.y = surfaceY(p.row);
        p.coyote = 0.1;
        if ((p.jumpBuf > 0 || p.upBuf > 0) && !busy) {
          doJump(!!input.up || (p.upBuf > 0 && p.jumpBuf <= 0));
        }
      }

      if (Math.abs(p.vx) > 80 && p.mode === "ground") {
        p.runPhase += dt * (Math.abs(p.vx) / RUN) * 1.35;
        p.stepDist += Math.abs(p.vx) * dt;
        if (p.stepDist > 46) {
          p.stepDist = 0;
          audio.step();
          if (Math.random() < 0.7) puff(p.x, p.y, s.phase === "day" ? "#d9c29a" : "#8e9bb4", 1, 20);
        }
      }
    } else if (p.mode === "air") {
      if (input.left) p.facing = -1;
      if (input.right) p.facing = 1;
      if (p.magnet) {
        if ((input.left && p.facing === 1) || (input.right && p.facing === -1)) p.magnet = null;
      }
      if (p.magnet) {
        const target = p.magnet.lipX - p.facing * 18;
        const dx = target - p.x;
        p.vx += Math.max(-1, Math.min(1, dx / 36)) * 640 * dt;
      } else {
        if (input.left && !input.right) p.vx -= 820 * dt;
        else if (input.right && !input.left) p.vx += 820 * dt;
      }
      p.vx = Math.max(-AIR_VX, Math.min(AIR_VX, p.vx));
      p.vy += GRAV * dt;
      if (p.vy > 920) p.vy = 920;
      const prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = pushGates(p);
      if (!room().left && p.x < 34) p.x = 34;
      if (!room().right && p.x > W - 34) p.x = W - 34;
      bonk(prevY);
      if (!land(prevY)) tryGrab();
      if ((p.jumpBuf > 0 || p.upBuf > 0) && p.coyote > 0 && !busy) {
        doJump(!!input.up || (p.upBuf > 0 && p.jumpBuf <= 0));
      }
      p.coyote = Math.max(0, p.coyote - dt);
    }

    sash(dt);
  }

  function win() {
    if (s.screen === "ending") return;
    const left = Math.max(0, s.sand);
    let best = 0;
    try {
      best = Number(localStorage.getItem("hoursplit-best") || 0);
      if (left > best) localStorage.setItem("hoursplit-best", String(Math.floor(left)));
    } catch {
      /* private mode */
    }
    s.endingSand = left;
    s.newBest = left > best;
    s.screen = "ending";
    audio.win();
  }

  function updateParticles(dt) {
    for (const p of s.particles) {
      p.life -= dt;
      p.vy += (p.grav ?? 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    s.particles = s.particles.filter((p) => p.life > 0);
    for (const t of s.toasts) t.life -= dt;
    s.toasts = s.toasts.filter((t) => t.life > 0);
    s.bannerT = Math.max(0, s.bannerT - dt);
    s.shake = Math.max(0, s.shake - dt * 18);
    s.shiftFlash = Math.max(0, s.shiftFlash - dt);
    s.hurtFlash = Math.max(0, s.hurtFlash - dt);
    s.shiftLock = Math.max(0, s.shiftLock - dt);
    s.entryLock = Math.max(0, s.entryLock - dt);
  }

  function updateAttract(dt) {
    s.time += dt;
    s.attractT += dt;
    const target = s.phase === "night" ? 1 : 0;
    s.phaseBlend += (target - s.phaseBlend) * Math.min(1, dt * 2.4);
    if (s.attractT > 3.8) {
      s.attractT = 0;
      s.shiftLock = 0;
      tryShift();
    }
    s.player.y = surfaceY(0);
    s.player.mode = "ground";
    s.player.runPhase += dt * 0.15;
    sash(dt);
    updateParticles(dt);
    if (Math.random() < 0.4) {
      puff(80 + Math.random() * 800, 40 + Math.random() * 80, s.phase === "day" ? "#e6b34a" : "#d5deef", 1, 12, 10);
    }
  }

  function update(dt, input) {
    dt = Math.min(0.034, Math.max(0, dt));
    if (input.muteEdge) s.muted = audio.toggle();
    if (s.screen === "title" || s.screen === "story") {
      updateAttract(dt);
      audio.tick(false);
      return;
    }
    if (s.screen !== "play") return;
    if (input.pauseEdge) {
      s.screen = "pause";
      return;
    }

    if (s.transition) {
      s.transition.t += dt;
      s.sand = Math.max(0, s.sand - dt);
      updateParticles(dt);
      if (s.transition.t >= s.transition.dur) finishTransition();
      audio.tick(false);
      return;
    }

    if (s.hitStop > 0) {
      s.hitStop -= dt;
      updateParticles(dt);
      return;
    }

    if (s.player.mode === "dead") {
      s.player.deathT += dt;
      updateParticles(dt);
      if (s.player.deathT > 1.05) {
        s.screen = s.player.reason === "time" || s.sand <= 0 ? "over" : "fail";
        if (s.screen === "over") s.failText = FAIL.time;
      }
      return;
    }

    const prevSand = s.sand;
    s.sand = Math.max(0, s.sand - dt);
    s.time += dt;
    if (s.sand <= 0) {
      s.sand = 0;
      killPlayer("time");
    } else if (s.sand < 28 && Math.floor(prevSand) !== Math.floor(s.sand)) {
      audio.tickSand();
    }

    updatePlayer(dt, input);
    if (s.screen !== "play" || s.transition) {
      updateParticles(dt);
      audio.tick(false);
      return;
    }
    for (const g of s.guards) updateGuard(g, dt);
    resolveCombat();
    updateLoose(dt);
    if (s.player.mode === "ground" && !supported(s.player.x, s.player.row, s.phase)) {
      s.player.mode = "air";
      s.player.vy = Math.max(s.player.vy, 40);
      s.player.fallFrom = s.player.y;
    }
    updateGates(dt);
    checkHazards();
    checkExits();

    const rm = room();
    if (rm.bridge) {
      const want = s.dead.has(rm.bridge.guard) ? 1 : 0;
      if (s.bridgeT < 1 && want === 1 && Math.random() < 0.5) {
        const c = rm.bridge.cols[(Math.random() * rm.bridge.cols.length) | 0];
        puff((c + 0.5) * TILE, surfaceY(rm.bridge.row) + 10, "#d7b07a", 2, 40);
      }
      s.bridgeT += (want - s.bridgeT) * Math.min(1, dt * 1.6);
    }

    const target = s.phase === "night" ? 1 : 0;
    s.phaseBlend += (target - s.phaseBlend) * Math.min(1, dt * 3);
    updateParticles(dt);
    const alert = s.guards.some((g) => g.alive && g.alert && guardHere(g));
    audio.tick(alert);
  }

  function audit() {
    const problems = [];
    for (const [id, rm] of Object.entries(rooms)) {
      for (const dir of ["left", "right", "up", "down"]) {
        if (rm[dir] && !rooms[rm[dir]]) problems.push(`${id} ${dir}`);
      }
      for (const line of rm.grid) {
        if (line.length !== 10) problems.push(`${id} width`);
      }
      for (const item of rm.items || []) {
        const ch = rm.grid[item.row][item.col];
        if (ch === ".") problems.push(`${id} item ${item.id} on pit`);
      }
    }
    return problems;
  }

  function tp(id) {
    if (!rooms[id]) return;
    s.demo = false;
    s.screen = "play";
    s.hasSword = true;
    s.sand = 540;
    s.phase = "day";
    s.player.hp = 5;
    s.player.maxHp = 5;
    s.player.swordOut = true;
    enterRoom(id, { x: 140, row: 0 });
  }

  setupAttract();

  s.update = update;
  s.beginRun = beginRun;
  s.retry = retry;
  s.toTitle = () => {
    setupAttract();
    s.screen = "title";
  };
  s.audit = audit;
  s.tp = tp;
  s.floorAt = floorAt;
  s.tryShift = tryShift;
  s.plateDown = plateDown;
  s.guardHere = guardHere;
  s.charAt = charAt;
  s.W = W;
  s.H = H;
  return s;
}
