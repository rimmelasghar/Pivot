import { describe, expect, it } from "vitest";
import { errorScreen, statusText } from "./errors";

describe("errorScreen", () => {
  it("has clear screens for the common failures", () => {
    expect(errorScreen("session_expired")?.title).toBe("Session expired");
    expect(errorScreen("already_paired")?.title).toBe("Already paired");
    expect(errorScreen("no_sensor")?.title).toBe("No motion sensor");
  });

  it("returns null when there is no error", () => {
    expect(errorScreen(null)).toBeNull();
    expect(errorScreen(undefined)).toBeNull();
  });
});

describe("statusText", () => {
  it("shows RTT once connected to the other side", () => {
    expect(statusText("open", true, 23)).toBe("Connected · 23 ms");
    expect(statusText("open", true, null)).toBe("Connected");
  });

  it("describes in-between states", () => {
    expect(statusText("open", false, 5)).toBe("Waiting for the computer…");
    expect(statusText("reconnecting", false, null)).toBe("Reconnecting…");
    expect(statusText("failed", false, null)).toBe("Disconnected");
  });
});
