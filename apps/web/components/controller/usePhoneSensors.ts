"use client";

import { useEffect, useRef, useState } from "react";
import type { QuatArray } from "@/lib/sensors/euler";
import { startSensors, type SourceKind } from "@/lib/sensors/sources";
import { keepScreenOn } from "@/lib/sensors/wakeLock";

export interface Latest {
  q: QuatArray;
  /** Increments on every reading, so consumers can tell if anything new arrived. */
  version: number;
}

/**
 * Runs the sensors while `active`. The latest reading lives in a ref (never React state):
 * readers poll it once per animation frame.
 */
export function usePhoneSensors(active: boolean) {
  const latest = useRef<Latest>({ q: [0, 0, 0, 1], version: 0 });
  const [source, setSource] = useState<SourceKind | null>(null);
  const [noSensor, setNoSensor] = useState(false);
  const noSensorShown = useRef(false);

  useEffect(() => {
    if (!active) return;
    const releaseWakeLock = keepScreenOn();
    const stop = startSensors({
      onReading: (q) => {
        const l = latest.current;
        l.q[0] = q[0];
        l.q[1] = q[1];
        l.q[2] = q[2];
        l.q[3] = q[3];
        l.version += 1;
        // Data arrived late: hide the warning (one state update, not one per reading).
        if (noSensorShown.current) {
          noSensorShown.current = false;
          setNoSensor(false);
        }
      },
      onSource: setSource,
      onNoSensor: () => {
        noSensorShown.current = true;
        setNoSensor(true);
      },
    });
    return () => {
      stop();
      releaseWakeLock();
    };
  }, [active]);

  return { latest, source, noSensor };
}
