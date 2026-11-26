import { describe, expect, it } from "vitest";
import { socketUrl } from "./url";

describe("socketUrl", () => {
  it("uses wss on https", () => {
    expect(socketUrl("abc", "phone", "t/k", "", { protocol: "https:", host: "x.dev" })).toBe(
      "wss://x.dev/ws/abc?role=phone&token=t%2Fk",
    );
  });
  it("uses ws on http", () => {
    expect(
      socketUrl("abc", "desktop", "t", "", { protocol: "http:", host: "localhost:8080" }),
    ).toBe("ws://localhost:8080/ws/abc?role=desktop&token=t");
  });

  it("adds the client id when given", () => {
    expect(socketUrl("abc", "phone", "t", "c1", { protocol: "https:", host: "x" })).toBe(
      "wss://x/ws/abc?role=phone&token=t&cid=c1",
    );
  });
});
