"use client";

import { useState } from "react";
import { useConnection } from "@/lib/store";
import { usePivotSocket } from "@/lib/usePivotSocket";

interface Props {
  sessionId: string;
  pairToken: string;
}

export function Controller({ sessionId, pairToken }: Props) {
  const [started, setStarted] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const status = useConnection((s) => s.status);
  const peer = useConnection((s) => s.peerConnected);

  usePivotSocket({
    sessionId,
    role: "phone",
    token: pairToken,
    enabled: started,
    onMessage: (msg) => msg.t === "model" && setModelName(msg.name),
  });

  if (!started) {
    return (
      <button
        data-testid="connect"
        onClick={() => setStarted(true)}
        className="flex h-full w-full flex-col items-center justify-center gap-3 bg-sky-500 text-white active:bg-sky-600"
      >
        <span className="text-3xl font-semibold">Tap to connect</span>
        <span className="text-sm opacity-80">Then move your phone to rotate the model</span>
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p data-testid="phone-status" className="text-2xl font-semibold">
        {status !== "open" ? "Connecting…" : peer ? "Connected" : "Waiting for the desktop…"}
      </p>
      {modelName && <p className="text-white/60">{modelName}</p>}
    </div>
  );
}
