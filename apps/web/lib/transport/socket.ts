import {
  encode,
  FATAL_CLOSE_CODES,
  parseMessage,
  PING_INTERVAL_MS,
  type ClientMessage,
  type ErrorCode,
  type Role,
  type ServerMessage,
} from "@pivot/protocol";

export type SocketStatus = "connecting" | "open" | "reconnecting" | "failed" | "closed";

export interface SocketOptions {
  url: string;
  role: Role;
  onMessage: (msg: ServerMessage) => void;
  onStatus?: (status: SocketStatus, error?: ErrorCode) => void;
  onRtt?: (ms: number) => void;
  /** Injected for tests. */
  WebSocketImpl?: typeof WebSocket;
  now?: () => number;
}

export const MIN_BACKOFF_MS = 1000;
export const MAX_BACKOFF_MS = 8000;

/** Delay before reconnect attempt `n` (0-based): 1 s, 2 s, 4 s, 8 s, 8 s, … */
export function backoff(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** attempt);
}

/** WebSocket with hello on open, 5 s ping/pong RTT and reconnect with exponential backoff. */
export class PivotSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private lastError: ErrorCode | undefined;
  private readonly WS: typeof WebSocket;
  private readonly now: () => number;
  status: SocketStatus = "closed";

  constructor(private readonly opts: SocketOptions) {
    this.WS = opts.WebSocketImpl ?? WebSocket;
    this.now = opts.now ?? (() => performance.now());
  }

  connect(): void {
    this.stopped = false;
    this.open();
  }

  /** Send if connected. Returns false when the message was not sent. */
  send(msg: ClientMessage): boolean {
    if (this.ws?.readyState !== this.WS.OPEN) return false;
    this.ws.send(encode(msg));
    return true;
  }

  /** Close for good (no reconnect). */
  close(): void {
    this.stopped = true;
    this.clearTimers();
    this.ws?.close(1000);
    this.ws = null;
    this.setStatus("closed");
  }

  /** Reconnect now (e.g. when the page becomes visible again), skipping any backoff wait. */
  reconnectNow(): void {
    if (this.stopped || this.status === "failed" || this.status === "open") return;
    this.attempt = 0;
    this.open();
  }

  private open(): void {
    this.clearTimers();
    this.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    const ws = new this.WS(this.opts.url);
    this.ws = ws;
    ws.onopen = () => {
      if (ws !== this.ws) return;
      this.attempt = 0;
      this.lastError = undefined;
      this.setStatus("open");
      this.sendHello();
      this.ping();
      this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
    };
    ws.onmessage = (event: MessageEvent) => {
      if (ws !== this.ws) return;
      const msg = parseMessage(event.data);
      if (!msg) return;
      if (msg.t === "pong") return this.opts.onRtt?.(this.now() - msg.ts);
      if (msg.t === "ping") return void this.send({ t: "pong", ts: msg.ts });
      if (msg.t === "error") this.lastError = msg.code;
      this.opts.onMessage(msg as ServerMessage);
    };
    ws.onclose = (event: CloseEvent) => {
      if (ws !== this.ws) return;
      this.ws = null;
      this.clearTimers();
      if (this.stopped) return;
      if (FATAL_CLOSE_CODES.includes(event.code)) {
        this.setStatus("failed", this.lastError);
        return;
      }
      this.scheduleReconnect();
    };
    // onerror is always followed by onclose; nothing to do here.
    ws.onerror = () => {};
  }

  private scheduleReconnect(): void {
    const delay = backoff(this.attempt);
    this.attempt += 1;
    this.setStatus("reconnecting");
    this.retryTimer = setTimeout(() => this.open(), delay);
  }

  private sendHello(): void {
    const nav = typeof navigator === "undefined" ? undefined : navigator;
    this.send({
      t: "hello",
      role: this.opts.role,
      client: { ua: (nav?.userAgent ?? "").slice(0, 256), platform: detectPlatform(nav) },
    });
  }

  private ping(): void {
    this.send({ t: "ping", ts: this.now() });
  }

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.retryTimer = null;
    this.pingTimer = null;
  }

  private setStatus(status: SocketStatus, error?: ErrorCode): void {
    this.status = status;
    this.opts.onStatus?.(status, error);
  }
}

function detectPlatform(nav: Navigator | undefined): string {
  const ua = nav?.userAgent ?? "";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}
