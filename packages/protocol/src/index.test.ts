import { describe, expect, it } from "vitest";
import { encode, parseMessage, type Message } from "./index";

const valid: Message[] = [
  { t: "hello", role: "phone", client: { ua: "Mozilla", platform: "iPhone" } },
  { t: "peer", connected: true },
  { t: "q", q: [0, 0, 0, 1], s: 12, ts: 1700000000000 },
  { t: "recenter" },
  { t: "mode", mode: "tilt" },
  { t: "model", name: "Duck.glb" },
  { t: "ping", ts: 1 },
  { t: "pong", ts: 1 },
  { t: "error", code: "already_paired", message: "Another phone is connected" },
];

const invalid: unknown[] = [
  "not json",
  42,
  null,
  { t: "nope" },
  { t: "hello", role: "tablet", client: { ua: "", platform: "" } },
  { t: "hello", role: "phone" },
  { t: "peer", connected: "yes" },
  { t: "q", q: [0, 0, 1], s: 1, ts: 1 },
  { t: "q", q: [0, 0, 0, "1"], s: 1, ts: 1 },
  { t: "q", q: [0, 0, 0, Infinity], s: 1, ts: 1 },
  { t: "q", q: [0, 0, 0, 1], s: -1, ts: 1 },
  { t: "q", q: [0, 0, 0, 1], s: 1.5, ts: 1 },
  { t: "mode", mode: "spin" },
  { t: "model" },
  { t: "ping" },
  { t: "error", code: "whatever", message: "x" },
];

describe("parseMessage", () => {
  it.each(valid.map((m) => [m.t, m] as const))("accepts %s", (_, msg) => {
    expect(parseMessage(encode(msg))).toEqual(msg);
    expect(parseMessage(msg)).toEqual(msg);
  });

  it.each(invalid.map((m) => [JSON.stringify(m), m] as const))("rejects %s", (_, msg) => {
    expect(parseMessage(typeof msg === "string" ? msg : JSON.stringify(msg))).toBeNull();
  });
});
