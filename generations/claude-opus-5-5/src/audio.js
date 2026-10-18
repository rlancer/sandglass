// Every sound is synthesized at runtime: Karplus-Strong plucked strings for the "oud",
// filtered noise for drums and stone, inharmonic partials for steel.
let ac = null;
let master, musicBus, sfxBus, reverb;
let muted = false;
const pluckCache = new Map();

// D Hijaz (D Eb F# G A Bb C)
const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
const BASE = 146.83; // D3
const noteHz = (deg, oct = 0) => {
  const n = HIJAZ.length;
  const o = Math.floor(deg / n) + oct;
  const s = HIJAZ[((deg % n) + n) % n];
  return BASE * Math.pow(2, o + s / 12);
};

function makeImpulse(seconds, decay) {
  const len = ac.sampleRate * seconds;
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function initAudio() {
  if (ac) {
    if (ac.state === "suspended") ac.resume();
    return;
  }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain();
  master.gain.value = 0.8;
  master.connect(ac.destination);
  reverb = ac.createConvolver();
  reverb.buffer = makeImpulse(2.8, 3);
  const wet = ac.createGain();
  wet.gain.value = 0.32;
  reverb.connect(wet).connect(master);
  musicBus = ac.createGain();
  musicBus.gain.value = 0.5;
  sfxBus = ac.createGain();
  sfxBus.gain.value = 0.9;
  musicBus.connect(master);
  sfxBus.connect(master);
  musicBus.connect(reverb);
  sfxBus.connect(reverb);
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.05);
  return muted;
}

function pluckBuffer(freq, bright = 0.5, dur = 2.2) {
  const key = `${freq.toFixed(2)}|${bright}`;
  if (pluckCache.has(key)) return pluckCache.get(key);
  const sr = ac.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const period = Math.round(sr / freq);
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  // pluck near the bridge: comb the excitation a little
  let idx = 0;
  const damp = 0.996 - (1 - bright) * 0.004;
  for (let i = 0; i < len; i++) {
    const cur = ring[idx];
    const next = ring[(idx + 1) % period];
    const v = (cur * (0.5 + bright * 0.2) + next * (0.5 - bright * 0.2)) * damp;
    ring[idx] = v;
    d[i] = cur;
    idx = (idx + 1) % period;
  }
  pluckCache.set(key, buf);
  return buf;
}

function pluck(freq, when = 0, gain = 0.4, bus = musicBus, bright = 0.5) {
  if (!ac) return;
  const src = ac.createBufferSource();
  src.buffer = pluckBuffer(freq, bright);
  const g = ac.createGain();
  g.gain.value = gain;
  const pan = ac.createStereoPanner();
  pan.pan.value = (Math.random() - 0.5) * 0.4;
  src.connect(g).connect(pan).connect(bus);
  src.start(ac.currentTime + when);
}

function noise(dur) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
let noiseBuf = null;

