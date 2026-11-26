import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh } from "three";
import { fitScale } from "./fit";

describe("fitScale", () => {
  it("scales the largest dimension to 1", () => {
    const mesh = new Mesh(new BoxGeometry(4, 2, 1));
    expect(fitScale(mesh)).toBeCloseTo(0.25);
  });

  it("returns 1 for empty objects", () => {
    expect(fitScale(new Group())).toBe(1);
  });
});
