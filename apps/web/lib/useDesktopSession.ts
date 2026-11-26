"use client";

import { useEffect, useState } from "react";
import { createSession, getSession, type SessionCreated, type SessionState } from "./api";

const KEY = "pivot.desktopSession";

function loadSaved(): SessionCreated | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionCreated) : null;
  } catch {
    return null;
  }
}

function save(session: SessionCreated) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (private mode): a reload creates a new session.
  }
}

export type DesktopSession = SessionCreated & { initial: SessionState | null };

/** Create a session on load; reuse this tab's session after a reload if it is still alive. */
export function useDesktopSession() {
  const [session, setSession] = useState<DesktopSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = loadSaved();
      if (saved) {
        const state = await getSession(saved.sessionId).catch(() => null);
        if (state) {
          if (!cancelled) setSession({ ...saved, initial: state });
          return;
        }
      }
      const created = await createSession();
      save(created);
      if (!cancelled) setSession({ ...created, initial: null });
    })().catch((e: Error) => !cancelled && setError(e.message || "Could not create a session."));
    return () => {
      cancelled = true;
    };
  }, []);

  return { session, error };
}
