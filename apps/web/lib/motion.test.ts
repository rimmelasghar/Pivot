import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  createMotionStore,
  handlePhoneMessage,
  onPhoneConnected,
  resetPose,
  smoothingAlpha,
} from "./motion";
import { eulerToQuat } from "./sensors/euler";

const DEG = Math.PI / 180;
const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const rot = (axis: Vector3, deg: number) => new Quaternion().setFromAxisAngle(axis, deg * DEG);
const q = (alpha: number, beta = 0, gamma = 0, s = 0) => ({
  t: "q" as const,
  q: eulerToQuat(alpha, beta, gamma, [0, 0, 0, 1]),
  s,
  ts: 0,
});

function expectTarget(store: ReturnType<typeof createMotionStore>, expected: Quaternion) {
  expect(store.getState().target.angleTo(expected)).toBeLessThan(1e-6);
}

describe("motion store", () => {
  it("calibrates on the first q, then follows the phone", () => {
    const store = createMotionStore();
    handlePhoneMessage(q(40, 0, 0, 0), store);
    expectTarget(store, new Quaternion());
    handlePhoneMessage(q(70, 0, 0, 1), store);
    expectTarget(store, rot(Y, 30));
  });

  it("drops messages with a lower seq", () => {
    const store = createMotionStore();
    handlePhoneMessage(q(0, 0, 0, 5), store);
    handlePhoneMessage(q(30, 0, 0, 6), store);
    handlePhoneMessage(q(90, 0, 0, 4), store);
    expectTarget(store, rot(Y, 30));
  });

  it("recenter makes the current pose neutral", () => {
    const store = createMotionStore();
    handlePhoneMessage(q(0, 0, 0, 0), store);
    handlePhoneMessage(q(30, 0, 0, 1), store);
    handlePhoneMessage({ t: "recenter" }, store);
    expectTarget(store, new Quaternion());
    handlePhoneMessage(q(40, 0, 0, 2), store);
    expectTarget(store, rot(Y, 10));
  });

  it("tilt-only ignores turning left/right", () => {
    const store = createMotionStore();
    handlePhoneMessage(q(0, 0, 0, 0), store);
    handlePhoneMessage({ t: "mode", mode: "tilt" }, store);
    handlePhoneMessage(q(50, 0, 0, 1), store);
    expectTarget(store, new Quaternion());
    handlePhoneMessage({ t: "mode", mode: "full" }, store);
    expectTarget(store, rot(Y, 50));
  });

  it("keeps the pose when a phone reconnects with a new sensor frame", () => {
    const store = createMotionStore();
    handlePhoneMessage(q(0, 0, 0, 0), store);
    handlePhoneMessage(q(30, 0, 0, 1), store);
    onPhoneConnected(store);
    // New connection: seq restarts and the sensor's yaw reference changed.
    handlePhoneMessage(q(200, 0, 0, 0), store);
    expectTarget(store, rot(Y, 30));
    handlePhoneMessage(q(200, 20, 0, 1), store);
    expectTarget(store, rot(Y, 30).multiply(rot(X, 20)));
  });

  it("resetPose returns to neutral", () => {
    const store = createMotionStore();
    handlePhoneMessage(q(0, 0, 0, 0), store);
    handlePhoneMessage(q(30, 0, 0, 1), store);
    resetPose(store);
    expect(store.getState().hasTarget).toBe(false);
    handlePhoneMessage(q(80, 0, 0, 2), store);
    expectTarget(store, new Quaternion());
  });
});

describe("smoothingAlpha", () => {
  it("is frame-rate independent", () => {
    // Two 60 Hz frames move as far as one 30 Hz frame.
    const a60 = smoothingAlpha(1 / 60);
    const twoFrames = 1 - (1 - a60) ** 2;
    expect(twoFrames).toBeCloseTo(smoothingAlpha(1 / 30), 12);
  });
});
