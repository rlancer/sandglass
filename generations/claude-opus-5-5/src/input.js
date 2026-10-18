const KEYMAP = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ShiftLeft: "shift", ShiftRight: "shift",
  Space: "strike", KeyJ: "strike",
  KeyK: "up",
  KeyE: "echo",
  Enter: "start",
  Escape: "pause", KeyP: "pause",
  KeyR: "restart",
  KeyM: "mute",
  KeyN: "debugNext",
  KeyI: "debugGod",
  KeyG: "debugGrid",
};

const held = new Set();
const pressed = new Set();
let padPrev = {};

window.addEventListener("keydown", (e) => {
  const a = KEYMAP[e.code];
  if (!a) return;
  e.preventDefault();
  if (!held.has(a)) pressed.add(a);
  held.add(a);
});
window.addEventListener("keyup", (e) => {
  const a = KEYMAP[e.code];
  if (a) held.delete(a);
});
window.addEventListener("blur", () => held.clear());

const PAD = { 12: "up", 13: "down", 14: "left", 15: "right", 0: "up", 2: "strike", 1: "echo", 5: "shift", 4: "shift", 9: "start", 8: "pause", 3: "down" };
const padHeld = new Set();

function pollPad() {
  padHeld.clear();
  const pads = navigator.getGamepads?.() ?? [];
  const pad = [...pads].find(Boolean);
  if (!pad) return;
  const now = {};
  for (const [i, a] of Object.entries(PAD)) if (pad.buttons[i]?.pressed) now[a] = true;
  const [ax, ay] = pad.axes;
  if (ax < -0.5) now.left = true;
  if (ax > 0.5) now.right = true;
  if (ay < -0.6) now.up = true;
  if (ay > 0.6) now.down = true;
  for (const a of Object.keys(now)) {
    padHeld.add(a);
    if (!padPrev[a]) pressed.add(a);
  }
  padPrev = now;
}

export const input = {
  poll: pollPad,
  held: (a) => held.has(a) || padHeld.has(a),
  pressed: (a) => pressed.has(a),
  consume: (a) => pressed.delete(a),
  endFrame: () => pressed.clear(),
  any: () => pressed.size > 0,
};
