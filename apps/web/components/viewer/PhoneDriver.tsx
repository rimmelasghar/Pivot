"use client";

import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { motionStore, smoothingAlpha } from "@/lib/motion";

/** Moves the model towards the phone's rotation every frame (no allocations, no React state). */
export function PhoneDriver({ model }: { model: React.RefObject<Group | null> }) {
  useFrame((_, dt) => {
    const s = motionStore.getState();
    const group = model.current;
    if (!group || !s.hasTarget) return;
    // Clamp dt so a background tab does not snap in one huge step.
    group.quaternion.slerp(s.target, smoothingAlpha(Math.min(dt, 0.1)));
  });
  return null;
}
