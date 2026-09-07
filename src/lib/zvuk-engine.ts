// ZVUK — generative ambient engine.
// Controlled randomness + musical memory + slow evolution.

export type ParamKey =
  | "space"
  | "motion"
  | "pulse"
  | "warmth"
  | "density"
  | "harmony";

export type Params = Record<ParamKey, number>; // 0..1

export const DEFAULT_PARAMS: Params = {
  space: 0.7,
  motion: 0.45,
  pulse: 0.35,
  warmth: 0.65,
  density: 0.4,
  harmony: 0.5,
};

export const PRESETS: { name: string; params: Params }[] = [
  { name: "DEEP", params: { space: 0.85, motion: 0.3, pulse: 0.15, warmth: 0.8, density: 0.3, harmony: 0.35 } },
  { name: "KOSMISCHE", params: { space: 0.7, motion: 0.6, pulse: 0.8, warmth: 0.7, density: 0.6, harmony: 0.55 } },
  { name: "NIGHT", params: { space: 0.75, motion: 0.35, pulse: 0.3, warmth: 0.55, density: 0.35, harmony: 0.6 } },
  { name: "DRIFT", params: { space: 0.9, motion: 0.75, pulse: 0.1, warmth: 0.6, density: 0.25, harmony: 0.45 } },
  { name: "DAWN", params: { space: 0.6, motion: 0.5, pulse: 0.45, warmth: 0.85, density: 0.55, harmony: 0.75 } },
  { name: "SUSPENDED", params: { space: 1.0, motion: 0.2, pulse: 0.05, warmth: 0.7, density: 0.2, harmony: 0.5 } },
];

const SCALES: Record<string, number[]> = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};
const MODE_KEYS = Object.keys(SCALES);
const MINORISH = ["aeolian", "dorian", "phrygian"];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
const mtof = (m: number) => 432 * Math.pow(2, (m - 69) / 12);

export interface MusicalState {
  root: number;
  mode: string;
  bpm: number;
  label: string;
}

