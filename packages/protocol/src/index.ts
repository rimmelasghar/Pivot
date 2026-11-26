/** Pivot WebSocket protocol. See ../protocol.md. Mirrored by apps/api/pivot_api/ws/messages.py. */

export type Role = "desktop" | "phone";
export type Mode = "full" | "tilt";
export type Quat = [x: number, y: number, z: number, w: number];

export type ErrorCode =
  | "session_expired"
  | "already_paired"
  | "bad_token"
  | "bad_role"
  | "invalid_message"
  | "rate_limited";

export interface HelloMsg {
  t: "hello";
  role: Role;
  client: { ua: string; platform: string };
}
export interface PeerMsg {
  t: "peer";
  connected: boolean;
}
export interface QuatMsg {
  t: "q";
  q: Quat;
  /** Sequence number, increasing per phone connection. */
  s: number;
  /** Phone timestamp in ms. */
  ts: number;
}
export interface RecenterMsg {
  t: "recenter";
}
export interface ModeMsg {
  t: "mode";
  mode: Mode;
}
export interface ModelMsg {
  t: "model";
  name: string;
}
export interface PingMsg {
  t: "ping";
  ts: number;
}
export interface PongMsg {
  t: "pong";
  ts: number;
}
export interface ErrorMsg {
  t: "error";
  code: ErrorCode;
  message: string;
}

/** Messages a client may send to the server. */
export type ClientMessage = HelloMsg | QuatMsg | RecenterMsg | ModeMsg | PingMsg | PongMsg;
/** Messages the phone forwards to the desktop. */
export type PhoneToDesktop = QuatMsg | RecenterMsg | ModeMsg;
/** Messages a client may receive. */
export type ServerMessage = PeerMsg | ModelMsg | PingMsg | PongMsg | ErrorMsg | PhoneToDesktop;

export type Message = ClientMessage | ServerMessage;

export const CLOSE_BAD_TOKEN = 4401;
export const CLOSE_SESSION_EXPIRED = 4404;
export const CLOSE_ALREADY_PAIRED = 4409;
/** Close codes after which a client must not reconnect. */
export const FATAL_CLOSE_CODES = [CLOSE_BAD_TOKEN, CLOSE_SESSION_EXPIRED, CLOSE_ALREADY_PAIRED];

export const PING_INTERVAL_MS = 5000;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const ERROR_CODES: ErrorCode[] = [
  "session_expired",
  "already_paired",
  "bad_token",
  "bad_role",
  "invalid_message",
  "rate_limited",
];

const validators: { [K in Message["t"]]: (m: Record<string, unknown>) => boolean } = {
  hello: (m) =>
    (m.role === "desktop" || m.role === "phone") &&
    typeof m.client === "object" &&
    m.client !== null &&
    isStr((m.client as Record<string, unknown>).ua) &&
    isStr((m.client as Record<string, unknown>).platform),
  peer: (m) => typeof m.connected === "boolean",
  q: (m) =>
    Array.isArray(m.q) &&
    m.q.length === 4 &&
    m.q.every(isNum) &&
    Number.isInteger(m.s) &&
    (m.s as number) >= 0 &&
    isNum(m.ts),
  recenter: () => true,
  mode: (m) => m.mode === "full" || m.mode === "tilt",
  model: (m) => isStr(m.name),
  ping: (m) => isNum(m.ts),
  pong: (m) => isNum(m.ts),
  error: (m) => ERROR_CODES.includes(m.code as ErrorCode) && isStr(m.message),
};

/** Parse and validate a message. Returns null for anything malformed. */
export function parseMessage(data: unknown): Message | null {
  let value: unknown = data;
  if (typeof data === "string") {
    try {
      value = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null) return null;
  const m = value as Record<string, unknown>;
  const check = validators[m.t as Message["t"]];
  return check && check(m) ? (m as unknown as Message) : null;
}

export const encode = (msg: Message): string => JSON.stringify(msg);
