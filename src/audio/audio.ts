/* Procedural audio engine. Everything is synthesized with the Web Audio API. */

type Ambient = 'none' | 'title' | 'house' | 'basement' | 'ending';

export type Sfx =
  | 'door_open' | 'door_close' | 'door_slam' | 'locked' | 'unlock' | 'pickup' | 'sting' | 'scream'
  | 'thunder' | 'chime' | 'whisper' | 'crash' | 'knock' | 'gurgle' | 'switch' | 'shutter' | 'crumble'
  | 'select' | 'cancel' | 'cursor' | 'wrong' | 'solve' | 'save' | 'buzz' | 'book' | 'safe' | 'creak'
  | 'giggle' | 'drip' | 'page' | 'hide' | 'gate';

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private volume = 0.8;
  private ambient: Ambient = 'none';
  private ambNodes: { stop: () => void; set?: (prox: number) => void } | null = null;
  private prox = 0;
  private nextBeat = 0;
  private chase = false;
  private chaseNodes: { gain: GainNode; stop: () => void } | null = null;
  private seqStep = 0;
  private seqNext = 0;
  private musicTimer = 0;
  private musicStep = 0;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = 0.9;
    this.music.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);
    // a big dark room reverb
    this.reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    if (ctx.state === 'suspended') void ctx.resume();
    const amb = this.ambient;
    this.ambient = 'none';
    this.setAmbient(amb);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private now() { return this.ctx ? this.ctx.currentTime : 0; }

  private out(pan = 0, wet = 0.25, bus?: AudioNode): AudioNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const dest = bus ?? this.sfxBus;
    if (pan && (ctx as any).createStereoPanner) {
      const pn = ctx.createStereoPanner();
      pn.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(pn).connect(dest);
      if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; pn.connect(s).connect(this.reverbSend); }
    } else {
      g.connect(dest);
      if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s).connect(this.reverbSend); }
    }
    return g;
  }

  private tone(freq: number, type: OscillatorType, t0: number, dur: number, vol: number, o: { a?: number; freqEnd?: number; dest?: AudioNode; detune?: number; curve?: 'exp' | 'lin' } = {}) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (o.detune) osc.detune.value = o.detune;
    if (o.freqEnd) {
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(o.freqEnd, t0 + dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t0 + dur);
    }
    const g = ctx.createGain();
    const a = o.a ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(o.dest ?? this.out());
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return osc;
  }

  private noiseBurst(t0: number, dur: number, vol: number, o: { type?: BiquadFilterType; f?: number; fEnd?: number; q?: number; a?: number; dest?: AudioNode; rate?: number } = {}) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.f ?? 1000, t0);
    if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, t0 + dur);
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + (o.a ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(o.dest ?? this.out());
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  // ---------------- ambience ----------------
  setAmbient(kind: Ambient) {
    if (kind === this.ambient) return;
    this.ambient = kind;
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (this.ambNodes) { this.ambNodes.stop(); this.ambNodes = null; }
    if (kind === 'none') return;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(1, t + 2.5);
    bus.connect(this.music);
    const nodes: AudioScheduledSourceNode[] = [];
    let setProx: ((p: number) => void) | undefined;
    if (kind === 'house' || kind === 'basement' || kind === 'title') {
      const base = kind === 'basement' ? 36.7 : kind === 'title' ? 55 : 46.2;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 4;
      const dg = ctx.createGain(); dg.gain.value = kind === 'title' ? 0.05 : 0.07;
      for (const det of [0, 0.7, -0.4]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base + det;
        o.connect(lp); nodes.push(o);
      }
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lfoG = ctx.createGain(); lfoG.gain.value = 60;
      lfo.connect(lfoG).connect(lp.frequency); nodes.push(lfo);
      lp.connect(dg).connect(bus);
      // wind / room tone
      const n = ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = kind === 'basement' ? 220 : 420; bp.Q.value = 0.6;
      const wg = ctx.createGain(); wg.gain.value = 0.022;
      const wl = ctx.createOscillator(); wl.frequency.value = 0.045;
      const wlg = ctx.createGain(); wlg.gain.value = 0.016;
      wl.connect(wlg).connect(wg.gain);
      n.connect(bp).connect(wg).connect(bus); nodes.push(n, wl);
      // tension layer driven by monster proximity
      const tg = ctx.createGain(); tg.gain.value = 0;
      const tf = ctx.createBiquadFilter(); tf.type = 'bandpass'; tf.frequency.value = 900; tf.Q.value = 1.5;
      for (const f of [622.3, 659.3, 698.5]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = Math.random() * 12 - 6;
        o.connect(tf); nodes.push(o);
      }
      const trem = ctx.createOscillator(); trem.frequency.value = 7;
      const tremG = ctx.createGain(); tremG.gain.value = 0.5;
      const tv = ctx.createGain(); tv.gain.value = 0.5;
      trem.connect(tremG).connect(tv.gain); nodes.push(trem);
      tf.connect(tv).connect(tg).connect(bus);
      setProx = (p: number) => {
        const now = ctx.currentTime;
        tg.gain.setTargetAtTime(p * p * 0.05, now, 0.4);
        lp.frequency.setTargetAtTime(140 + p * 520, now, 0.5);
        dg.gain.setTargetAtTime((kind === 'title' ? 0.05 : 0.07) + p * 0.06, now, 0.5);
      };
    }
    nodes.forEach((n) => n.start());
    this.ambNodes = {
      stop: () => {
        const now = ctx.currentTime;
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
        bus.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        nodes.forEach((n) => { try { n.stop(now + 1.3); } catch { /* */ } });
      },
      set: setProx,
    };
    this.musicTimer = 0;
    this.musicStep = 0;
  }

  setProximity(p: number) {
    this.prox = Math.max(0, Math.min(1, p));
    this.ambNodes?.set?.(this.prox);
  }

  // ---------------- chase music ----------------
  setChase(on: boolean) {
    if (on === this.chase) return;
    this.chase = on;
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (on) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(1, t + 0.4);
      gain.connect(this.music);
      const strings = ctx.createGain(); strings.gain.value = 0.03;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.9;
      const oscs: OscillatorNode[] = [];
      for (const f of [329.6, 349.2, 466.2, 493.9]) {
        for (const d of [-8, 8]) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
          o.connect(bp); oscs.push(o);
        }
      }
      const trem = ctx.createOscillator(); trem.type = 'square'; trem.frequency.value = 11;
      const tg = ctx.createGain(); tg.gain.value = 0.5;
      const tv = ctx.createGain(); tv.gain.value = 0.5;
      trem.connect(tg).connect(tv.gain); oscs.push(trem);
      bp.connect(tv).connect(strings).connect(gain);
      strings.gain.linearRampToValueAtTime(0.06, t + 8);
      oscs.forEach((o) => o.start(t));
      this.chaseNodes = {
        gain,
        stop: () => {
          const now = ctx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
          oscs.forEach((o) => { try { o.stop(now + 3); } catch { /* */ } });
        },
      };
      this.seqStep = 0;
      this.seqNext = t + 0.05;
    } else if (this.chaseNodes) {
      this.chaseNodes.stop();
      this.chaseNodes = null;
    }
  }

  /** Must be called every frame. */
  update(dt: number) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // heartbeat
    if (this.prox > 0.12 && !this.chase) {
      if (this.nextBeat < now) this.nextBeat = now + 0.05;
      while (this.nextBeat < now + 0.15) {
        const v = 0.12 + this.prox * 0.5;
        const dest = this.out(0, 0, this.music);
        this.tone(58, 'sine', this.nextBeat, 0.16, v, { freqEnd: 34, dest });
        this.tone(52, 'sine', this.nextBeat + 0.2, 0.16, v * 0.6, { freqEnd: 30, dest });
        this.nextBeat += Math.max(0.42, 1.15 - this.prox * 0.75);
      }
    }
    // chase sequencer
    if (this.chase && this.chaseNodes) {
      const stepDur = 60 / 168 / 4;
      const bassNotes = [82.4, 82.4, 87.3, 82.4, 116.5, 82.4, 87.3, 77.8];
      while (this.seqNext < now + 0.12) {
        const t = this.seqNext;
        const s = this.seqStep;
        const dest = this.chaseNodes.gain;
        if (s % 2 === 0) {
          const n = bassNotes[(s / 2) % bassNotes.length];
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
          f.connect(dest);
          this.tone(n, 'square', t, 0.12, 0.09, { dest: f });
          this.tone(n / 2, 'sawtooth', t, 0.14, 0.06, { dest: f });
        }
        if (s % 4 === 0) {
          this.tone(110, 'sine', t, 0.18, 0.35, { freqEnd: 38, dest });
          this.noiseBurst(t, 0.06, 0.08, { type: 'lowpass', f: 900, dest });
        }
        if (s % 8 === 4) this.noiseBurst(t, 0.12, 0.08, { type: 'bandpass', f: 1800, q: 0.6, dest });
        if (s % 2 === 1) this.noiseBurst(t, 0.025, 0.025, { type: 'highpass', f: 7000, dest });
        if (s % 32 === 0) this.tone(1975, 'sawtooth', t, 0.7, 0.02, { freqEnd: 1318, dest, a: 0.05 });
        this.seqNext += stepDur;
        this.seqStep++;
      }
    }
    // generative music for title / ending / basement drips
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      if (this.ambient === 'title') {
        const notes = [880, 987.8, 1046.5, 1318.5, 1174.7, 659.3, 1046.5, 987.8];
        const n = notes[this.musicStep % notes.length] * (Math.random() < 0.2 ? 0.5 : 1);
        const dest = this.out(0, 0.6, this.music);
        this.tone(n, 'triangle', now, 1.8, 0.05, { dest });
        this.tone(n * 2.01, 'sine', now, 0.9, 0.012, { dest });
        this.musicStep++;
        this.musicTimer = 0.55 + Math.random() * 0.9 + (this.musicStep % 8 === 0 ? 2.5 : 0);
      } else if (this.ambient === 'ending') {
        const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
        const ch = chords[Math.floor(this.musicStep / 4) % chords.length];
        const n = ch[this.musicStep % 3] * (this.musicStep % 4 === 3 ? 2 : 1);
        const dest = this.out(0, 0.5, this.music);
        this.tone(n, 'triangle', now, 2.2, 0.06, { dest, a: 0.02 });
        if (this.musicStep % 4 === 0) ch.forEach((f) => this.tone(f / 2, 'sine', now, 3.6, 0.03, { dest, a: 0.4 }));
        this.musicStep++;
        this.musicTimer = 0.62;
      } else if (this.ambient === 'basement') {
        this.sfx('drip', { vol: 0.5 + Math.random() * 0.5, pan: Math.random() * 1.6 - 0.8 });
        this.musicTimer = 1.5 + Math.random() * 4;
      } else {
        this.musicTimer = 1;
      }
    }
  }

  // ---------------- footsteps ----------------
  step(surface: 'wood' | 'stone' | 'tile' | 'carpet', vol = 1, pan = 0) {
    if (!this.ctx) return;
    const t = this.now();
    const f = surface === 'stone' ? 1600 : surface === 'tile' ? 2600 : surface === 'carpet' ? 700 : 1200;
    const dest = this.out(pan, 0.12);
    this.noiseBurst(t, 0.07, 0.07 * vol, { type: 'bandpass', f, q: 1.2, dest });
    if (surface === 'wood') this.tone(140 + Math.random() * 30, 'sine', t, 0.05, 0.03 * vol, { dest });
  }

  monsterStep(vol: number, pan: number) {
    if (!this.ctx || vol < 0.02) return;
    const t = this.now();
    const dest = this.out(pan, 0.5);
    this.tone(70, 'sine', t, 0.22, 0.55 * vol, { freqEnd: 32, dest });
    this.noiseBurst(t, 0.16, 0.22 * vol, { type: 'lowpass', f: 380, dest });
    if (Math.random() < 0.3) this.tone(160 + Math.random() * 40, 'triangle', t + 0.02, 0.3, 0.05 * vol, { freqEnd: 110, dest });
  }

  monsterBreath(vol: number, pan: number) {
    if (!this.ctx || vol < 0.03) return;
    const t = this.now();
    const dest = this.out(pan, 0.4);
    this.noiseBurst(t, 1.1, 0.12 * vol, { type: 'bandpass', f: 500, fEnd: 300, q: 2, a: 0.4, dest });
    this.tone(92, 'sawtooth', t, 1.0, 0.03 * vol, { freqEnd: 70, a: 0.3, dest });
  }

  // ---------------- one shots ----------------
  sfx(name: Sfx, o: { vol?: number; pan?: number } = {}) {
    if (!this.ctx || this.ctx.state === 'closed') return;
    const t = this.now();
    const v = o.vol ?? 1;
    const pan = o.pan ?? 0;
    const dest = (wet = 0.3) => this.out(pan, wet);
    switch (name) {
      case 'door_open':
      case 'creak': {
        const d = dest(0.4);
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1300, t + 0.5); f.Q.value = 6;
        f.connect(d);
        const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth';
        o1.frequency.setValueAtTime(170, t); o1.frequency.linearRampToValueAtTime(240, t + 0.25); o1.frequency.linearRampToValueAtTime(150, t + 0.55);
        const vib = this.ctx.createOscillator(); vib.frequency.value = 33; const vg = this.ctx.createGain(); vg.gain.value = 40;
        vib.connect(vg).connect(o1.frequency);
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o1.connect(g).connect(f);
        o1.start(t); vib.start(t); o1.stop(t + 0.65); vib.stop(t + 0.65);
        break;
      }
      case 'door_close':
        this.noiseBurst(t, 0.12, 0.2 * v, { type: 'lowpass', f: 600, dest: dest() });
        this.tone(90, 'sine', t, 0.15, 0.25 * v, { freqEnd: 50, dest: dest() });
        this.noiseBurst(t + 0.08, 0.03, 0.08 * v, { type: 'highpass', f: 3000, dest: dest() });
        break;
      case 'door_slam':
        this.noiseBurst(t, 0.35, 0.6 * v, { type: 'lowpass', f: 1200, fEnd: 200, dest: dest(0.6) });
        this.tone(70, 'sine', t, 0.45, 0.8 * v, { freqEnd: 30, dest: dest(0.6) });
        break;
      case 'locked':
        for (let i = 0; i < 3; i++) {
          this.noiseBurst(t + i * 0.09, 0.04, 0.2 * v, { type: 'bandpass', f: 2200, q: 3, dest: dest(0.1) });
          this.tone(320, 'square', t + i * 0.09, 0.03, 0.03 * v, { dest: dest(0.1) });
        }
        break;
      case 'unlock':
        this.noiseBurst(t, 0.04, 0.25 * v, { type: 'bandpass', f: 2600, q: 4, dest: dest(0.1) });
        this.noiseBurst(t + 0.16, 0.05, 0.3 * v, { type: 'bandpass', f: 1800, q: 4, dest: dest(0.1) });
        this.tone(1200, 'square', t + 0.16, 0.03, 0.04 * v, { dest: dest(0.1) });
        break;
      case 'pickup':
        this.tone(1318.5, 'sine', t, 0.9, 0.12 * v, { dest: dest(0.5) });
        this.tone(1975.5, 'sine', t + 0.08, 0.8, 0.06 * v, { dest: dest(0.5) });
        this.tone(2637, 'sine', t + 0.16, 0.6, 0.03 * v, { dest: dest(0.5) });
        break;
      case 'solve':
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => this.tone(f, 'triangle', t + i * 0.12, 0.8, 0.08 * v, { dest: dest(0.5) }));
        break;
      case 'save':
        this.tone(659.3, 'sine', t, 1.2, 0.08 * v, { dest: dest(0.6) });
        this.tone(987.8, 'sine', t + 0.15, 1.2, 0.06 * v, { dest: dest(0.6) });
        break;
      case 'sting': {
        const d = dest(0.5);
        this.noiseBurst(t, 1.2, 0.5 * v, { type: 'bandpass', f: 3000, fEnd: 500, q: 0.8, a: 0.01, dest: d });
        for (const f of [82.4, 87.3, 116.5, 123.5]) this.tone(f, 'sawtooth', t, 1.6, 0.14 * v, { dest: d });
        for (const f of [1975, 2093, 2794]) this.tone(f, 'sawtooth', t, 1.3, 0.04 * v, { freqEnd: f * 0.6, dest: d, a: 0.02 });
        this.tone(55, 'sine', t, 1.0, 0.7 * v, { freqEnd: 30, dest: d });
        break;
      }
      case 'scream': {
        const d = dest(0.6);
        const ws = this.ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 6); }
        ws.curve = curve; ws.connect(d);
        for (const [f0, f1, f2] of [[300, 1400, 240], [312, 1460, 250], [600, 2600, 400]]) {
          const o = this.ctx.createOscillator(); o.type = 'sawtooth';
          o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.25); o.frequency.exponentialRampToValueAtTime(f2, t + 1.8);
          const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * v, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
          o.connect(g).connect(ws); o.start(t); o.stop(t + 2);
        }
        this.noiseBurst(t, 1.6, 0.5 * v, { type: 'bandpass', f: 2000, fEnd: 400, q: 0.7, dest: d });
        this.tone(45, 'sine', t, 1.4, 0.9 * v, { freqEnd: 25, dest: d });
        break;
      }
      case 'thunder':
        this.noiseBurst(t, 0.25, 0.4 * v, { type: 'highpass', f: 1500, dest: dest(0.7) });
        this.noiseBurst(t + 0.05, 3.5, 0.5 * v, { type: 'lowpass', f: 300, fEnd: 60, a: 0.2, dest: dest(0.7), rate: 0.5 });
        break;
      case 'chime':
        [329.6, 261.6, 293.7, 196].forEach((f, i) => {
          this.tone(f, 'sine', t + i * 0.9, 2.4, 0.09 * v, { dest: dest(0.7) });
          this.tone(f * 2.76, 'sine', t + i * 0.9, 1.2, 0.025 * v, { dest: dest(0.7) });
        });
        break;
      case 'whisper':
        for (let i = 0; i < 6; i++) {
          const tt = t + i * 0.22 + Math.random() * 0.08;
          this.noiseBurst(tt, 0.2, 0.06 * v, { type: 'bandpass', f: 1800 + Math.random() * 2400, q: 5, a: 0.06, dest: dest(0.8) });
        }
        break;
      case 'giggle':
        for (let i = 0; i < 5; i++) {
          const tt = t + i * 0.14;
          this.tone(900 + (i % 2) * 120, 'triangle', tt, 0.1, 0.03 * v, { freqEnd: 760, dest: dest(0.9) });
          this.noiseBurst(tt, 0.08, 0.02 * v, { type: 'bandpass', f: 2500, q: 3, dest: dest(0.9) });
        }
        break;
      case 'crash':
        this.noiseBurst(t, 0.6, 0.4 * v, { type: 'highpass', f: 2500, dest: dest(0.6) });
        for (const f of [1820, 2470, 3150, 4100]) this.tone(f, 'sine', t, 0.5 + Math.random() * 0.5, 0.04 * v, { dest: dest(0.6) });
        this.tone(120, 'sine', t, 0.2, 0.3 * v, { freqEnd: 60, dest: dest(0.5) });
        break;
      case 'knock':
        for (let i = 0; i < 3; i++) {
          this.tone(150, 'sine', t + i * 0.32, 0.12, 0.4 * v, { freqEnd: 80, dest: dest(0.5) });
          this.noiseBurst(t + i * 0.32, 0.05, 0.15 * v, { type: 'lowpass', f: 900, dest: dest(0.5) });
        }
        break;
      case 'gurgle':
        for (let i = 0; i < 24; i++) {
          const tt = t + i * 0.09 + Math.random() * 0.05;
          const f = 200 + Math.random() * 500;
          this.tone(f, 'sine', tt, 0.08, 0.06 * v, { freqEnd: f * 1.8, dest: dest(0.4) });
        }
        this.noiseBurst(t, 2.4, 0.06 * v, { type: 'lowpass', f: 500, a: 0.3, dest: dest(0.4) });
        break;
      case 'drip': {
        const f = 1200 + Math.random() * 900;
        this.tone(f, 'sine', t, 0.12, 0.05 * v, { freqEnd: f * 0.5, dest: dest(0.9) });
        break;
      }
      case 'switch':
        this.noiseBurst(t, 0.05, 0.3 * v, { type: 'bandpass', f: 1500, q: 2, dest: dest(0.2) });
        this.tone(180, 'square', t, 0.05, 0.06 * v, { dest: dest(0.2) });
        break;
      case 'shutter':
        this.noiseBurst(t, 1.4, 0.3 * v, { type: 'bandpass', f: 900, q: 1, a: 0.1, dest: dest(0.5) });
        for (let i = 0; i < 12; i++) this.noiseBurst(t + i * 0.1, 0.04, 0.12 * v, { type: 'bandpass', f: 2400, q: 3, dest: dest(0.4) });
        this.noiseBurst(t + 1.4, 0.2, 0.5 * v, { type: 'lowpass', f: 700, dest: dest(0.6) });
        break;
      case 'gate':
        this.tone(220, 'sawtooth', t, 0.9, 0.06 * v, { freqEnd: 160, dest: dest(0.6) });
        this.noiseBurst(t, 0.9, 0.18 * v, { type: 'bandpass', f: 1400, q: 4, dest: dest(0.6) });
        this.noiseBurst(t + 0.9, 0.2, 0.5 * v, { type: 'lowpass', f: 900, dest: dest(0.6) });
        this.tone(95, 'sine', t + 0.9, 0.4, 0.5 * v, { freqEnd: 45, dest: dest(0.6) });
        break;
      case 'crumble':
        this.noiseBurst(t, 2.5, 0.6 * v, { type: 'lowpass', f: 500, fEnd: 120, a: 0.05, dest: dest(0.7), rate: 0.6 });
        for (let i = 0; i < 14; i++) this.noiseBurst(t + Math.random() * 2, 0.08, 0.2 * v, { type: 'bandpass', f: 600 + Math.random() * 2000, q: 2, dest: dest(0.5) });
        this.tone(40, 'sine', t, 2, 0.8 * v, { freqEnd: 25, dest: dest(0.4) });
        break;
      case 'hide':
        this.noiseBurst(t, 0.25, 0.12 * v, { type: 'bandpass', f: 800, q: 1, dest: dest(0.2) });
        this.tone(120, 'sine', t + 0.2, 0.1, 0.12 * v, { freqEnd: 70, dest: dest(0.2) });
        break;
      case 'book':
        this.noiseBurst(t, 0.12, 0.18 * v, { type: 'bandpass', f: 1200, q: 1, dest: dest(0.2) });
        this.tone(200, 'sine', t, 0.08, 0.15 * v, { freqEnd: 120, dest: dest(0.2) });
        break;
      case 'page':
        this.noiseBurst(t, 0.18, 0.08 * v, { type: 'highpass', f: 3000, a: 0.04, dest: dest(0.2) });
        break;
      case 'safe':
        this.noiseBurst(t, 0.06, 0.3 * v, { type: 'bandpass', f: 1600, q: 3, dest: dest(0.3) });
        this.tone(140, 'sawtooth', t + 0.1, 0.6, 0.06 * v, { freqEnd: 90, dest: dest(0.5) });
        this.noiseBurst(t + 0.1, 0.6, 0.1 * v, { type: 'bandpass', f: 700, q: 3, dest: dest(0.5) });
        break;
      case 'buzz':
        for (let i = 0; i < 6; i++) this.tone(120, 'square', t + i * 0.05 + Math.random() * 0.03, 0.04, 0.03 * v, { dest: dest(0.1) });
        break;
      case 'select':
        this.tone(880, 'triangle', t, 0.08, 0.06 * v, { dest: dest(0) });
        break;
      case 'cursor':
        this.tone(660, 'triangle', t, 0.04, 0.03 * v, { dest: dest(0) });
        break;
      case 'cancel':
        this.tone(440, 'triangle', t, 0.08, 0.05 * v, { freqEnd: 330, dest: dest(0) });
        break;
      case 'wrong':
        this.tone(140, 'square', t, 0.25, 0.08 * v, { dest: dest(0.1) });
        this.tone(147, 'square', t, 0.25, 0.08 * v, { dest: dest(0.1) });
        break;
    }
  }
}

export const Sound = new AudioEngine();
