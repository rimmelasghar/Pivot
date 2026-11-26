import { Quaternion, Vector3 } from "three";
import type { QuatArray } from "./euler";

/**
 * Map a rotation from the phone's heading-aligned Earth frame (X right, Y forward, Z up)
 * into three.js scene axes (X right, Y up, Z towards the viewer). Basis change
 * (x, y, z) → (x, z, −y); for a quaternion the vector part maps the same way.
 * This is the only place phone axes meet scene axes.
 */
export function phoneToScene(q: Quaternion, out: Quaternion): Quaternion {
  return out.set(q.x, q.z, -q.y, q.w);
}

const UP = new Vector3(0, 0, 1);
const SCENE_UP_TWIST = new Quaternion();

/**
 * Remove the twist around scene Y (yaw) from `q` in place, keeping only the tilt.
 * Swing-twist decomposition with q = twist · swing (twist about the world up axis).
 */
export function removeYaw(q: Quaternion): Quaternion {
  const len = Math.hypot(q.y, q.w);
  if (len < 1e-9) return q; // pure 180° tilt: no defined twist
  SCENE_UP_TWIST.set(0, q.y / len, 0, q.w / len).invert();
  return q.premultiply(SCENE_UP_TWIST);
}

/**
 * Turns absolute phone orientations into the rotation to apply to the model, relative to a
 * neutral pose. The change is measured in the world frame and expressed relative to the
 * phone's heading at calibration, so it does not depend on how the phone is held:
 * turning it left/right spins the model around vertical, tilting it away tilts the model away.
 *
 * Allocation-free after construction (safe for useFrame / per-message use).
 */
export class Calibrator {
  calibrated = false;
  private readonly refInv = new Quaternion();
  private readonly heading = new Quaternion();
  private readonly headingInv = new Quaternion();
  private readonly t = new Quaternion();
  private readonly t2 = new Quaternion();
  private readonly v = new Vector3();

  /** Make `q` the neutral pose. */
  calibrate(q: QuatArray): void {
    this.refInv.set(q[0], q[1], q[2], q[3]).normalize();
    // Forward = the phone's top and back combined: stays horizontal-ish whether the phone
    // lies flat (top points forward) or stands upright (back points forward).
    this.v.set(0, 1, -1).applyQuaternion(this.refInv);
    const horizontal = Math.hypot(this.v.x, this.v.y);
    const yaw = horizontal < 1e-6 ? 0 : Math.atan2(-this.v.x, this.v.y);
    this.heading.setFromAxisAngle(UP, yaw);
    this.headingInv.copy(this.heading).invert();
    this.refInv.invert();
    this.calibrated = true;
  }

  /** Rotation to apply to the model for phone orientation `q`. Writes into `out`. */
  apply(q: QuatArray, tiltOnly: boolean, out: Quaternion): Quaternion {
    // World-frame change since calibration: Δ = q · ref⁻¹
    this.t.set(q[0], q[1], q[2], q[3]).normalize().multiply(this.refInv);
    // Express it in the heading-aligned frame: H⁻¹ · Δ · H
    this.t2.copy(this.headingInv).multiply(this.t).multiply(this.heading);
    phoneToScene(this.t2, out);
    if (tiltOnly) removeYaw(out);
    return out;
  }
}
