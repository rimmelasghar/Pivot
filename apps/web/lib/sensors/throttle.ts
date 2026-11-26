import type { QuatArray } from "./euler";

export const MAX_RATE_HZ = 60;
export const MIN_CHANGE_DEG = 0.1;

/** Rotation angle between two unit quaternions, in degrees. */
export function angleBetween(a: QuatArray, b: QuatArray): number {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return ((2 * Math.acos(Math.min(1, dot))) / Math.PI) * 180;
}

/**
 * Decides when the phone sends an orientation: at most MAX_RATE_HZ, and only when the
 * rotation changed by at least MIN_CHANGE_DEG since the last sent one.
 */
export class MotionThrottle {
  private readonly last: QuatArray = [0, 0, 0, 1];
  private lastAt = -Infinity;
  private hasSent = false;

  constructor(
    private readonly minIntervalMs = 1000 / MAX_RATE_HZ,
    private readonly minChangeDeg = MIN_CHANGE_DEG,
  ) {}

  /** Returns true (and records q) if q should be sent now. */
  shouldSend(q: QuatArray, now: number): boolean {
    // 1 ms tolerance: rAF timestamps jitter around 16.67 ms on 60 Hz screens.
    if (now - this.lastAt < this.minIntervalMs - 1) return false;
    if (this.hasSent && angleBetween(this.last, q) < this.minChangeDeg) return false;
    this.last[0] = q[0];
    this.last[1] = q[1];
    this.last[2] = q[2];
    this.last[3] = q[3];
    this.lastAt = now;
    this.hasSent = true;
    return true;
  }

  /** Force the next reading to be sent (e.g. after reconnecting). */
  reset(): void {
    this.hasSent = false;
    this.lastAt = -Infinity;
  }
}

/** Round to keep messages small; 1e-5 is far below sensor noise. */
export const round5 = (v: number) => Math.round(v * 1e5) / 1e5;