function noiseHit({ dur = 0.2, type = "bandpass", freq = 1000, q = 1, gain = 0.4, when = 0, sweep = null, attack = 0.002 } = {}) {
  if (!ac || muted) return;
  noiseBuf ??= noise(2);
  const t = ac.currentTime + when;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

function tone({ freq = 200, type = "sine", dur = 0.2, gain = 0.3, when = 0, to = null, attack = 0.003, bus = sfxBus } = {}) {
  if (!ac || muted) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let lastStep = 0;
export const sfx = {
  step() {
    if (!ac) return;
    const now = ac.currentTime;
    if (now - lastStep < 0.12) return;
    lastStep = now;
    noiseHit({ dur: 0.06, type: "lowpass", freq: 600 + Math.random() * 300, gain: 0.12 });
  },
  jump() {
    noiseHit({ dur: 0.12, type: "bandpass", freq: 500, sweep: 1400, q: 0.7, gain: 0.08 });
  },
  land(hard = 0) {
    tone({ freq: 120, to: 50, dur: 0.18 + hard * 0.2, gain: 0.35 + hard * 0.3 });
    noiseHit({ dur: 0.12 + hard * 0.2, type: "lowpass", freq: 500, gain: 0.25 + hard * 0.2 });
  },
  grab() {
    noiseHit({ dur: 0.06, type: "highpass", freq: 2000, gain: 0.1 });
  },
  swish() {
    noiseHit({ dur: 0.16, type: "bandpass", freq: 900, sweep: 3800, q: 2, gain: 0.18 });
  },
  clang() {
    if (!ac || muted) return;
    const base = 900 + Math.random() * 200;
    for (const m of [1, 2.76, 5.4, 8.93]) tone({ freq: base * m, type: "sine", dur: 0.5 / Math.sqrt(m), gain: 0.12 / Math.sqrt(m) });
    noiseHit({ dur: 0.07, type: "highpass", freq: 4000, gain: 0.25 });
  },
  hit() {
    tone({ freq: 220, to: 70, type: "triangle", dur: 0.18, gain: 0.35 });
    noiseHit({ dur: 0.1, type: "bandpass", freq: 1200, gain: 0.25 });
  },
  hurt() {
    tone({ freq: 330, to: 140, type: "sawtooth", dur: 0.25, gain: 0.08 });
  },
  rattle() {
    for (let i = 0; i < 6; i++) noiseHit({ dur: 0.05, type: "bandpass", freq: 300 + Math.random() * 300, q: 3, gain: 0.12, when: i * 0.07 });
  },
  crumble() {
    noiseHit({ dur: 0.5, type: "lowpass", freq: 900, sweep: 200, gain: 0.25 });
  },
  crash() {
    tone({ freq: 90, to: 40, dur: 0.4, gain: 0.4 });
    noiseHit({ dur: 0.6, type: "lowpass", freq: 2200, sweep: 300, gain: 0.45 });
  },
  click() {
    tone({ freq: 1400, dur: 0.04, type: "square", gain: 0.06 });
    tone({ freq: 160, to: 90, dur: 0.12, gain: 0.25 });
  },
  gateTick() {
    noiseHit({ dur: 0.03, type: "bandpass", freq: 2500 + Math.random() * 800, q: 5, gain: 0.08 });
  },
  gateSlam() {
    tone({ freq: 140, to: 60, dur: 0.3, type: "triangle", gain: 0.4 });
    noiseHit({ dur: 0.25, type: "bandpass", freq: 1800, q: 1, gain: 0.3 });
  },
  doorOpen() {
    tone({ freq: 60, to: 90, dur: 2.2, type: "sawtooth", gain: 0.05, attack: 0.3 });
  },
  spikes() {
    noiseHit({ dur: 0.15, type: "highpass", freq: 3000, sweep: 7000, gain: 0.25 });
  },
  chomp() {
    for (const m of [1, 3.1]) tone({ freq: 1600 * m, dur: 0.12, gain: 0.07 });
    noiseHit({ dur: 0.08, type: "highpass", freq: 3500, gain: 0.2 });
  },
  slice() {
    noiseHit({ dur: 0.3, type: "highpass", freq: 2000, sweep: 6000, gain: 0.4 });
    tone({ freq: 400, to: 60, dur: 0.5, type: "sawtooth", gain: 0.12 });
  },
  gulp() {
    for (let i = 0; i < 3; i++) tone({ freq: 300 + i * 40, to: 160, dur: 0.12, gain: 0.25, when: i * 0.22 });
  },
  potion(good = true) {
    const degs = good ? [0, 2, 4, 7] : [4, 2, 1, 0];
    degs.forEach((d, i) => pluck(noteHz(d, 1), i * 0.09, 0.35, sfxBus, 0.8));
  },
  pickup() {
    [0, 4, 7, 9, 11, 14].forEach((d, i) => pluck(noteHz(d, 1), i * 0.07, 0.35, sfxBus, 0.9));
  },
  echoStart() {
    tone({ freq: 440, to: 880, dur: 0.5, type: "sine", gain: 0.1 });
    tone({ freq: 660, to: 1320, dur: 0.6, type: "sine", gain: 0.06, when: 0.05 });
  },
  rewind() {
    tone({ freq: 1200, to: 120, dur: 0.8, type: "sawtooth", gain: 0.05 });
    noiseHit({ dur: 0.8, type: "bandpass", freq: 6000, sweep: 300, q: 4, gain: 0.2 });
  },
  shadowFade() {
    noiseHit({ dur: 0.7, type: "bandpass", freq: 2000, sweep: 8000, q: 3, gain: 0.08 });
  },
  death() {
    if (!ac) return;
    [4, 3, 1, 0, -3].forEach((d, i) => pluck(noteHz(d, 0), i * 0.28, 0.5, sfxBus, 0.3));
    tone({ freq: 73, dur: 2.5, type: "sawtooth", gain: 0.06, attack: 0.1 });
  },
  fanfare() {
    if (!ac) return;
    [0, 2, 4, 5, 7, 5, 7, 11, 14].forEach((d, i) => pluck(noteHz(d, 1), i * 0.13, 0.4, sfxBus, 0.8));
    [0, 4, 7].forEach((d) => pluck(noteHz(d, 0), 1.2, 0.4, sfxBus, 0.5));
  },
  summon() {
    tone({ freq: 80, to: 400, dur: 0.8, type: "sawtooth", gain: 0.08 });
    noiseHit({ dur: 0.8, type: "bandpass", freq: 400, sweep: 3000, q: 6, gain: 0.15 });
  },
};

// ---------- music ----------
let musicTimer = null;
let musicMode = null;
let drone = null;

function startDrone(level = 0.05) {
  stopDrone();
  const o1 = ac.createOscillator(), o2 = ac.createOscillator();
  o1.type = "sawtooth";
  o2.type = "sawtooth";
  o1.frequency.value = BASE / 2;
  o2.frequency.value = (BASE / 2) * 1.5 * 1.002;
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 500;
  f.Q.value = 4;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.07;
  const lg = ac.createGain();
  lg.gain.value = 260;
  lfo.connect(lg).connect(f.frequency);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(level, ac.currentTime + 3);
  o1.connect(f);
  o2.connect(f);
  f.connect(g).connect(musicBus);
  [o1, o2, lfo].forEach((o) => o.start());
  drone = { g, nodes: [o1, o2, lfo] };
}

function stopDrone() {
  if (!drone) return;
  const d = drone;
  d.g.gain.setTargetAtTime(0, ac.currentTime, 0.4);
  setTimeout(() => d.nodes.forEach((n) => n.stop()), 2000);
  drone = null;
}

function drum(when, low = true, gain = 0.5) {
  if (low) tone({ freq: 110, to: 45, dur: 0.35, gain, when, bus: musicBus });
  else noiseHit({ dur: 0.08, type: "bandpass", freq: 2500, q: 1.5, gain: gain * 0.5, when });
}

const TITLE_PHRASES = [
  [0, 1, 2, 1, 0, -1, 0, null, 4, 3, 2, 1, 2, 1, 0, null],
  [4, 5, 4, 3, 4, 3, 2, 1, 2, 3, 2, 1, 0, null, null, null],
  [7, 6, 5, 4, 5, 4, 3, 2, 3, 2, 1, 0, 1, 0, -1, 0],
];

export function playMusic(mode) {
  if (!ac || musicMode === mode) return;
  stopMusic();
  musicMode = mode;
  if (mode === "title") {
    startDrone(0.045);
    let bar = 0;
    const tick = () => {
      const beat = 0.24;
      const phrase = TITLE_PHRASES[bar % TITLE_PHRASES.length];
      phrase.forEach((d, i) => {
        if (d !== null) pluck(noteHz(d, 1), i * beat, 0.32, musicBus, 0.6);
        if (i % 4 === 0) drum(i * beat, true, 0.35);
        if (i % 4 === 2 || i % 8 === 7) drum(i * beat, false, 0.3);
      });
      if (bar % 2 === 0) pluck(noteHz(0, -1), 0, 0.4, musicBus, 0.3);
      bar++;
    };
    tick();
    musicTimer = setInterval(tick, 0.24 * 16 * 1000);
  } else if (mode === "game") {
    startDrone(0.025);
    const tick = () => {
      if (Math.random() < 0.55) {
        let d = Math.floor(Math.random() * 5);
        const n = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          pluck(noteHz(d, 1), i * 0.35 + Math.random() * 0.05, 0.16, musicBus, 0.45);
          d += Math.random() < 0.6 ? -1 : 1;
        }
      }
    };
    musicTimer = setInterval(tick, 5200);
  } else if (mode === "fight") {
    startDrone(0.04);
    let i = 0;
    const tick = () => {
      const beat = 0.19;
      for (let k = 0; k < 8; k++) {
        if (k === 0 || k === 3 || k === 6) drum(k * beat, true, 0.4);
        else drum(k * beat, false, 0.25);
      }
      [0, 1, 0, 4, 3, 1, 0, -1].forEach((d, k) => {
        if ((i + k) % 2 === 0) pluck(noteHz(d, 0), k * beat, 0.2, musicBus, 0.7);
      });
      i++;
    };
    tick();
    musicTimer = setInterval(tick, 0.19 * 8 * 1000);
  }
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  musicMode = null;
  if (ac) stopDrone();
}
