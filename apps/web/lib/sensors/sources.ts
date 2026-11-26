import { eulerToQuat, screenCorrect, type QuatArray } from "./euler";

export type SourceKind = "relative-sensor" | "deviceorientation";

/** Called with the canonical quaternion (see euler.ts). `q` is reused: copy it if you keep it. */
export type ReadingHandler = (q: QuatArray) => void;

export interface SensorSource {
  kind: SourceKind;
  stop(): void;
}

export const NO_DATA_TIMEOUT_MS = 2000;
/** If the Generic Sensor API is present but silent this long, try deviceorientation instead. */
const RELATIVE_GRACE_MS = 1000;

function screenAngle(): number {
  if (typeof screen !== "undefined" && screen.orientation) return screen.orientation.angle;
  const legacy = (globalThis as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

interface GenericSensor extends EventTarget {
  quaternion: number[] | null;
  start(): void;
  stop(): void;
}
type SensorCtor = new (opts: { frequency: number; referenceFrame: "device" }) => GenericSensor;

/** Chromium (Android): RelativeOrientationSensor gives a quaternion directly. */
function startRelativeSensor(onReading: ReadingHandler, onFail: () => void): SensorSource | null {
  const Ctor = (globalThis as { RelativeOrientationSensor?: SensorCtor }).RelativeOrientationSensor;
  if (!Ctor) return null;
  let sensor: GenericSensor;
  try {
    sensor = new Ctor({ frequency: 60, referenceFrame: "device" });
  } catch {
    return null;
  }
  const raw: QuatArray = [0, 0, 0, 1];
  const out: QuatArray = [0, 0, 0, 1];
  sensor.addEventListener("reading", () => {
    const q = sensor.quaternion;
    if (!q) return;
    raw[0] = q[0];
    raw[1] = q[1];
    raw[2] = q[2];
    raw[3] = q[3];
    onReading(screenCorrect(raw, screenAngle(), out));
  });
  sensor.addEventListener("error", onFail);
  sensor.start();
  return { kind: "relative-sensor", stop: () => sensor.stop() };
}

/** iOS, Firefox and fallback: deviceorientation alpha/beta/gamma. */
function startDeviceOrientation(onReading: ReadingHandler): SensorSource | null {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return null;
  const raw: QuatArray = [0, 0, 0, 1];
  const out: QuatArray = [0, 0, 0, 1];
  const handler = (e: DeviceOrientationEvent) => {
    // Desktop browsers fire once with nulls: that is not data.
    if (e.alpha === null || e.beta === null || e.gamma === null) return;
    eulerToQuat(e.alpha, e.beta, e.gamma, raw);
    onReading(screenCorrect(raw, screenAngle(), out));
  };
  window.addEventListener("deviceorientation", handler);
  return {
    kind: "deviceorientation",
    stop: () => window.removeEventListener("deviceorientation", handler),
  };
}

export interface StartOptions {
  onReading: ReadingHandler;
  onSource?: (kind: SourceKind) => void;
  /** No source produced data within NO_DATA_TIMEOUT_MS. */
  onNoSensor: () => void;
}

/** Start the best available source, falling back automatically. Returns a stop function. */
export function startSensors({ onReading, onSource, onNoSensor }: StartOptions): () => void {
  let source: SensorSource | null = null;
  let gotData = false;
  let fellBack = false;

  const reading: ReadingHandler = (q) => {
    if (!gotData) {
      gotData = true;
      if (source) onSource?.(source.kind);
    }
    onReading(q);
  };

  const fallback = () => {
    if (fellBack || gotData) return;
    fellBack = true;
    source?.stop();
    source = startDeviceOrientation(reading);
  };

  source = startRelativeSensor(reading, fallback);
  const grace = source ? setTimeout(fallback, RELATIVE_GRACE_MS) : null;
  if (!source) fallback();

  const noData = setTimeout(() => !gotData && onNoSensor(), NO_DATA_TIMEOUT_MS);

  return () => {
    if (grace) clearTimeout(grace);
    clearTimeout(noData);
    source?.stop();
    source = null;
  };
}

/** iOS 13+ needs an explicit permission prompt, triggered from a user tap. */
export async function requestMotionPermission(): Promise<"granted" | "denied"> {
  const DOE = (
    globalThis as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<"granted" | "denied"> };
    }
  ).DeviceOrientationEvent;
  if (typeof DOE?.requestPermission !== "function") return "granted";
  try {
    return await DOE.requestPermission();
  } catch {
    return "denied";
  }
}
