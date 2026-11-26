import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { eulerToQuat, type QuatArray } from "./euler";
import { Calibrator, phoneToScene, removeYaw } from "./quat";

const DEG = Math.PI / 180;
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

const axisAngle = (axis: Vector3, deg: number) =>
  new Quaternion().setFromAxisAngle(axis, deg * DEG);
const phone = (alpha: number, beta: number, gamma: number) =>
  eulerToQuat(alpha, beta, gamma, [0, 0, 0, 1]);

function expectRotation(actual: Quaternion, expected: Quaternion) {
  // q and -q are the same rotation; angleTo handles that.
  expect(actual.angleTo(expected)).toBeLessThan(1e-6);
}

function applied(neutral: QuatArray, now: QuatArray, tiltOnly = false) {
  const c = new Calibrator();
  c.calibrate(neutral);
  return c.apply(now, tiltOnly, new Quaternion());
}

describe("phoneToScene", () => {
  it("maps Earth up (Z) to scene up (Y)", () => {
    expectRotation(phoneToScene(axisAngle(Z, 40), new Quaternion()), axisAngle(Y, 40));
  });

  it("maps forward (Y) to into the screen (−Z)", () => {
    expectRotation(phoneToScene(axisAngle(Y, 40), new Quaternion()), axisAngle(Z, -40));
  });

  it("keeps right as right (X)", () => {
    expectRotation(phoneToScene(axisAngle(X, 40), new Quaternion()), axisAngle(X, 40));
  });
});

describe("Calibrator", () => {
  it("is identity at the neutral pose", () => {
    for (const pose of [phone(0, 0, 0), phone(123, 45, -30), phone(-70, 90, 10)]) {
      expectRotation(applied(pose, pose), new Quaternion());
    }
  });

  it("turning a flat phone left spins the model left around vertical", () => {
    expectRotation(applied(phone(0, 0, 0), phone(30, 0, 0)), axisAngle(Y, 30));
  });

  it("gives the same result for an upright phone facing any direction", () => {
    // Upright (beta 90), facing east (alpha −90), turned 30° left.
    expectRotation(applied(phone(-90, 90, 0), phone(-60, 90, 0)), axisAngle(Y, 30));
    // Upright facing south-west.
    expectRotation(applied(phone(135, 90, 0), phone(165, 90, 0)), axisAngle(Y, 30));
  });

  it("tilting the top up tilts the model's front up (around X)", () => {
    expectRotation(applied(phone(0, 0, 0), phone(0, 20, 0)), axisAngle(X, 20));
    expectRotation(applied(phone(-90, 90, 0), phone(-90, 110, 0)), axisAngle(X, 20));
  });

  it("rolling the phone right rolls the model right (around −Z)", () => {
    expectRotation(applied(phone(50, 0, 0), phone(50, 0, 20)), axisAngle(Z, -20));
  });

  it("recalibrating makes the current pose neutral", () => {
    const c = new Calibrator();
    c.calibrate(phone(0, 0, 0));
    c.calibrate(phone(40, 30, 0));
    expectRotation(c.apply(phone(40, 30, 0), false, new Quaternion()), new Quaternion());
  });

  it("tilt-only ignores turning left/right", () => {
    expectRotation(applied(phone(0, 0, 0), phone(60, 0, 0), true), new Quaternion());
    expectRotation(applied(phone(0, 0, 0), phone(0, 20, 0), true), axisAngle(X, 20));
  });
});

describe("removeYaw", () => {
  it("keeps the tilt of a yaw-then-tilt rotation", () => {
    const tilt = axisAngle(X, 25);
    const q = axisAngle(Y, 70).multiply(tilt);
    const swing = removeYaw(q.clone());
    // What remains has no rotation around Y.
    expect(Math.abs(swing.y)).toBeLessThan(1e-9);
    // And tilts the up axis by the same amount.
    expect(Y.clone().applyQuaternion(swing).angleTo(Y)).toBeCloseTo(25 * DEG, 9);
  });
});
