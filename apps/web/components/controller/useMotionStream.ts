"use client";

import { useEffect, useRef } from "react";
import { MotionThrottle, round5 } from "@/lib/sensors/throttle";
import { useConnection } from "@/lib/store";
import type { PivotSocket } from "@/lib/transport/socket";
import type { Latest } from "./usePhoneSensors";

/** Once per animation frame, send the latest orientation if the throttle allows it. */
export function useMotionStream(
  socket: PivotSocket | null,
  latest: React.RefObject<Latest>,
  active: boolean,
) {
  const throttle = useRef(new MotionThrottle());
  const seq = useRef(0);

  // After (re)connecting or when the desktop joins, resend the current pose even if still.
  useEffect(
    () =>
      useConnection.subscribe((s, prev) => {
        if (s.peerConnected !== prev.peerConnected || s.status !== prev.status) {
          throttle.current.reset();
        }
      }),
    [],
  );

  useEffect(() => {
    if (!socket || !active) return;
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const l = latest.current;
      if (l.version === 0) return; // no reading yet
      if (!throttle.current.shouldSend(l.q, now)) return;
      const sent = socket.send({
        t: "q",
        q: [round5(l.q[0]), round5(l.q[1]), round5(l.q[2]), round5(l.q[3])],
        s: seq.current,
        ts: Date.now(),
      });
      if (sent) seq.current += 1;
      else throttle.current.reset();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [socket, latest, active]);
}
