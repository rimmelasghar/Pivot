import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "@pivot/protocol";
import { backoff, PivotSocket, type SocketStatus } from "./socket";

class FakeWS {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWS[] = [];
  readyState = FakeWS.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeWS.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = FakeWS.CLOSED;
  }
  // Test helpers
  serverOpen() {
    this.readyState = FakeWS.OPEN;
    this.onopen?.();
  }
  serverSend(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  serverClose(code = 1006) {
    this.readyState = FakeWS.CLOSED;
    this.onclose?.({ code });
  }
}

const latest = () => FakeWS.instances[FakeWS.instances.length - 1];

function setup() {
  const messages: ServerMessage[] = [];
  const statuses: SocketStatus[] = [];
  const rtts: number[] = [];
  let clock = 1000;
  const socket = new PivotSocket({
    url: "ws://test/ws/abc?role=phone&token=t",
    role: "phone",
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
    onRtt: (ms) => rtts.push(ms),
    WebSocketImpl: FakeWS as unknown as typeof WebSocket,
    now: () => clock,
  });
  return { socket, messages, statuses, rtts, tick: (ms: number) => (clock += ms) };
}

beforeEach(() => {
  FakeWS.instances = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("backoff", () => {
  it("doubles from 1 s and caps at 8 s", () => {
    expect([0, 1, 2, 3, 4, 10].map(backoff)).toEqual([1000, 2000, 4000, 8000, 8000, 8000]);
  });
});

describe("PivotSocket", () => {
  it("sends hello and a ping on open", () => {
    const { socket, statuses } = setup();
    socket.connect();
    latest().serverOpen();
    const sent = latest().sent.map((s) => JSON.parse(s));
    expect(sent[0]).toMatchObject({ t: "hello", role: "phone" });
    expect(sent[1]).toEqual({ t: "ping", ts: 1000 });
    expect(statuses).toEqual(["connecting", "open"]);
  });

  it("measures round-trip time from pong", () => {
    const { socket, rtts, tick } = setup();
    socket.connect();
    latest().serverOpen();
    tick(37);
    latest().serverSend({ t: "pong", ts: 1000 });
    expect(rtts).toEqual([37]);
  });

  it("pings every 5 s", () => {
    const { socket } = setup();
    socket.connect();
    latest().serverOpen();
    vi.advanceTimersByTime(10_000);
    expect(latest().sent.filter((s) => s.includes('"ping"'))).toHaveLength(3);
  });

  it("delivers valid messages and drops malformed ones", () => {
    const { socket, messages } = setup();
    socket.connect();
    latest().serverOpen();
    latest().serverSend({ t: "peer", connected: true });
    latest().serverSend({ t: "peer", connected: "maybe" });
    latest().onmessage?.({ data: "{oops" });
    expect(messages).toEqual([{ t: "peer", connected: true }]);
  });

  it("reconnects with backoff after an unexpected close", () => {
    const { socket, statuses } = setup();
    socket.connect();
    latest().serverOpen();
    latest().serverClose(1006);
    expect(FakeWS.instances).toHaveLength(1);
    vi.advanceTimersByTime(999);
    expect(FakeWS.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWS.instances).toHaveLength(2);

    // Second failure waits 2 s.
    latest().serverClose(1006);
    vi.advanceTimersByTime(1999);
    expect(FakeWS.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWS.instances).toHaveLength(3);

    // A successful open resets the backoff.
    latest().serverOpen();
    latest().serverClose(1006);
    vi.advanceTimersByTime(1000);
    expect(FakeWS.instances).toHaveLength(4);
    expect(statuses).toContain("reconnecting");
  });

  it("never waits longer than 8 s", () => {
    const { socket } = setup();
    socket.connect();
    for (let i = 0; i < 6; i++) {
      latest().serverClose(1006);
      vi.advanceTimersByTime(8000);
    }
    expect(FakeWS.instances).toHaveLength(7);
  });

  it("stops on fatal close codes and reports the error", () => {
    const statuses: [SocketStatus, string | undefined][] = [];
    const socket = new PivotSocket({
      url: "ws://x",
      role: "phone",
      onMessage: () => {},
      onStatus: (s, e) => statuses.push([s, e]),
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
    });
    socket.connect();
    latest().serverOpen();
    latest().serverSend({ t: "error", code: "already_paired", message: "x" });
    latest().serverClose(4409);
    vi.advanceTimersByTime(60_000);
    expect(FakeWS.instances).toHaveLength(1);
    expect(statuses.at(-1)).toEqual(["failed", "already_paired"]);
  });

  it("does not reconnect after close()", () => {
    const { socket } = setup();
    socket.connect();
    latest().serverOpen();
    socket.close();
    latest().serverClose(1000);
    vi.advanceTimersByTime(60_000);
    expect(FakeWS.instances).toHaveLength(1);
    expect(socket.send({ t: "recenter" })).toBe(false);
  });

  it("reconnectNow skips the backoff wait", () => {
    const { socket } = setup();
    socket.connect();
    latest().serverClose(1006);
    socket.reconnectNow();
    expect(FakeWS.instances).toHaveLength(2);
  });

  it("reconnectNow leaves an attempt in flight alone", () => {
    const { socket } = setup();
    socket.connect();
    socket.reconnectNow();
    latest().serverOpen();
    socket.reconnectNow();
    expect(FakeWS.instances).toHaveLength(1);
  });
});
