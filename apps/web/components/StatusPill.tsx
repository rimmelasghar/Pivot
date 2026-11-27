"use client";

import { statusText } from "@/lib/errors";
import { useConnection } from "@/lib/store";

export function StatusPill() {
  const status = useConnection((s) => s.status);
  const peer = useConnection((s) => s.peerConnected);
  const rtt = useConnection((s) => s.rtt);
  const good = status === "open" && peer;
  const dot = good ? "bg-emerald-400" : status === "open" ? "bg-amber-400" : "bg-red-400";
  return (
    <div
      data-testid="status-pill"
      className="inline-flex items-center gap-2 rounded-full bg-fg/5 px-4 py-2 text-sm"
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {statusText(status, peer, rtt)}
    </div>
  );
}
