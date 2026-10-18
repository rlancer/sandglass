function envGain(ctx, t, attack, hold, release, peak) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.7), t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return g;
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let muted = false;
  let allowed = false;
  let nextTime = 0;
  let stepIndex = 0;
  let started = false;
  let intensity = 0;

  const MELODY = [
    76, 0, 74, 72, 0, 71, 69, 68,
    0, 65, 64, 0, 65, 68, 0, 0,
    71, 0, 69, 68, 65, 0, 64, 65,
    64, 0, 0, 0, 60, 0, 64, 0,
  ];

  function ensure() {
    if (!allowed || muted) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.22;
      musicBus.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, peak, when, dest) {
    const ac = ensure();
    if (!ac) return;
    const t = when ?? ac.currentTime;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = envGain(ac, t, 0.015, Math.max(0.02, dur * 0.45), dur, peak);
    o.connect(g);
    g.connect(dest || master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, peak, freq, q, when) {
    const ac = ensure();
    if (!ac) return;
    const t = when ?? ac.currentTime;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = envGain(ac, t, 0.005, dur * 0.2, dur * 0.7, peak);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  function schedule(now) {
    if (!ctx || !started || muted) return;
    const step = 0.28;
    while (nextTime < now + 0.35) {
      const eighth = stepIndex % 32;
      const beat = stepIndex % 8;
      const note = MELODY[eighth];
      if (note) {
        const freq = 440 * 2 ** ((note - 69) / 12);
        tone(freq, 0.34, "triangle", 0.09 + intensity * 0.04, nextTime, musicBus);
        if (intensity > 0.4 && eighth % 4 === 0) {
          tone(freq / 2, 0.3, "sine", 0.04, nextTime, musicBus);
        }
      }
      if (beat === 0) noise(0.08, 0.05 + intensity * 0.05, 180, 0.7, nextTime);
      else if (beat === 4) noise(0.05, 0.03 + intensity * 0.03, 240, 0.8, nextTime);
      if (intensity > 0.5 && beat % 2 === 0) noise(0.04, 0.03, 900, 1.2, nextTime);
      if (stepIndex % 16 === 0) {
        tone(82.4, 0.5, "sine", 0.05, nextTime, musicBus);
        tone(123.5, 0.5, "sine", 0.03, nextTime, musicBus);
      }
      nextTime += step;
      stepIndex++;
    }
  }

  return {
    unlock() {
      allowed = true;
      const ac = ensure();
      if (!ac) return;
      if (!started) {
        started = true;
        nextTime = ac.currentTime + 0.05;
      }
    },
    tick(alert) {
      intensity += ((alert ? 1 : 0) - intensity) * 0.04;
      if (ctx) schedule(ctx.currentTime);
    },
    toggle() {
      muted = !muted;
      if (muted && master) master.gain.value = 0;
      if (!muted) {
        ensure();
        if (master) master.gain.value = 0.7;
        if (ctx) nextTime = ctx.currentTime + 0.05;
      }
      return muted;
    },
    get muted() {
      return muted;
    },
    jump() {
      tone(220, 0.12, "sine", 0.08);
      tone(420, 0.1, "triangle", 0.04);
    },
    land() {
      noise(0.09, 0.08, 120, 0.6);
    },
    step() {
      noise(0.03, 0.035, 200, 0.8);
    },
    swing() {
      noise(0.12, 0.07, 1400, 0.5);
      tone(180, 0.08, "sawtooth", 0.03);
    },
    hit() {
      noise(0.14, 0.16, 300, 0.4);
      tone(90, 0.18, "sine", 0.1);
    },
    parry() {
      tone(880, 0.08, "square", 0.04);
      tone(1320, 0.1, "triangle", 0.05);
      noise(0.06, 0.06, 2400, 2);
    },
    shift() {
      const ac = ensure();
      if (!ac) return;
      const t = ac.currentTime;
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(960, t + 0.35);
      const g = envGain(ac, t, 0.02, 0.08, 0.4, 0.06);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.5);
      tone(640, 0.3, "triangle", 0.03);
    },
    gate() {
      noise(0.28, 0.07, 180, 0.5);
      tone(110, 0.25, "sawtooth", 0.03);
    },
    drink() {
      tone(523, 0.12, "sine", 0.05);
      tone(659, 0.16, "sine", 0.04);
      tone(784, 0.2, "triangle", 0.04);
    },
    hurt() {
      tone(196, 0.16, "sawtooth", 0.05);
      noise(0.12, 0.1, 400, 0.5);
    },
    death() {
      tone(392, 0.2, "triangle", 0.07);
      tone(311, 0.25, "triangle", 0.06);
      tone(233, 0.4, "sine", 0.08);
      noise(0.3, 0.08, 200, 0.4);
    },
    loose() {
      noise(0.16, 0.06, 160, 0.4);
    },
    blade() {
      noise(0.18, 0.1, 600, 0.4);
      tone(70, 0.2, "sine", 0.08);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => {
        const ac = ensure();
        if (!ac) return;
        tone(f, 0.4, "triangle", 0.06, ac.currentTime + i * 0.12);
      });
    },
    tickSand() {
      tone(988, 0.04, "square", 0.02);
    },
  };
}
