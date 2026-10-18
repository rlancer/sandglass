import { DT, SCREEN_W, SCREEN_H, VIEW_H, TIME_LIMIT } from "./config.js";
import { input } from "./input.js";
import { initAudio, playMusic, stopMusic, toggleMute, sfx } from "./audio.js";
import { Renderer } from "./render.js";
import { Game } from "./game.js";
import { LEVELS } from "./levels.js";
import { drawFigure, samplePose, STYLES } from "./skeleton.js";

const SAVE_KEY = "pop-mirror-of-shadows";
const DEBUG = new URLSearchParams(location.search).has("debug");

const art = {};
async function loadArt() {
  let manifest = {};
  try {
    manifest = await (await fetch("/art/manifest.json")).json();
  } catch {}
  await Promise.all(
    Object.entries(manifest).map(
      ([name, ext]) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            art[name] = img;
            res();
          };
          img.onerror = res;
          img.src = `/art/${name}.${ext}`;
        }),
    ),
  );
}

const canvas = document.getElementById("game");
let R;
let scene = "loading";
let sceneT = 0;
let game = null;
let levelIdx = 0;
let carryAtStart = null;
let timeLeft = TIME_LIMIT;
let paused = false;
let storyPage = 0;
let debugGrid = false;
let muted = false;

const STORY = [
  { art: "title", text: "Persia, in the year 1189.\nWhile the Sultan is away at war, his Grand Vizier, Jaffar, seizes the palace." },
  { art: "mirrors", text: "He shatters the Mirror of Ahura, the glass that holds the hours of the world, and drinks the time within.\nThe princess must wed him within the hour, or die." },
  { art: "dungeon", text: "You, the wanderer who dared to love her, are cast into the dungeons.\nBut a mirror never forgets. Its shards remember every step you take...\nand your shadow can walk them again." },
];

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ level: levelIdx, timeLeft, carry: carryAtStart }));
}
function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

function setScene(s) {
  scene = s;
  sceneT = 0;
}

function startLevel(i, carry) {
  levelIdx = i;
  carryAtStart = carry;
  save();
  setScene("intro");
  playMusic("title");
}

function beginPlay() {
  game = new Game(LEVELS[levelIdx], carryAtStart, {
    levelComplete: (carry) => {
      setTimeout(() => {
        if (levelIdx + 1 < LEVELS.length) startLevel(levelIdx + 1, carry);
        else setScene("victory");
      }, 900);
      fadeOut = 0.9;
    },
    victory: () => {
      localStorage.removeItem(SAVE_KEY);
      setScene("victory");
      playMusic("title");
    },
  });
  setScene("play");
  playMusic("game");
}
let fadeOut = 0;

