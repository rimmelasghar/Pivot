import { describe, expect, it } from "vitest";
import { eulerToQuat, type QuatArray } from "./euler";
import { angleBetween, MotionThrottle, round5 } from "./throttle";

const q = (alpha: number): QuatArray => eulerToQuat(alpha, 0, 0, [0, 0, 0, 1]);

describe("angleBetween", () => {
  it("measures rotation angle in degrees", () => {
    expect(angleBetween(q(0), q(30))).toBeCloseTo(30, 6);
    expect(angleBetween(q(10), q(10))).toBeCloseTo(0, 4);
  });

  it("treats q and -q as equal", () => {
    const a = q(20);
    const neg: QuatArray = [-a[0], -a[1], -a[2], -a[3]];
    expect(angleBetween(a, neg)).toBeCloseTo(0, 4);
  });
});

describe("MotionThrottle", () => {
  it("sends at most 60 messages per second", () => {
    const t = new MotionThrottle();
    let sent = 0;
    // A 120 Hz screen calling every 8.33 ms for one second, phone always moving.
    for (let i = 0; i < 120; i++) if (t.shouldSend(q(i), i * (1000 / 120))) sent++;
    expect(sent).toBeLessThanOrEqual(60);
    expect(sent).toBeGreaterThanOrEqual(55);
  });

  it("sends nothing while the phone is still", () => {
    const t = new MotionThrottle();
    expect(t.shouldSend(q(5), 0)).toBe(true);
    let sent = 0;
    for (let i = 1; i <= 60; i++) if (t.shouldSend(q(5 + 0.05 * Math.sin(i)), i * 17)) sent++;
    expect(sent).toBe(0);
  });

  it("sends when the rotation changes by 0.1° or more", () => {
    const t = new MotionThrottle();
    t.shouldSend(q(0), 0);
    expect(t.shouldSend(q(0.09), 20)).toBe(false);
    expect(t.shouldSend(q(0.11), 40)).toBe(true);
  });

  it("reset forces the next send", () => {
    const t = new MotionThrottle();
    t.shouldSend(q(0), 0);
    t.reset();
    expect(t.shouldSend(q(0), 1)).toBe(true);
  });
});

describe("round5", () => {
  it("rounds to 5 decimals", () => {
    expect(round5(0.123456789)).toBe(0.12346);
  });
});
