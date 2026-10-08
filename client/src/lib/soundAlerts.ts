/**
 * Sound Alert System for Kitchen & POS Stations
 * Uses Web Audio API for zero-external-dependency, self-contained chime synthesis.
 * Complies with browser autoplay restrictions: audio context initializes/resumes on user interaction.
 */

let audioCtx: AudioContext | null = null;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export const soundAlerts = {
  /**
   * Initializes audio context upon explicit user click/tap (e.g. "Enable Sound" button).
   */
  async enableAudio(): Promise<boolean> {
    try {
      const ctx = getAudioContext();
      if (!ctx) return false;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Play a short silent blip to ensure playback is fully unlocked
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
      return true;
    } catch {
      return false;
    }
  },

  setMuted(muted: boolean): void {
    isMuted = muted;
  },

  isMuted(): boolean {
    return isMuted;
  },

  isAudioUnlocked(): boolean {
    return !!audioCtx && audioCtx.state === 'running';
  },

  /**
   * Upbeat ascending chime for new KOT arrival (D5 -> A5).
   */
  playNewTicketSound(): void {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      // Tone 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Tone 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880.0, now + 0.12);
      gain2.gain.setValueAtTime(0.35, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch {
      // Audio autoplay restriction or device without audio
    }
  },

  /**
   * Distinct warning pulse for cancelled item (E4 -> A3 descending alert).
   */
  playCancelledItemSound(): void {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(329.63, now); // E4
      osc.frequency.exponentialRampToValueAtTime(220.0, now + 0.4); // A3
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Audio autoplay restriction
    }
  },

  /**
   * Soft bell chime for Waiter ready-to-serve notification.
   */
  playReadyToServeSound(): void {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now); // G5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Audio failure
    }
  },

  /**
   * Distinct, bright 3-tone arpeggio and vibration for incoming customer self-orders.
   * Distinct from kitchen ticket sound.
   */
  playCustomerOrderSound(): void {
    if (isMuted) return;

    // Haptic vibration (feature-detected and respects reduced-motion preference)
    try {
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReducedMotion) {
          navigator.vibrate([200, 100, 200]);
        }
      }
    } catch {
      // Vibration not supported or blocked
    }

    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      // 3 ascending melodic chime tones: A5 (880Hz), D6 (1174.66Hz), A6 (1760Hz)
      const freqs = [880, 1174.66, 1760];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.12;
        const duration = 0.3;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } catch {
      // Audio autoplay or synthesis failure
    }
  },
};

