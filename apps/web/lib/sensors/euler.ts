/**
 * Canonical phone orientation: a quaternion [x, y, z, w] rotating device coordinates
 * (X right, Y top of screen, Z out of screen) into Earth coordinates (X east, Y north, Z up).
 * This is the W3C DeviceOrientation / RelativeOrientationSensor convention, so both
 * sensor sources produce the same frame and phoneToScene() is the only axis mapping.
 */
export type QuatArray = [number, number, number, number];

const DEG = Math.PI / 180;

/**
 * deviceorientation alpha/beta/gamma (degrees) to the canonical quaternion.
 * W3C defines R = Rz(alpha) · Rx(beta) · Ry(gamma) (intrinsic Z-X'-Y'').
 * Writes into `out` (no allocation) and returns it.
 */
export function eulerToQuat(alpha: number, beta: number, gamma: number, out: QuatArray): QuatArray {
  const a = (alpha * DEG) / 2;
  const b = (beta * DEG) / 2;
  const g = (gamma * DEG) / 2;
  const ca = Math.cos(a), sa = Math.sin(a); // prettier-ignore
  const cb = Math.cos(b), sb = Math.sin(b); // prettier-ignore
  const cg = Math.cos(g), sg = Math.sin(g); // prettier-ignore
  // qz(a) * qx(b) * qy(g)
  out[0] = ca * sb * cg - sa * cb * sg;
  out[1] = ca * cb * sg + sa * sb * cg;
  out[2] = ca * sb * sg + sa * cb * cg;
  out[3] = ca * cb * cg - sa * sb * sg;
  return out;
}

/**
 * Correct for screen rotation (screen.orientation.angle, degrees): q · Rz(-angle).
 * Afterwards X/Y follow the screen as the user sees it, not the hardware axes.
 */
export function screenCorrect(q: QuatArray, angle: number, out: QuatArray): QuatArray {
  if (!angle) {
    out[0] = q[0];
    out[1] = q[1];
    out[2] = q[2];
    out[3] = q[3];
    return out;
  }
  const h = (-angle * DEG) / 2;
  const sz = Math.sin(h);
  const cz = Math.cos(h);
  const [x, y, z, w] = q;
  // q * (0, 0, sz, cz)
  out[0] = x * cz + y * sz;
  out[1] = y * cz - x * sz;
  out[2] = z * cz + w * sz;
  out[3] = w * cz - z * sz;
  return out;
}
