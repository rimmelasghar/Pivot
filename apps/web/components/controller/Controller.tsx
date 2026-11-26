"use client";

import type { Mode } from "@pivot/protocol";
import { useEffect, useState } from "react";
import { requestMotionPermission } from "@/lib/sensors/sources";
import { useConnection } from "@/lib/store";
import { usePivotSocket } from "@/lib/usePivotSocket";
import { Controls } from "./Controls";
import { useMotionStream } from "./useMotionStream";
import { usePhoneSensors } from "./usePhoneSensors";

interface Props {
  sessionId: string;
  pairToken: string;
}

export function Controller({ sessionId, pairToken }: Props) {
  const [started, setStarted] = useState(false);
  const [denied, setDenied] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("full");
  const status = useConnection((s) => s.status);
  const peer = useConnection((s) => s.peerConnected);
  const { latest, source, noSensor } = usePhoneSensors(started);

  const socket = usePivotSocket({
    sessionId,
    role: "phone",
    token: pairToken,
    enabled: started,
    onMessage: (msg) => msg.t === "model" && setModelName(msg.name),
  });
  useMotionStream(socket, latest, started);

  // The desktop forgets the mode when either side reconnects: tell it again.
  useEffect(() => {
    if (status === "open" && peer) socket?.send({ t: "mode", mode });
  }, [socket, status, peer, mode]);

  const start = async () => {
    // Must run inside the tap handler: iOS only shows the prompt for a user gesture.
    const permission = await requestMotionPermission();
    if (permission === "denied") return setDenied(true);
    setStarted(true);
  };

  if (!started) {
    return (
      <button
        data-testid="connect"
        onClick={start}
        className="flex h-full w-full flex-col items-center justify-center gap-3 bg-sky-500 p-6 text-white active:bg-sky-600"
      >
        <span className="text-3xl font-semibold">Tap to connect</span>
        <span className="text-sm opacity-80">Then move your phone to rotate the model</span>
        {denied && (
          <span className="mt-4 rounded-lg bg-black/20 p-3 text-sm">
            Motion access was denied. Allow it in Safari settings for this site, then tap again.
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <p data-testid="phone-status" className="text-2xl font-semibold">
        {status !== "open" ? "Connecting…" : peer ? "Connected" : "Waiting for the desktop…"}
      </p>
      {modelName && <p className="text-white/60">{modelName}</p>}
      <Controls
        mode={mode}
        onModeChange={setMode}
        onRecenter={() => {
          socket?.send({ t: "recenter" });
          navigator.vibrate?.(15);
        }}
      />
      {noSensor && (
        <p data-testid="no-sensor" className="text-red-400">
          This device has no motion sensor.
        </p>
      )}
      {source && <p className="text-xs text-white/30">sensor: {source}</p>}
    </div>
  );
}