export class ZvukEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private analyser!: AnalyserNode;
  private reverb!: ConvolverNode;
  private reverbGain!: GainNode;
  private delay!: DelayNode;
  private delayFb!: GainNode;
  private delayGain!: GainNode;
  private droneGain!: GainNode;
  private droneFilter!: BiquadFilterNode;
  private droneOscs: OscillatorNode[] = [];
  private timer: number | null = null;
  private data!: Uint8Array<ArrayBuffer>;

  params: Params = { ...DEFAULT_PARAMS };
  private root = 62; // D
  private mode = "aeolian";
  private bpm = 72;
  private step = 0;
  private nextTime = 0;
  private bar = 0;
  private motif: number[] = [0, 2, 4, 6];
  playing = false;

  onState: ((s: MusicalState) => void) | null = null;

  private emit() {
    this.onState?.({
      root: this.root,
      mode: this.mode,
      bpm: Math.round(this.bpm),
      label: `${NOTE_NAMES[this.root % 12]} ${
        MINORISH.includes(this.mode) ? "MINOR" : "MAJOR"
      } · ${Math.round(this.bpm)} BPM`,
    });
  }

  private ensure() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.85;
    this.data = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.master.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeIR(6);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.6;
    this.reverbGain.connect(this.reverb);
    this.reverb.connect(this.master);

    this.delay = ctx.createDelay(4);
    this.delay.delayTime.value = 60 / this.bpm * 0.75;
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.42;
    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = 0.35;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2200;
    this.delayGain.connect(this.delay);
    this.delay.connect(damp);
    damp.connect(this.delayFb);
    this.delayFb.connect(this.delay);
    this.delay.connect(this.master);
    this.delay.connect(this.reverbGain);

    // Drone
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = "lowpass";
    this.droneFilter.frequency.value = 420;
    this.droneFilter.Q.value = 3;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.16;
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.master);
    this.droneGain.connect(this.reverbGain);

    for (let i = 0; i < 5; i++) {
      const o = ctx.createOscillator();
      o.type = i % 2 === 0 ? "sawtooth" : "triangle";
      const g = ctx.createGain();
      g.gain.value = 0.2;
      o.connect(g);
      g.connect(this.droneFilter);
      o.start();
      this.droneOscs.push(o);
      // tape-like slow drift
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rand(0.03, 0.12);
      const lg = ctx.createGain();
      lg.gain.value = rand(0.6, 3);
      lfo.connect(lg);
      lg.connect(o.detune);
      lfo.start();
    }
    this.retuneDrone();

    // slow filter movement
    const flfo = ctx.createOscillator();
    flfo.frequency.value = 0.02;
    const fg = ctx.createGain();
    fg.gain.value = 180;
    flfo.connect(fg);
    fg.connect(this.droneFilter.frequency);
    flfo.start();

    this.applyParams();
  }

  private makeIR(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (1 - t * 0.2);
      }
    }
    return buf;
  }

  private retuneDrone() {
    if (!this.ctx) return;
    const base = this.root - 24;
    const offsets = [0, 0.08, 7, 12, 19];
    this.droneOscs.forEach((o, i) => {
      o.frequency.setTargetAtTime(mtof(base + Math.floor(offsets[i]!)), this.ctx!.currentTime, 4);
      o.detune.setTargetAtTime(rand(-9, 9), this.ctx!.currentTime, 4);
    });
  }

  setParam(k: ParamKey, v: number) {
    this.params[k] = v;
    this.applyParams();
  }
  setParams(p: Params) {
    this.params = { ...p };
    this.applyParams();
  }

  private applyParams() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const p = this.params;
    this.reverbGain.gain.setTargetAtTime(0.18 + p.space * 0.75, t, 1.5);
    this.delayGain.gain.setTargetAtTime(0.1 + p.space * 0.4, t, 1.5);
    this.delayFb.gain.setTargetAtTime(0.25 + p.space * 0.4, t, 1.5);
    this.droneFilter.frequency.setTargetAtTime(220 + p.warmth * 300 + (1 - p.warmth) * 500, t, 3);
    this.droneGain.gain.setTargetAtTime(0.1 + (1 - p.pulse) * 0.14, t, 3);
  }

  private scale() {
    return SCALES[this.mode]!;
  }

  private degreeToMidi(deg: number, octave = 0) {
    const s = this.scale();
    const oct = Math.floor(deg / s.length) + octave;
    const idx = ((deg % s.length) + s.length) % s.length;
    return this.root + s[idx]! + oct * 12;
  }

  private voice(midi: number, time: number, dur: number, level: number, bright: number) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = 0;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    const w = this.params.warmth;
    const cut = 500 + bright * 2600 * (1 - w * 0.45);
    filt.frequency.setValueAtTime(cut, time);
    filt.frequency.exponentialRampToValueAtTime(Math.max(180, cut * 0.35), time + dur);
    filt.Q.value = 1.2 + w * 2;

    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      o.type = w > 0.5 ? "sawtooth" : "triangle";
      o.frequency.value = mtof(midi);
      o.detune.value = (i === 0 ? -1 : 1) * (4 + w * 9) + rand(-3, 3);
      o.connect(filt);
      o.start(time);
      o.stop(time + dur + 0.6);
      oscs.push(o);
    }
    filt.connect(out);
    const atk = 0.02 + (1 - this.params.pulse) * 0.5;
    out.gain.setValueAtTime(0.0001, time);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), time + atk);
    out.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.5);

    out.connect(this.master);
    out.connect(this.delayGain);
    out.connect(this.reverbGain);
    oscs[oscs.length - 1]!.onended = () => out.disconnect();
  }

  private schedule(time: number) {
    const p = this.params;
    const s = this.step;
    const beat = 60 / this.bpm;

    // sequencer pulse
    if (p.pulse > 0.12 && Math.random() < 0.25 + p.pulse * 0.65) {
      const deg = this.motif[s % this.motif.length]! + (Math.random() < 0.2 ? 7 : 0);
      const oct = Math.random() < 0.25 ? 1 : 0;
      this.voice(this.degreeToMidi(deg, oct), time, beat * (0.4 + (1 - p.pulse) * 1.2), 0.05 + p.pulse * 0.07, 0.5 + p.pulse * 0.4);
    }

    // sparse melodic motif
    if (s % 8 === 0 && Math.random() < 0.3 + p.density * 0.5) {
      const deg = pick(this.motif) + 7;
      this.voice(this.degreeToMidi(deg, 1), time + beat * rand(0, 0.5), beat * rand(2, 5), 0.045, 0.8);
    }

    // pad swell
    if (s % 16 === 0 && Math.random() < 0.35 + p.density * 0.5) {
      const chordDegs = p.harmony > 0.6 ? [0, 2, 4, 6] : p.harmony > 0.3 ? [0, 2, 4] : [0, 4];
      const rot = Math.floor(rand(0, 4));
      chordDegs.forEach((d, i) =>
        this.voice(this.degreeToMidi(d + rot), time + i * 0.08, beat * rand(6, 12), 0.035, 0.35 + p.harmony * 0.3),
      );
    }

    // low sub accent
    if (s % 16 === 0 && p.pulse > 0.4) {
      this.voice(this.root - 12, time, beat * 2, 0.07, 0.15);
    }

    this.step = (s + 1) % 16;
    if (this.step === 0) {
      this.bar++;
      this.evolve();
    }
  }

  private evolve() {
    const m = this.params.motion;
    const chance = 0.05 + m * 0.35;
    if (this.bar % 4 === 0 && Math.random() < chance) {
      // nudge a single motif tone — musical memory preserved
      const i = Math.floor(Math.random() * this.motif.length);
      this.motif = [...this.motif];
      this.motif[i] = Math.max(-3, Math.min(11, this.motif[i]! + pick([-2, -1, 1, 2])));
    }
    if (this.bar % 16 === 0 && Math.random() < chance) {
      this.bpm = Math.max(52, Math.min(92, this.bpm + rand(-3, 3)));
      if (this.ctx) this.delay.delayTime.setTargetAtTime((60 / this.bpm) * 0.75, this.ctx.currentTime, 3);
      this.emit();
    }
    if (this.bar % 32 === 0 && Math.random() < chance * 0.8) {
      this.root += pick([-5, -3, 2, 3, 4, 5]);
      if (this.root > 67) this.root -= 12;
      if (this.root < 55) this.root += 12;
      this.retuneDrone();
      this.emit();
    }
    if (this.bar % 48 === 0 && Math.random() < chance * 0.6) {
      this.mode = pick(MODE_KEYS.filter((k) => k !== this.mode));
      this.emit();
    }
  }

  private tick = () => {
    const ctx = this.ctx!;
    const stepDur = (60 / this.bpm) / 2;
    while (this.nextTime < ctx.currentTime + 0.3) {
      this.schedule(Math.max(this.nextTime, ctx.currentTime + 0.02));
      this.nextTime += stepDur;
    }
  };

  async play() {
    this.ensure();
    const ctx = this.ctx!;
    await ctx.resume();
    this.nextTime = ctx.currentTime + 0.1;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0.85, ctx.currentTime, 2.2);
    if (this.timer === null) this.timer = window.setInterval(this.tick, 25);
    this.playing = true;
    this.emit();
  }

  pause() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 1.1);
    this.playing = false;
    window.setTimeout(() => {
      if (!this.playing && this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }, 4000);
  }

  mutate() {
    // same machine, new direction
    this.motif = this.motif.map((d) => (Math.random() < 0.5 ? d + pick([-2, -1, 1, 2]) : d));
    if (Math.random() < 0.5) this.root += pick([-3, 2, 3, -5]);
    if (this.root > 67) this.root -= 12;
    if (this.root < 55) this.root += 12;
    if (Math.random() < 0.4) this.mode = pick(MODE_KEYS.filter((k) => k !== this.mode));
    this.bpm = Math.max(52, Math.min(92, this.bpm + rand(-4, 4)));
    this.retuneDrone();
    this.emit();
  }

  energy() {
    if (!this.ctx || !this.playing) return 0;
    this.analyser.getByteFrequencyData(this.data);
    let sum = 0;
    for (let i = 0; i < 96; i++) sum += this.data[i]!;
    return Math.min(1, sum / (96 * 150));
  }

  get state(): MusicalState {
    return {
      root: this.root,
      mode: this.mode,
      bpm: Math.round(this.bpm),
      label: `${NOTE_NAMES[this.root % 12]} ${MINORISH.includes(this.mode) ? "MINOR" : "MAJOR"} · ${Math.round(this.bpm)} BPM`,
    };
  }

  dispose() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.ctx?.close();
    this.ctx = null;
  }
}
