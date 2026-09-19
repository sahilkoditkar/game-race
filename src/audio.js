// Tiny procedural audio: engine hum per player, skids, impacts and UI beeps.

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engines = [];
    this.volume = 0.7;
    this.enabled = true;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.enabled ? v : 0; }
  setEnabled(on) { this.enabled = on; this.setVolume(this.volume); }

  /** Create an engine voice; returns handle. */
  createEngine() {
    if (!this.ctx) return null;
    const c = this.ctx;
    const gain = c.createGain(); gain.gain.value = 0;
    const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = 2;
    const o1 = c.createOscillator(); o1.type = 'sawtooth';
    const o2 = c.createOscillator(); o2.type = 'square';
    const o3 = c.createOscillator(); o3.type = 'triangle';
    const g2 = c.createGain(); g2.gain.value = 0.4;
    const g3 = c.createGain(); g3.gain.value = 0.25;
    o1.connect(filter); o2.connect(g2); g2.connect(filter); o3.connect(g3); g3.connect(filter);
    filter.connect(gain); gain.connect(this.master);
    o1.start(); o2.start(); o3.start();
    // skid noise
    const noise = c.createBufferSource();
    const buf = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise.buffer = buf; noise.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1800; nf.Q.value = 0.8;
    const ng = c.createGain(); ng.gain.value = 0;
    noise.connect(nf); nf.connect(ng); ng.connect(this.master);
    noise.start();
    const h = { gain, filter, o1, o2, o3, ng, rpm: 0 };
    this.engines.push(h);
    return h;
  }

  /** Update an engine voice. speedFrac in [0,1], throttle in [0,1]. */
  updateEngine(h, speedFrac, throttle, skid, distanceGain = 1) {
    if (!h || !this.ctx) return;
    const gears = 6;
    const g = Math.min(gears - 1, Math.floor(speedFrac * gears));
    const within = speedFrac * gears - g;
    const rpm = 0.25 + within * 0.75;
    h.rpm += (rpm - h.rpm) * 0.25;
    const f = 45 + h.rpm * 170 + g * 6;
    const t = this.ctx.currentTime;
    h.o1.frequency.setTargetAtTime(f, t, 0.03);
    h.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    h.o3.frequency.setTargetAtTime(f * 2.01, t, 0.03);
    h.filter.frequency.setTargetAtTime(500 + h.rpm * 1800 + throttle * 600, t, 0.05);
    h.gain.gain.setTargetAtTime((0.05 + h.rpm * 0.08 + throttle * 0.06) * distanceGain, t, 0.05);
    h.ng.gain.setTargetAtTime(skid ? 0.09 : 0, t, 0.08);
  }

  stopEngines() {
    for (const h of this.engines) {
      try { h.o1.stop(); h.o2.stop(); h.o3.stop(); h.gain.disconnect(); h.ng.disconnect(); } catch (e) { /* ignore */ }
    }
    this.engines = [];
  }

  beep(freq = 880, dur = 0.12, type = 'square', vol = 0.25) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  impact(strength = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const len = 0.18;
    const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = c.createGain(); g.gain.value = Math.min(0.6, 0.15 + strength * 0.03);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }

  countdown(n) { this.beep(n === 0 ? 1320 : 660, n === 0 ? 0.5 : 0.18, 'square', 0.22); }
  lap() { this.beep(1046, 0.1, 'sine', 0.25); setTimeout(() => this.beep(1568, 0.16, 'sine', 0.25), 110); }
  click() { this.beep(520, 0.05, 'triangle', 0.12); }
  finish() { [0, 120, 240, 360].forEach((d, i) => setTimeout(() => this.beep([784, 988, 1175, 1568][i], 0.25, 'triangle', 0.25), d)); }
}
