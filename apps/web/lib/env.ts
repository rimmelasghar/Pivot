/** Build a ws:// or wss:// URL on the current origin. */
export function wsUrl(path: string, loc: Pick<Location, "protocol" | "host"> = location): string {
  const scheme = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${loc.host}${path}`;
}
