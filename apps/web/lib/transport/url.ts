import type { Role } from "@pivot/protocol";

/** WebSocket URL on the current origin (wss on https). */
export function socketUrl(
  sessionId: string,
  role: Role,
  token: string,
  clientId = "",
  loc: Pick<Location, "protocol" | "host"> = location,
): string {
  const scheme = loc.protocol === "https:" ? "wss:" : "ws:";
  const query = new URLSearchParams({ role, token });
  if (clientId) query.set("cid", clientId);
  return `${scheme}//${loc.host}/ws/${encodeURIComponent(sessionId)}?${query}`;
}

/** Stable id for this phone page (kept across reloads of the tab), so it can reclaim its slot. */
export function phoneClientId(sessionId: string): string {
  const key = `pivot.cid.${sessionId}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
  } catch {
    // Storage unavailable: a fresh id per page load still works.
  }
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    sessionStorage.setItem(key, id);
  } catch {
    // ignore
  }
  return id;
}
