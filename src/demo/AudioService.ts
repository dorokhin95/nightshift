import type { BoardEvent } from '../game/core/types.js';
/** Small original synthesized SFX: no remote files or licensed samples. */
export class AudioService {
  private context: AudioContext | null = null;
  private voices = 0;
  enabled = true;
  volume = 0.3;
  async unlock(): Promise<void> {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
    } catch { this.enabled = false; }
  }
  async suspend(): Promise<void> {
    if (this.context?.state === 'running') await this.context.suspend().catch(() => undefined);
  }
  private tone(frequency: number, end: number, duration: number, type: OscillatorType = 'sine', delay = 0): void {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== 'running' || this.voices >= 12) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(0.001, start); gain.gain.exponentialRampToValueAtTime(Math.max(0.001, this.volume * 0.16), start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain); gain.connect(ctx.destination); this.voices++;
    osc.onended = () => { osc.disconnect(); gain.disconnect(); this.voices--; };
    osc.start(start); osc.stop(start + duration + 0.02);
  }
  invalid(): void { this.tone(170, 100, 0.12, 'triangle'); }
  play(event: BoardEvent): void {
    if (event.type === 'swap') this.tone(400, 620, 0.07);
    if (event.type === 'clear') this.tone(480 + event.cascade * 50, 800, 0.1, 'triangle');
    if (event.type === 'special-created') {
      [0, 1, 2].forEach(i => this.tone(520 * (1 + i * 0.25), 800 * (1 + i * 0.25), 0.12, 'sine', i * 0.035));
    }
    if (event.type === 'special-activated') {
      if (event.kind === 'bomb') this.tone(100, 25, 0.23, 'triangle');
      else if (event.kind === 'lightning') this.tone(1400, 220, 0.12, 'sawtooth');
      else this.tone(280, 1500, 0.13, 'triangle');
    }
    if (event.type === 'combo') {
      if (event.name.includes('bomb')) this.tone(160, 28, 0.3, 'triangle');
      this.tone(300, 1100, 0.23, 'triangle'); this.tone(600, 1700, 0.18, 'sine', 0.05);
    }
  }
}
