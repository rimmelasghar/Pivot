import type { PhoneToDesktop } from "@pivot/protocol";
import { Quaternion } from "three";
import { createStore } from "zustand/vanilla";
import type { QuatArray } from "./sensors/euler";
import { Calibrator } from "./sensors/quat";

/**
 * Desktop motion state. Updated up to 60 times per second, so it is a vanilla Zustand
 * store whose objects are mutated in place: no React renders, no allocations per message.
 * The viewer reads `target` once per frame in useFrame.
 */
export interface MotionState {
  /** Rotation the model should move towards (scene space). */
  target: Quaternion;
  hasTarget: boolean;
  tiltOnly: boolean;
  lastSeq: number;
  raw: QuatArray;
  hasRaw: boolean;
  calibrator: Calibrator;
  /** Calibrate on the next q (first message from a newly connected phone). */
  pendingCalibration: boolean;
  /** Applied before the phone rotation, so re-calibrating after a reconnect keeps the pose. */
  offset: Quaternion;
  applied: Quaternion;
}

export const createMotionStore = () =>
  createStore<MotionState>()(() => ({
    target: new Quaternion(),
    hasTarget: false,
    tiltOnly: false,
    lastSeq: -1,
    raw: [0, 0, 0, 1],
    hasRaw: false,
    calibrator: new Calibrator(),
    pendingCalibration: true,
    offset: new Quaternion(),
    applied: new Quaternion(),
  }));

export const motionStore = createMotionStore();
type Store = typeof motionStore;

function recompute(s: MotionState) {
  s.calibrator.apply(s.raw, s.tiltOnly, s.applied);
  s.target.copy(s.offset).multiply(s.applied);
  s.hasTarget = true;
}

/** Handle q / recenter / mode from the phone. */
export function handlePhoneMessage(msg: PhoneToDesktop, store: Store = motionStore): void {
  const s = store.getState();
  switch (msg.t) {
    case "q": {
      if (msg.s < s.lastSeq) return; // stale or out of order
      s.lastSeq = msg.s;
      s.raw[0] = msg.q[0];
      s.raw[1] = msg.q[1];
      s.raw[2] = msg.q[2];
      s.raw[3] = msg.q[3];
      s.hasRaw = true;
      if (s.pendingCalibration) {
        // Keep whatever pose the model shows now; motion continues from there.
        if (s.hasTarget) s.offset.copy(s.target);
        s.calibrator.calibrate(s.raw);
        s.pendingCalibration = false;
      }
      recompute(s);
      return;
    }
    case "recenter":
      s.offset.identity();
      if (s.hasRaw) {
        s.calibrator.calibrate(s.raw);
        recompute(s);
      } else {
        s.pendingCalibration = true;
      }
      return;
    case "mode":
      s.tiltOnly = msg.mode === "tilt";
      if (s.hasRaw && !s.pendingCalibration) recompute(s);
      return;
  }
}

/** A phone (re)connected: its sequence numbers and sensor frame may have restarted. */
export function onPhoneConnected(store: Store = motionStore): void {
  const s = store.getState();
  s.lastSeq = -1;
  s.pendingCalibration = true;
}

/** New model loaded: start from the neutral pose. */
export function resetPose(store: Store = motionStore): void {
  const s = store.getState();
  s.offset.identity();
  s.target.identity();
  s.hasTarget = false;
  s.pendingCalibration = true;
}

/** Frame-rate independent smoothing factor for slerp (k = 18). */
export const SMOOTHING_K = 18;
export const smoothingAlpha = (dt: number, k = SMOOTHING_K) => 1 - Math.exp(-k * dt);

// Read-only handle for end-to-end tests and debugging in the browser console.
if (typeof window !== "undefined") {
  (window as unknown as { __pivot?: object }).__pivot = { motion: motionStore };
}
