"use client";

import type { Mode } from "@pivot/protocol";
import { useEffect, useState } from "react";
import { ErrorCard } from "@/components/ErrorCard";
import { StatusPill } from "@/components/StatusPill";
import { errorScreen } from "@/lib/errors";
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
  const error = useConnection((s) => s.error);
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
  const reload = () => location.reload();

  const fatal = status === "failed" ? errorScreen(error) : null;
  if (fatal) {
    return <ErrorCard screen={fatal} onAction={fatal.action === "reload" ? reload : undefined} />;
  }
  if (denied) return <ErrorCard screen={errorScreen("motion_denied")!} onAction={reload} />;
  if (noSensor) return <ErrorCard screen={errorScreen("no_sensor")!} />;

  if (!started) {
    return (
      <button
        data-testid="connect"
        onClick={start}
        className="flex h-full w-full flex-col items-center justify-center gap-3 bg-sky-500 p-6 text-white active:bg-sky-600"
      >
        <span className="text-3xl font-semibold">Tap to connect</span>
        <span className="text-sm opacity-80">Then move your phone to rotate the model</span>
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-between gap-6 p-6 text-center">
      <div className="flex flex-col items-center gap-2 pt-4">
        <StatusPill />
        {modelName && (
          <p data-testid="model-name" className="max-w-full truncate text-white/60">
            {modelName}
          </p>
        )}
      </div>
      <p className="text-sm text-white/40">Move your phone to rotate the model.</p>
      <Controls
        mode={mode}
        onModeChange={setMode}
        onRecenter={() => {
          socket?.send({ t: "recenter" });
          navigator.vibrate?.(15);
        }}
      />
      {source && <p className="text-xs text-white/25">sensor: {source}</p>}
    </div>
  );
}
