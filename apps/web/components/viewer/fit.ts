import { Box3, Vector3, type Object3D } from "three";

/** Uniform scale that fits an object's bounding box inside a unit cube. */
export function fitScale(object: Object3D, target = 1): number {
  const size = new Box3().setFromObject(object).getSize(new Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  return largest > 0 && Number.isFinite(largest) ? target / largest : 1;
}
