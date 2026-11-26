import type { Role } from "@pivot/protocol";

/** WebSocket URL on the current origin (wss on https). */
export function socketUrl(
  sessionId: string,
  role: Role,
  token: string,
  loc: Pick<Location, "protocol" | "host"> = location,
): string {
  const scheme = loc.protocol === "https:" ? "wss:" : "ws:";
  const query = new URLSearchParams({ role, token });
  return `${scheme}//${loc.host}/ws/${encodeURIComponent(sessionId)}?${query}`;
}
