import { beforeEach, describe, expect, it } from "vitest";
import { useConnection } from "./store";

beforeEach(() => useConnection.getState().reset());

describe("useConnection", () => {
  it("clears the peer when the socket drops", () => {
    const s = useConnection.getState();
    s.setStatus("open");
    s.setPeer(true);
    expect(useConnection.getState().peerConnected).toBe(true);
    s.setStatus("reconnecting");
    expect(useConnection.getState().peerConnected).toBe(false);
  });

  it("keeps the error until the socket opens again", () => {
    const s = useConnection.getState();
    s.setStatus("failed", "already_paired");
    expect(useConnection.getState().error).toBe("already_paired");
    s.setStatus("open");
    expect(useConnection.getState().error).toBeNull();
  });

  it("rounds RTT", () => {
    useConnection.getState().setRtt(12.7);
    expect(useConnection.getState().rtt).toBe(13);
  });
});
