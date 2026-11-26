import { describe, expect, it } from "vitest";
import { checkFile, toApiError } from "./api";

describe("toApiError", () => {
  it("uses the server message when present", () => {
    const err = toApiError(413, { detail: "too_large", message: "File is larger than 50 MB" });
    expect(err.code).toBe("too_large");
    expect(err.message).toBe("File is larger than 50 MB");
  });

  it("maps known codes to friendly text", () => {
    expect(toApiError(404, { detail: "session_expired" }).message).toMatch(/expired/);
  });

  it("handles empty bodies", () => {
    const err = toApiError(500, null);
    expect(err.code).toBe("http_500");
    expect(err.status).toBe(500);
  });
});

describe("checkFile", () => {
  it("accepts glb and gltf", () => {
    expect(checkFile({ name: "Duck.GLB", size: 10 })).toBeNull();
    expect(checkFile({ name: "scene.gltf", size: 10 })).toBeNull();
  });

  it("rejects other types, empty and oversized files", () => {
    expect(checkFile({ name: "a.obj", size: 10 })).toMatch(/glb/);
    expect(checkFile({ name: "a.glb", size: 0 })).toMatch(/empty/);
    expect(checkFile({ name: "a.glb", size: 51 * 1024 * 1024 })).toMatch(/50 MB/);
  });
});
