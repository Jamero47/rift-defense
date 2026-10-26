// Soundeffekte – werden im Browser per Klang-Synthese erzeugt (Web Audio), es gibt noch keine Audiodateien.
// Später können hier echte Sounds geladen werden: Die Namen (SoundName) bleiben gleich, nur play() ändert sich.
// Browser erlauben Ton erst nach dem ersten Antippen; unlock() wird dafür beim ersten Tippen aufgerufen.

export type SoundName =
  | 'click' | 'build' | 'upgrade' | 'sell'
  | 'shootArrow' | 'shootHeavy' | 'shootMagic' | 'shootGlob' | 'shootGust' | 'zap'
  | 'explosion' | 'death' | 'bossDeath' | 'crystal' | 'gold' | 'rare'
  | 'waveStart' | 'waveClear' | 'cards' | 'ability' | 'gateHit' | 'harvest'
  | 'arrowRain' | 'victory' | 'defeat' | 'warpOut' | 'warpIn' | 'buildingDone' | 'error';

type Wave = OscillatorType;

/** Mindestabstand zwischen gleichen Sounds (Sekunden), damit es bei vielen Türmen nicht knattert */
const COOLDOWN: Partial<Record<SoundName, number>> = {
  shootArrow: 0.07, shootHeavy: 0.12, shootMagic: 0.1, shootGlob: 0.1, shootGust: 0.15, zap: 0.1,
  explosion: 0.1, death: 0.05, crystal: 0.06, gold: 0.08, harvest: 0.2, gateHit: 0.15, click: 0.04,
};

class SoundFx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private last = new Map<SoundName, number>();
  private enabled = true;
  /** Gesamtlautstärke 0–1 */
  volume = 0.45;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) this.unlock();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Muss nach einer Nutzer-Eingabe aufgerufen werden (Browser-Regel). */
  unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null; // kein Ton möglich – Spiel läuft trotzdem
    }
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const cd = COOLDOWN[name] ?? 0;
    if (cd > 0 && now - (this.last.get(name) ?? -1) < cd) return;
    this.last.set(name, now);
    const t = now + 0.005;
    switch (name) {
      case 'click': this.tone(t, 660, 0.05, 'triangle', 0.25, 880); break;
      case 'error': this.tone(t, 220, 0.12, 'square', 0.12, 160); this.tone(t + 0.1, 180, 0.15, 'square', 0.1, 140); break;
      case 'build':
        this.noise(t, 0.35, 0.25, 600, 'bandpass', 3000);
        this.tone(t, 220, 0.35, 'sine', 0.3, 660);
        this.tone(t + 0.25, 880, 0.15, 'triangle', 0.2);
        break;
      case 'upgrade': [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.06, f, 0.14, 'triangle', 0.22)); break;
      case 'sell': [784, 523].forEach((f, i) => this.tone(t + i * 0.08, f, 0.12, 'triangle', 0.2)); break;
      case 'shootArrow': this.noise(t, 0.08, 0.18, 2500, 'highpass', 6000); this.tone(t, 900, 0.06, 'triangle', 0.06, 500); break;
      case 'shootHeavy': this.tone(t, 140, 0.18, 'sine', 0.45, 50); this.noise(t, 0.12, 0.25, 900, 'lowpass', 200); break;
      case 'shootMagic': this.tone(t, 1200, 0.12, 'sine', 0.12, 1800); this.tone(t, 600, 0.12, 'triangle', 0.08, 900); break;
      case 'shootGlob': this.tone(t, 300, 0.1, 'sine', 0.22, 700); break;
      case 'shootGust': this.noise(t, 0.25, 0.18, 500, 'bandpass', 1800); break;
      case 'zap': this.tone(t, 1600, 0.09, 'sawtooth', 0.08, 300); this.noise(t, 0.08, 0.12, 4000, 'highpass'); break;
      case 'explosion': this.noise(t, 0.4, 0.45, 1200, 'lowpass', 120); this.tone(t, 90, 0.3, 'sine', 0.35, 40); break;
      case 'death': this.tone(t, 500, 0.08, 'square', 0.07, 180); break;
      case 'bossDeath':
        this.noise(t, 1.0, 0.5, 1500, 'lowpass', 80);
        this.tone(t, 120, 0.9, 'sawtooth', 0.2, 30);
        break;
      case 'crystal': this.tone(t, 1568 + Math.random() * 200, 0.08, 'sine', 0.1); break;
      case 'gold': this.tone(t, 1319, 0.06, 'square', 0.06); this.tone(t + 0.05, 1760, 0.1, 'square', 0.06); break;
      case 'rare': [880, 1109, 1319, 1760, 2217].forEach((f, i) => this.tone(t + i * 0.05, f, 0.2, 'sine', 0.15)); break;
      case 'waveStart':
        this.tone(t, 196, 0.5, 'sawtooth', 0.12, 196);
        this.tone(t + 0.02, 294, 0.5, 'sawtooth', 0.08, 294);
        this.tone(t + 0.45, 392, 0.6, 'sawtooth', 0.12, 392);
        break;
      case 'waveClear': [523, 659, 784].forEach((f, i) => this.tone(t + i * 0.09, f, 0.25, 'triangle', 0.2)); break;
      case 'cards': [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(t + i * 0.07, f, 0.3, 'sine', 0.1)); break;
      case 'ability':
        this.tone(t, 440, 0.4, 'sine', 0.15, 880);
        this.tone(t + 0.05, 660, 0.35, 'triangle', 0.1, 1320);
        this.noise(t, 0.3, 0.08, 3000, 'bandpass', 6000);
        break;
      case 'gateHit': this.tone(t, 80, 0.25, 'sine', 0.5, 40); this.noise(t, 0.15, 0.3, 400, 'lowpass'); break;
      case 'harvest': this.noise(t, 0.06, 0.25, 1500, 'bandpass'); this.noise(t + 0.12, 0.06, 0.2, 1300, 'bandpass'); break;
      case 'arrowRain': for (let i = 0; i < 6; i++) this.noise(t + i * 0.07, 0.1, 0.15, 3000, 'highpass', 7000); break;
      case 'buildingDone': [392, 523, 659, 784].forEach((f, i) => this.tone(t + i * 0.08, f, 0.3, 'triangle', 0.18)); break;
      case 'victory': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(t + i * 0.13, f, i === 5 ? 0.8 : 0.2, 'triangle', 0.22)); break;
      case 'defeat': [392, 349, 311, 262].forEach((f, i) => this.tone(t + i * 0.22, f, 0.4, 'sawtooth', 0.1)); break;
      case 'warpOut':
        this.tone(t, 110, 1.3, 'sawtooth', 0.12, 1400);
        this.tone(t, 220, 1.3, 'sine', 0.15, 2200);
        this.noise(t, 1.3, 0.25, 200, 'bandpass', 5000);
        break;
      case 'warpIn':
        this.tone(t, 1400, 1.1, 'sawtooth', 0.08, 110);
        this.tone(t, 2000, 1.1, 'sine', 0.12, 160);
        this.noise(t, 1.1, 0.25, 5000, 'bandpass', 200);
        this.tone(t + 0.95, 80, 0.4, 'sine', 0.35, 40);
        break;
    }
  }

  /** Einzelner Ton mit kurzem Ein- und Ausblenden; optional gleitet die Tonhöhe zu `slideTo`. */
  private tone(t: number, freq: number, dur: number, wave: Wave, vol: number, slideTo?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Rauschen durch einen Filter (Zischen, Knall, Wind); optional gleitet die Filterfrequenz. */
  private noise(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType, slideTo?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}

export const sfx = new SoundFx();
