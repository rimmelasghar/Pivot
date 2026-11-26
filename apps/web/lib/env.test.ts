import { describe, expect, it } from "vitest";
import { wsUrl } from "./env";

describe("wsUrl", () => {
  it("uses wss on https", () => {
    expect(wsUrl("/ws/a", { protocol: "https:", host: "x.dev" })).toBe("wss://x.dev/ws/a");
  });
  it("uses ws on http", () => {
    expect(wsUrl("/ws/a", { protocol: "http:", host: "localhost:8080" })).toBe(
      "ws://localhost:8080/ws/a",
    );
  });
});
