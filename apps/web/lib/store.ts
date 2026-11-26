import type { ErrorCode } from "@pivot/protocol";
import { create } from "zustand";
import type { SocketStatus } from "./transport/socket";

/**
 * Connection state shown in the UI. Changes rarely (connect, disconnect, RTT every 5 s),
 * so components may subscribe to it. Per-sensor-tick data never goes here.
 */
export interface ConnectionState {
  status: SocketStatus;
  error: ErrorCode | null;
  peerConnected: boolean;
  rtt: number | null;
  setStatus: (status: SocketStatus, error?: ErrorCode) => void;
  setPeer: (connected: boolean) => void;
  setRtt: (ms: number) => void;
  reset: () => void;
}

const initial = { status: "closed" as SocketStatus, error: null, peerConnected: false, rtt: null };

export const useConnection = create<ConnectionState>()((set) => ({
  ...initial,
  setStatus: (status, error) =>
    set((s) => ({
      status,
      error: error ?? (status === "open" ? null : s.error),
      peerConnected: status === "open" ? s.peerConnected : false,
    })),
  setPeer: (peerConnected) => set({ peerConnected }),
  setRtt: (rtt) => set({ rtt: Math.round(rtt) }),
  reset: () => set(initial),
}));
