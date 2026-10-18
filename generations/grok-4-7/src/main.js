import { createGame } from "./game.js";
import { createAudio } from "./audio.js";
import { paint } from "./draw.js";
import { fmtTime } from "./levels.js";

const BASE = import.meta.env.BASE_URL;
const asset = (path) => `${BASE}${path.replace(/^\//, "")}`;

const STORY = [
  {
    kicker: "Vizier Shahin",
    img: asset("art/shahin.png"),
    alt: "Shahin, an older vizier in a black cap and robe, holding a cracked hourglass.",
    copy: "Shahin split the palace clock. Day and night now stand in the same halls, and only one of them will hold you.",
  },
  {
    kicker: "Laleh",
    img: asset("art/laleh.png"),
    alt: "Laleh, a young woman in a lapis gown with a gold sunburst at her throat.",
    copy: "She waits in the solar tower. The sand in your glass is the last span the two hours will share.",
  },
];

const frame = document.getElementById("frame");
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const veil = document.getElementById("veil");
const audio = createAudio();
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const game = createGame(audio);
game.reduce = reduce;

const assets = { day: null, night: null, prince: null, laleh: null, shahin: null, ending: null };

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

Promise.all([
  loadImage(asset("art/bg-day.png")),
  loadImage(asset("art/bg-night.png")),
  loadImage(asset("art/ending.png")),
]).then(([day, night, ending]) => {
  assets.day = day;
  assets.night = night;
  assets.ending = ending;
  const endingEl = document.getElementById("ending");
  if (ending) {
    endingEl.style.backgroundImage = `linear-gradient(transparent, rgba(8,6,4,0.2) 40%, rgba(8,6,4,0.88)), url('${asset("art/ending.png")}')`;
  }
});

const holds = new Set();
const edges = new Set();

function pull() {
  const tap = (name) => edges.has(name);
  const input = {
    left: holds.has("left"),
    right: holds.has("right"),
    up: holds.has("up"),
    down: holds.has("down"),
    jumpEdge: tap("jump"),
    upEdge: tap("up"),
    downEdge: tap("down"),
    strike: tap("strike"),
    parry: tap("parry"),
    sheath: tap("sheath"),
    phaseEdge: tap("phase"),
    pauseEdge: tap("pause"),
    muteEdge: tap("mute"),
  };
  edges.clear();
  return input;
}

const KEY = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  Space: "jump",
  KeyX: "strike",
  KeyJ: "strike",
  KeyZ: "parry",
  KeyK: "parry",
  KeyC: "sheath",
  KeyF: "phase",
  KeyQ: "phase",
  KeyM: "mute",
  Escape: "pause",
};

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const screen = game.screen;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
    e.preventDefault();
  }
  if ((e.code === "Enter" || e.code === "Space") && screen !== "play") {
    e.preventDefault();
    confirm();
    return;
  }
  const name = KEY[e.code];
  if (!name) return;
  holds.add(name);
  edges.add(name);
  audio.unlock();
});

window.addEventListener("keyup", (e) => {
  const name = KEY[e.code];
  if (name) holds.delete(name);
});

window.addEventListener("blur", () => holds.clear());

for (const btn of document.querySelectorAll(".pad button")) {
  const hold = btn.dataset.hold;
  const tap = btn.dataset.tap;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    audio.unlock();
    if (hold) holds.add(hold);
    if (tap) edges.add(tap);
    if (hold === "down") edges.add("down");
  });
  const release = () => {
    if (hold) holds.delete(hold);
  };
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointerleave", release);
  btn.addEventListener("pointercancel", release);
}

function confirm() {
  audio.unlock();
  const screen = game.screen;
  if (screen === "title") openStory();
  else if (screen === "story") nextStory();
  else if (screen === "pause") game.screen = "play";
  else if (screen === "fail") game.retry();
  else if (screen === "over") game.beginRun();
  else if (screen === "ending") game.toTitle();
}

function openStory() {
  game.storyStep = 0;
  game.screen = "story";
  fillStory();
}

function fillStory() {
  const step = STORY[game.storyStep];
  document.getElementById("story-kicker").textContent = step.kicker;
  document.getElementById("story-copy").textContent = step.copy;
  const img = document.getElementById("story-img");
  img.src = step.img;
  img.alt = step.alt;
  document.getElementById("story-next").textContent =
    game.storyStep === STORY.length - 1 ? "Enter the cell" : "Continue";
}

function nextStory() {
  if (game.storyStep < STORY.length - 1) {
    game.storyStep += 1;
    fillStory();
    return;
  }
  game.beginRun();
}

document.getElementById("start").addEventListener("click", () => {
  audio.unlock();
  openStory();
});
document.getElementById("story-next").addEventListener("click", () => {
  audio.unlock();
  nextStory();
});
document.getElementById("resume").addEventListener("click", () => {
  game.screen = "play";
  frame.focus();
});
document.getElementById("leave").addEventListener("click", () => game.toTitle());
document.getElementById("retry").addEventListener("click", () => {
  audio.unlock();
  if (game.screen === "over") game.beginRun();
  else game.retry();
});
document.getElementById("abandon").addEventListener("click", () => game.toTitle());
document.getElementById("again").addEventListener("click", () => game.toTitle());

canvas.addEventListener("pointerdown", (e) => {
  audio.unlock();
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 960;
  const y = ((e.clientY - r.top) / r.height) * 540;
  if (game.screen === "play" && x > 860 && y < 72) game.tryShift();
  frame.focus();
});

function sync() {
  const screen = game.screen;
  for (const el of document.querySelectorAll("[data-screen]")) {
    const names = el.dataset.screen.split(" ");
    el.hidden = !names.includes(screen);
  }
  veil.dataset.on = screen === "play" ? "false" : "true";
  veil.dataset.dim = screen === "title" || screen === "story" ? "soft" : "hard";
  if (screen === "title") {
    let best = 0;
    try {
      best = Number(localStorage.getItem("hoursplit-best") || 0);
    } catch {
      best = 0;
    }
    document.getElementById("best").textContent = best
      ? `Best sand remaining ${fmtTime(best)}`
      : "";
  }
  if (screen === "fail" || screen === "over") {
    const over = screen === "over";
    document.getElementById("fail-kicker").textContent = over ? "Sealed" : "Fallen";
    document.getElementById("fail-title").textContent = over ? "The hours have sealed." : "This hall remains.";
    document.getElementById("fail-copy").textContent = game.failText || "";
    document.getElementById("retry").textContent = over ? "Begin again" : "Try this hall again";
  }
  if (screen === "ending") {
    const sand = fmtTime(game.endingSand);
    document.getElementById("ending-sand").textContent = game.newBest
      ? `Sand remaining ${sand}. The glass remembers this as your longest dawn.`
      : `Sand remaining ${sand}.`;
  }
}

let last = performance.now();
let shown = "";

function loop(now) {
  const dt = Math.min(0.034, (now - last) / 1000);
  last = now;
  game.update(dt, pull());
  paint(ctx, canvas, game, assets);
  if (game.screen !== shown) {
    shown = game.screen;
    sync();
  } else if (game.screen === "ending" || game.screen === "fail" || game.screen === "over") {
    sync();
  }
  requestAnimationFrame(loop);
}

frame.focus();
sync();
requestAnimationFrame(loop);

window.__hoursplit = game;
