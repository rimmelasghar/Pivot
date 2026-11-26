import { describe, expect, it } from "vitest";
import { Euler, Quaternion, Vector3 } from "three";
import { eulerToQuat, screenCorrect, type QuatArray } from "./euler";

const DEG = Math.PI / 180;
const toThree = (q: QuatArray) => new Quaternion(q[0], q[1], q[2], q[3]);
const rotate = (q: QuatArray, v: [number, number, number]) =>
  new Vector3(...v).applyQuaternion(toThree(q));

function expectVec(v: Vector3, x: number, y: number, z: number) {
  expect(v.x).toBeCloseTo(x, 6);
  expect(v.y).toBeCloseTo(y, 6);
  expect(v.z).toBeCloseTo(z, 6);
}

describe("eulerToQuat", () => {
  const out: QuatArray = [0, 0, 0, 1];

  it("is identity for a phone lying flat, top pointing north", () => {
    expect(eulerToQuat(0, 0, 0, out)).toEqual([0, 0, 0, 1]);
  });

  it("matches three.js Euler order ZXY", () => {
    const [a, b, g] = [30, 50, -20];
    const expected = new Quaternion().setFromEuler(new Euler(b * DEG, g * DEG, a * DEG, "ZXY"));
    const q = eulerToQuat(a, b, g, out);
    expect(q[0]).toBeCloseTo(expected.x, 9);
    expect(q[1]).toBeCloseTo(expected.y, 9);
    expect(q[2]).toBeCloseTo(expected.z, 9);
    expect(q[3]).toBeCloseTo(expected.w, 9);
  });

  it("alpha turns the phone around the up axis", () => {
    // Top of the phone (device Y) points west after turning 90° counter-clockwise.
    expectVec(rotate(eulerToQuat(90, 0, 0, out), [0, 1, 0]), -1, 0, 0);
  });

  it("beta 90 stands the phone upright", () => {
    // Top points up, screen faces south (towards the user holding it facing north).
    expectVec(rotate(eulerToQuat(0, 90, 0, out), [0, 1, 0]), 0, 0, 1);
    expectVec(rotate(eulerToQuat(0, 90, 0, out), [0, 0, 1]), 0, -1, 0);
  });

  it("gamma tilts the phone left/right", () => {
    // Right edge (device X) dips down for positive gamma.
    expectVec(rotate(eulerToQuat(0, 0, 90, out), [1, 0, 0]), 0, 0, -1);
  });
});

describe("screenCorrect", () => {
  it("is a no-op for portrait", () => {
    const out: QuatArray = [0, 0, 0, 1];
    expect(screenCorrect([0.1, 0.2, 0.3, 0.9], 0, out)).toEqual([0.1, 0.2, 0.3, 0.9]);
  });

  it("follows the screen in landscape (angle 90)", () => {
    // Phone turned 90° counter-clockwise: screen right = hardware -Y, screen up = hardware X.
    const out: QuatArray = [0, 0, 0, 1];
    const q = screenCorrect([0, 0, 0, 1], 90, out);
    expectVec(rotate(q, [1, 0, 0]), 0, -1, 0);
    expectVec(rotate(q, [0, 1, 0]), 1, 0, 0);
  });
});