// ---------- drawing helpers ----------
function cover(ctx, img, alpha = 1, zoom = 1) {
  if (!img) return;
  const s = Math.max(SCREEN_W / img.width, SCREEN_H / img.height) * zoom;
  const w = img.width * s, h = img.height * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (SCREEN_W - w) / 2, (SCREEN_H - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

function text(ctx, str, x, y, { size = 12, color = "#f0e0b8", weight = 600, align = "center", font = "'Cinzel', Georgia, serif", shadow = true, alpha = 1, spacing = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (spacing) ctx.letterSpacing = `${spacing}px`;
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillText(str, x + 1, y + 1.5);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function wrap(ctx, str, maxW, size) {
  ctx.font = `400 ${size}px 'Cinzel', Georgia, serif`;
  const out = [];
  for (const para of str.split("\n")) {
    let line = "";
    for (const w of para.split(" ")) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

const sand = Array.from({ length: 70 }, () => ({ x: Math.random() * SCREEN_W, y: Math.random() * SCREEN_H, v: 4 + Math.random() * 14, s: Math.random() * 1.5 + 0.3 }));
function drawSand(ctx, dt) {
  ctx.globalCompositeOperation = "lighter";
  for (const p of sand) {
    p.x += p.v * dt;
    p.y += Math.sin(p.x * 0.02) * 0.1;
    if (p.x > SCREEN_W) p.x = 0;
    ctx.fillStyle = `rgba(255,200,120,${0.25 + p.s * 0.2})`;
    ctx.fillRect(p.x, p.y, p.s, p.s);
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawTitle(ctx, t, dt) {
  cover(ctx, art.title, 1, 1.04 + Math.sin(t * 0.1) * 0.02);
  const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
  g.addColorStop(0, "rgba(0,0,10,0.75)");
  g.addColorStop(0.35, "rgba(0,0,10,0.1)");
  g.addColorStop(0.7, "rgba(0,0,0,0.3)");
  g.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  drawSand(ctx, dt);
  text(ctx, "PRINCE OF PERSIA", SCREEN_W / 2, 52, { size: 40, weight: 800, color: "#f6d77a", spacing: 4 });
  text(ctx, "THE MIRROR OF SHADOWS", SCREEN_W / 2, 88, { size: 15, weight: 600, color: "#9fe8ff", spacing: 6 });

  // a shadow runs ahead of the prince along the bottom
  const runX = ((t * 120) % (SCREEN_W + 200)) - 100;
  const pose = samplePose("run", t * 2.3);
  drawFigure(ctx, runX, SCREEN_H - 58, 1, pose, STYLES.prince, {});
  const pose2 = samplePose("run", (t - 0.6) * 2.3);
  drawFigure(ctx, runX - 70, SCREEN_H - 58, 1, pose2, STYLES.prince, { silhouette: true, alpha: 0.7 });
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, SCREEN_H - 58, SCREEN_W, 1);

  const sv = loadSave();
  const blink = Math.floor(t * 2) % 2 === 0;
  text(ctx, "PRESS ENTER TO BEGIN", SCREEN_W / 2, SCREEN_H - 34, { size: 12, alpha: blink ? 1 : 0.35 });
  if (sv) text(ctx, `C  —  continue from level ${sv.level + 1} (${Math.ceil(sv.timeLeft / 60)} min left)`, SCREEN_W / 2, SCREEN_H - 18, { size: 9, color: "#c8b890" });
  text(ctx, "ARROWS move · UP jump/climb · SHIFT careful step / grab · DOWN crouch, take · SPACE strike · E shadow echo · M mute", SCREEN_W / 2, SCREEN_H - 6, { size: 7, color: "#8a7a5a", weight: 400 });
}

function drawStory(ctx, t, dt) {
  const page = STORY[storyPage];
  cover(ctx, art[page.art], Math.min(1, sceneT) * 0.55, 1.08 + sceneT * 0.008);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  drawSand(ctx, dt);
  const lines = wrap(ctx, page.text, 480, 14);
  const chars = Math.floor(sceneT * 45);
  let used = 0;
  lines.forEach((ln, i) => {
    const vis = ln.slice(0, Math.max(0, chars - used));
    used += ln.length;
    text(ctx, vis, SCREEN_W / 2, SCREEN_H / 2 - (lines.length * 22) / 2 + i * 22, { size: 14, weight: 400 });
  });
  text(ctx, "ENTER", SCREEN_W - 40, SCREEN_H - 16, { size: 9, color: "#8a7a5a", alpha: 0.5 + Math.sin(t * 4) * 0.3 });
}

function drawIntro(ctx, t, dt) {
  const L = LEVELS[levelIdx];
  cover(ctx, art[L.art], Math.min(1, sceneT * 1.5) * 0.85, 1.02 + sceneT * 0.01);
  const g = ctx.createLinearGradient(0, SCREEN_H * 0.4, 0, SCREEN_H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.95)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  drawSand(ctx, dt);
  const a = Math.min(1, sceneT * 2);
  text(ctx, `LEVEL ${levelIdx + 1}`, SCREEN_W / 2, SCREEN_H - 120, { size: 12, color: "#c8a85a", alpha: a, spacing: 6 });
  text(ctx, L.name.toUpperCase(), SCREEN_W / 2, SCREEN_H - 95, { size: 28, weight: 800, color: "#f6d77a", alpha: a, spacing: 3 });
  L.intro.split("\n").forEach((ln, i) => text(ctx, ln, SCREEN_W / 2, SCREEN_H - 62 + i * 16, { size: 11, weight: 400, alpha: Math.min(1, Math.max(0, sceneT - 0.6) * 2) }));
  text(ctx, `${Math.ceil(timeLeft / 60)} MINUTES LEFT`, SCREEN_W / 2, SCREEN_H - 18, { size: 9, color: "#ff9060", alpha: Math.min(1, Math.max(0, sceneT - 1.2)) });
}

function drawVictory(ctx, t, dt) {
  cover(ctx, art.victory, Math.min(1, sceneT * 0.6), 1.05 - Math.min(0.05, sceneT * 0.004));
  const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
  g.addColorStop(0, "rgba(0,0,0,0.7)");
  g.addColorStop(0.3, "rgba(0,0,0,0)");
  g.addColorStop(0.75, "rgba(0,0,0,0.2)");
  g.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  drawSand(ctx, dt);
  const a = Math.min(1, Math.max(0, sceneT - 1));
  text(ctx, "THE HOUR IS RESTORED", SCREEN_W / 2, 44, { size: 26, weight: 800, color: "#f6d77a", alpha: a, spacing: 3 });
  const used = TIME_LIMIT - timeLeft;
  text(ctx, `The mirror is mended in ${Math.floor(used / 60)}m ${Math.floor(used % 60)}s.`, SCREEN_W / 2, SCREEN_H - 40, { size: 12, alpha: a });
  text(ctx, "Your shadow bows, and returns to where shadows belong.", SCREEN_W / 2, SCREEN_H - 22, { size: 10, weight: 400, color: "#9fe8ff", alpha: a });
}

function drawGameOver(ctx, t) {
  cover(ctx, art.tower, 0.35);
  ctx.fillStyle = "rgba(20,0,0,0.5)";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  text(ctx, "THE HOUR HAS PASSED", SCREEN_W / 2, SCREEN_H / 2 - 20, { size: 26, weight: 800, color: "#ff7050", alpha: Math.min(1, sceneT) });
  text(ctx, "Jaffar weds the princess at dawn. The mirror stays broken.", SCREEN_W / 2, SCREEN_H / 2 + 14, { size: 11, weight: 400, alpha: Math.min(1, sceneT) });
  text(ctx, "ENTER", SCREEN_W / 2, SCREEN_H - 30, { size: 10, color: "#8a7a5a", alpha: Math.min(1, sceneT - 1) });
}

// ---------- main loop ----------
let last = performance.now();
let acc = 0;
let gameClock = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  sceneT += dt;
  input.poll();
  if (input.any()) initAudio();
  const ctx = R.ctx;
  R.begin();

  if (input.pressed("mute")) muted = toggleMute();
  let stepped = false;

  switch (scene) {
    case "title":
      playMusic("title");
      drawTitle(ctx, now / 1000, dt);
      if (input.pressed("start")) {
        initAudio();
        timeLeft = TIME_LIMIT;
        storyPage = 0;
        setScene("story");
        sfx.pickup();
      } else if (keyC) {
        const sv = loadSave();
        if (sv) {
          timeLeft = sv.timeLeft;
          startLevel(sv.level, sv.carry);
        }
      }
      break;
    case "story":
      drawStory(ctx, now / 1000, dt);
      if (input.pressed("start") || input.pressed("strike")) {
        if (sceneT < STORY[storyPage].text.length / 45) sceneT = 99;
        else if (++storyPage >= STORY.length) startLevel(0, null);
        else setScene("story");
      }
      break;
    case "intro":
      drawIntro(ctx, now / 1000, dt);
      if ((input.pressed("start") || input.pressed("strike")) && sceneT > 0.4) beginPlay();
      else if (sceneT > 6) beginPlay();
      break;
    case "play": {
      // read menu keys before the simulation steps consume this frame's presses
      const startP = input.pressed("start");
      const restartP = input.pressed("restart");
      if (input.pressed("pause")) paused = !paused;
      if (DEBUG && input.pressed("debugGrid")) debugGrid = !debugGrid;
      if (DEBUG && input.pressed("debugGod")) game.player.god = !game.player.god;
      if (DEBUG && input.pressed("debugNext")) {
        game.levelComplete();
      }
      if (!paused) {
        acc += dt;
        while (acc >= DT) {
          game.update(DT, input);
          if (!stepped) input.endFrame();
          stepped = true;
          acc -= DT;
          if (game.player.alive && !game.done) timeLeft -= DT;
        }
        gameClock += dt;
      }
      R.drawGame(game, gameClock, debugGrid);
      R.drawHUD(game, gameClock, Math.max(0, timeLeft));
      const p = game.player;
      if (!p.alive && p.deadT > 1.4) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(0.5, (p.deadT - 1.4) * 0.6)})`;
        ctx.fillRect(0, 0, SCREEN_W, VIEW_H);
        text(ctx, `Slain by ${p.deathCause}.`, SCREEN_W / 2, VIEW_H / 2 - 12, { size: 16, color: "#ff8a70" });
        text(ctx, "Press ENTER to try again", SCREEN_W / 2, VIEW_H / 2 + 14, { size: 11, alpha: 0.6 + Math.sin(now / 200) * 0.4 });
        if (startP || restartP) beginPlay();
      } else if (restartP && p.alive && !game.done) {
        beginPlay();
      }
      if (paused) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, SCREEN_W, VIEW_H);
        text(ctx, "PAUSED", SCREEN_W / 2, VIEW_H / 2 - 10, { size: 24, weight: 800, color: "#f6d77a" });
        text(ctx, "ESC to resume · R restart level · M mute", SCREEN_W / 2, VIEW_H / 2 + 18, { size: 10, weight: 400 });
      }
      if (timeLeft <= 0) {
        stopMusic();
        localStorage.removeItem(SAVE_KEY);
        setScene("gameover");
      }
      if (fadeOut > 0) {
        fadeOut -= dt;
        ctx.fillStyle = `rgba(0,0,0,${1 - Math.max(0, fadeOut) / 0.9})`;
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      }
      break;
    }
    case "victory":
      drawVictory(ctx, now / 1000, dt);
      if (input.pressed("start") && sceneT > 2) setScene("title");
      break;
    case "gameover":
      drawGameOver(ctx, now / 1000);
      if (input.pressed("start") && sceneT > 1) setScene("title");
      break;
    case "loading":
      text(ctx, "Polishing the mirror...", SCREEN_W / 2, SCREEN_H / 2, { size: 12, color: "#8a7a5a" });
      break;
  }
  if (muted) text(ctx, "MUTED", SCREEN_W - 24, 10, { size: 8, color: "#888" });
  if (scene !== "play" || stepped) input.endFrame();
  keyC = false;
  requestAnimationFrame(frame);
}

let keyC = false;
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyC") keyC = true;
});

R = new Renderer(canvas, art);
requestAnimationFrame(frame);
loadArt().then(() => {
  R.cache.clear();
  if (DEBUG && new URLSearchParams(location.search).get("level")) {
    const lv = Number(new URLSearchParams(location.search).get("level")) - 1;
    timeLeft = TIME_LIMIT;
    levelIdx = lv;
    carryAtStart = { maxHp: 3, armed: lv > 0, hasShard: lv > 1 };
    beginPlay();
  } else setScene("title");
});

if (DEBUG) {
  // Deterministic stepping for automated play-tests: sim(seconds, heldActions, pressedActions)
  const sim = (secs, held = [], pressed = []) => {
    let first = true;
    const fake = { held: (a) => held.includes(a), pressed: (a) => first && pressed.includes(a) };
    for (let i = 0; i < Math.round(secs / DT); i++) {
      game.update(DT, fake);
      first = false;
    }
    const p = game.player;
    return `${p.state} x=${p.x.toFixed(0)} y=${p.y.toFixed(0)} c=${Math.floor(p.x / 64)} r=${Math.floor((p.y - 1) / 128)} hp=${p.hp} alive=${p.alive} armed=${p.armed} shard=${p.hasShard}`;
  };
  const teleport = (c, r) => {
    const p = game.player;
    p.x = c * 64 + 32;
    p.y = (r + 1) * 128 - 12;
    p.vx = p.vy = 0;
    p.setState("stand");
    return sim(0.05);
  };
  window.__pop = { get game() { return game; }, LEVELS, beginPlay, input, sim, teleport, load: (i, carry) => { levelIdx = i; carryAtStart = carry; beginPlay(); } };
}
