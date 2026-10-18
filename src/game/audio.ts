export class SoundEngine {
  private ctx: AudioContext | null = null;
  public isMuted = false;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public playHoofbeat(surface: 'grass' | 'wood' | 'water', speedRatio: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.065);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, 2.2);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    if (surface === 'water') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(950 + Math.random() * 300, now);
      filter.Q.setValueAtTime(1.8, now);
    } else if (surface === 'wood') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(320 + Math.random() * 90, now);
      filter.Q.setValueAtTime(4.5, now);
    } else {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(210 + speedRatio * 120 + Math.random() * 50, now);
    }

    const gain = ctx.createGain();
    const vol = Math.min(0.28, 0.09 + speedRatio * 0.16);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  public playFootstep(inWater: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.045);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.5);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = inWater ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(inWater ? 1100 : 280, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playSwordSwing(isHeavy = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Whoosh noise
    const dur = isHeavy ? 0.22 : 0.15;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isHeavy ? 420 : 620, now);
    filter.frequency.exponentialRampToValueAtTime(isHeavy ? 180 : 260, now + dur);
    filter.Q.setValueAtTime(2.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playSteelImpact(isCrit = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = isCrit ? [880, 1420, 2180, 3120] : [640, 1180, 1890];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f + (Math.random() - 0.5) * 40, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.85, now + 0.24);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime((isCrit ? 0.14 : 0.1) / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.32 : 0.2));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
    });
  }

  public playShieldBlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playBowRelease(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Bowstring twang
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playWhistleSummon(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1350, now);
    osc.frequency.linearRampToValueAtTime(1920, now + 0.18);
    osc.frequency.linearRampToValueAtTime(1580, now + 0.38);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.44);
  }

  public playQuestHorn(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep Anatolian battle horn chord
    const notes = [146.83, 220.0, 293.66]; // D3, A3, D4
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09 / (i + 1), now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.3);
    });
  }
}
