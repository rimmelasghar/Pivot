import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuatArray } from "./euler";
import { requestMotionPermission, startSensors } from "./sources";

type Listener = (e: unknown) => void;

class FakeWindow {
  listeners: Record<string, Listener[]> = {};
  DeviceOrientationEvent = {};
  addEventListener(type: string, fn: Listener) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== fn);
  }
  emit(type: string, e: unknown) {
    for (const l of this.listeners[type] ?? []) l(e);
  }
}

class FakeSensor extends EventTarget {
  static instances: FakeSensor[] = [];
  quaternion: number[] | null = null;
  started = false;
  constructor() {
    super();
    FakeSensor.instances.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.started = false;
  }
  push(q: number[]) {
    this.quaternion = q;
    this.dispatchEvent(new Event("reading"));
  }
}

let win: FakeWindow;
const g = globalThis as Record<string, unknown>;

beforeEach(() => {
  vi.useFakeTimers();
  win = new FakeWindow();
  g.window = win;
  FakeSensor.instances = [];
});
afterEach(() => {
  vi.useRealTimers();
  delete g.window;
  delete g.RelativeOrientationSensor;
  delete g.DeviceOrientationEvent;
});

function run() {
  const readings: QuatArray[] = [];
  const sources: string[] = [];
  const onNoSensor = vi.fn();
  const stop = startSensors({
    onReading: (q) => readings.push([...q] as QuatArray),
    onSource: (k) => sources.push(k),
    onNoSensor,
  });
  return { readings, sources, onNoSensor, stop };
}

describe("startSensors", () => {
  it("prefers RelativeOrientationSensor", () => {
    g.RelativeOrientationSensor = FakeSensor;
    const r = run();
    FakeSensor.instances[0].push([0, 0, 0, 1]);
    expect(r.sources).toEqual(["relative-sensor"]);
    expect(r.readings).toEqual([[0, 0, 0, 1]]);
    vi.advanceTimersByTime(5000);
    expect(r.onNoSensor).not.toHaveBeenCalled();
    expect(win.listeners.deviceorientation ?? []).toHaveLength(0);
  });

  it("falls back to deviceorientation when the sensor errors", () => {
    g.RelativeOrientationSensor = FakeSensor;
    const r = run();
    FakeSensor.instances[0].dispatchEvent(new Event("error"));
    expect(FakeSensor.instances[0].started).toBe(false);
    win.emit("deviceorientation", { alpha: 0, beta: 0, gamma: 0 });
    expect(r.sources).toEqual(["deviceorientation"]);
    expect(r.readings).toHaveLength(1);
  });

  it("falls back to deviceorientation when the sensor stays silent", () => {
    g.RelativeOrientationSensor = FakeSensor;
    const r = run();
    vi.advanceTimersByTime(1000);
    win.emit("deviceorientation", { alpha: 10, beta: 20, gamma: 30 });
    expect(r.sources).toEqual(["deviceorientation"]);
  });

  it("uses deviceorientation directly without the Generic Sensor API (iOS)", () => {
    const r = run();
    win.emit("deviceorientation", { alpha: 0, beta: 90, gamma: 0 });
    expect(r.sources).toEqual(["deviceorientation"]);
    expect(r.readings[0][3]).toBeCloseTo(Math.SQRT1_2);
  });

  it("reports no sensor after 2 s without data, ignoring null events", () => {
    const r = run();
    win.emit("deviceorientation", { alpha: null, beta: null, gamma: null });
    vi.advanceTimersByTime(1999);
    expect(r.onNoSensor).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(r.onNoSensor).toHaveBeenCalledOnce();
  });

  it("stop removes listeners", () => {
    const r = run();
    r.stop();
    expect(win.listeners.deviceorientation).toHaveLength(0);
    vi.advanceTimersByTime(5000);
    expect(r.onNoSensor).not.toHaveBeenCalled();
  });
});

describe("requestMotionPermission", () => {
  it("is granted where no prompt exists", async () => {
    await expect(requestMotionPermission()).resolves.toBe("granted");
  });

  it("asks on iOS", async () => {
    g.DeviceOrientationEvent = { requestPermission: vi.fn().mockResolvedValue("denied") };
    await expect(requestMotionPermission()).resolves.toBe("denied");
  });
});
