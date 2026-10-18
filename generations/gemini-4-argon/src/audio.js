// Procedural WebAudio Synthesizer: 1989 AdLib / Roland MT-32 Persian Maqam Hijaz & Dungeon SFX

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicPlaying = false;
    this.stepToggle = false;
    this.musicTimer = null;
    this.noteIndex = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stopMusic();
    } else {
      this.init();
      this.startAmbientMotif();
    }
    return this.enabled;
  }

  startAmbientMotif() {
    if (!this.enabled || this.musicTimer) return;
    this.init();
    // D Phrygian Dominant (Maqam Hijaz): D, Eb, F#, G, A, Bb, C, D
    const scale = [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66];
    const motif = [0, 1, 2, 3, 2, 1, 0, -1, 4, 5, 4, 3, 2, 1, 0, -1];
    this.musicTimer = setInterval(() => {
      if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
      const step = motif[this.noteIndex % motif.length];
      this.noteIndex++;
      if (step < 0) return;
      const freq = scale[step];
      this.playOudPluck(freq, 0.032, 0.42);
      if (this.noteIndex % 4 === 1) {
        this.playOudPluck(scale[0] * 0.5, 0.025, 0.7);
      }
    }, 420);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  playOudPluck(freq, gainVal = 0.04, duration = 0.45) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    sub.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    sub.frequency.setValueAtTime(freq * 1.003, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 5, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.2, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    sub.start(now);
    osc.stop(now + duration + 0.02);
    sub.stop(now + duration + 0.02);
  }

  playStep(careful = false) {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    this.stepToggle = !this.stepToggle;
    const base = careful ? 110 : this.stepToggle ? 135 : 152;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.055);
    gain.gain.setValueAtTime(careful ? 0.04 : 0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  playJump() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.14);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playGrab() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.setValueAtTime(240, now + 0.04);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playLooseShake() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90 + i * 22, now + i * 0.05);
      gain.gain.setValueAtTime(0.06, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.045);
    }
  }

  playTileCrash() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.22;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  playPlatePress() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(220, now + 0.045);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playGateTick(opening = true) {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(opening ? 520 : 380, now);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  playSpikes() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(1900, now + 0.09);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playChomper() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.11);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playSwordClash(parry = false) {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const freqs = parry ? [1180, 1760, 2480] : [820, 1240, 1690];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'square' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, now + 0.14);
      gain.gain.setValueAtTime(0.075 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    });
  }

  playHit(fatal = false) {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(fatal ? 220 : 290, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + (fatal ? 0.35 : 0.16));
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (fatal ? 0.36 : 0.18));
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + (fatal ? 0.38 : 0.19));
  }

  playPotion(good = true) {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    // Classic 1989 ascending Persian arpeggio
    const notes = good ? [293.66, 369.99, 440, 587.33] : [311.13, 277.18, 220, 164.81];
    notes.forEach((n, i) => {
      this.playOudPluck(n, 0.08, 0.28);
      setTimeout(() => this.playOudPluck(n * 1.5, 0.05, 0.25), i * 85);
    });
  }

  playShadowManifest() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, i) => {
      setTimeout(() => this.playOudPluck(n, 0.06, 0.35), i * 45);
    });
  }

  playRewindPulse() {
    if (!this.enabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360 + Math.random() * 180, now);
    osc.frequency.linearRampToValueAtTime(240, now + 0.06);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }
}
