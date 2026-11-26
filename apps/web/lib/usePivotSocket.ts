"use client";

import type { Role, ServerMessage } from "@pivot/protocol";
import { useEffect, useRef, useState } from "react";
import { useConnection } from "./store";
import { PivotSocket } from "./transport/socket";
import { phoneClientId, socketUrl } from "./transport/url";

interface Params {
  sessionId: string;
  role: Role;
  token: string;
  enabled?: boolean;
  /** Called for every message other than peer/pong. Keep it cheap: no React state per sensor tick. */
  onMessage?: (msg: ServerMessage) => void;
}

/** Owns one PivotSocket for the component's lifetime and mirrors its state into useConnection. */
export function usePivotSocket({ sessionId, role, token, enabled = true, onMessage }: Params) {
  const [socket, setSocket] = useState<PivotSocket | null>(null);
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;
    const conn = useConnection.getState();
    conn.reset();
    const s = new PivotSocket({
      url: socketUrl(sessionId, role, token, role === "phone" ? phoneClientId(sessionId) : ""),
      role,
      onStatus: (status, error) => useConnection.getState().setStatus(status, error),
      onRtt: (ms) => useConnection.getState().setRtt(ms),
      onMessage: (msg) => {
        if (msg.t === "peer") useConnection.getState().setPeer(msg.connected);
        else handler.current?.(msg);
      },
    });
    s.connect();
    setSocket(s);
    return () => {
      s.close();
      setSocket(null);
    };
  }, [sessionId, role, token, enabled]);

  return socket;
}
