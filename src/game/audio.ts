/** Tiny procedural soundtrack + SFX via Web Audio — no asset pipeline. */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private stepFlip = false;
  private musicTimer = 0;
  private musicStep = 0;

  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
  }

  resume() {
    this.ensure();
    void this.ctx?.resume();
  }

  private beep(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    gain = 0.08,
    dest?: AudioNode,
  ) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  step() {
    this.stepFlip = !this.stepFlip;
    this.beep(this.stepFlip ? 110 : 95, 0.04, "triangle", 0.04);
  }

  jump() {
    this.beep(180, 0.08, "square", 0.06);
    this.beep(260, 0.1, "triangle", 0.04);
  }

  land() {
    this.beep(70, 0.08, "triangle", 0.07);
  }

  swing() {
    this.beep(420, 0.05, "sawtooth", 0.05);
    this.beep(180, 0.08, "square", 0.04);
  }

  hit() {
    this.beep(90, 0.12, "sawtooth", 0.09);
    this.beep(60, 0.18, "triangle", 0.07);
  }

  hurt() {
    this.beep(220, 0.1, "square", 0.07);
    this.beep(140, 0.16, "sawtooth", 0.06);
  }

  pickup() {
    this.beep(520, 0.08, "triangle", 0.06);
    this.beep(780, 0.12, "triangle", 0.05);
  }

  gate() {
    this.beep(140, 0.2, "triangle", 0.05);
    this.beep(90, 0.25, "sine", 0.04);
  }

  die() {
    this.beep(200, 0.15, "sawtooth", 0.08);
    this.beep(100, 0.35, "triangle", 0.07);
    this.beep(55, 0.5, "sine", 0.06);
  }

  win() {
    const notes = [262, 330, 392, 523];
    notes.forEach((n, i) => {
      setTimeout(() => this.beep(n, 0.2, "triangle", 0.07), i * 120);
    });
  }

  /** Sparse modal motif under gameplay */
  tickMusic(dt: number, playing: boolean) {
    if (!playing || !this.ctx || !this.musicGain) return;
    this.musicTimer += dt;
    if (this.musicTimer < 0.55) return;
    this.musicTimer = 0;
    const scale = [146.83, 164.81, 174.61, 196.0, 220.0, 246.94, 261.63];
    const pattern = [0, 2, 4, 2, 5, 4, 3, 2, 0, 0, 4, 5];
    const note = scale[pattern[this.musicStep % pattern.length]];
    this.musicStep++;
    this.beep(note, 0.35, this.musicStep % 3 === 0 ? "triangle" : "sine", 0.035, this.musicGain);
    if (this.musicStep % 4 === 0) {
      this.beep(note / 2, 0.5, "sine", 0.025, this.musicGain);
    }
  }
}
