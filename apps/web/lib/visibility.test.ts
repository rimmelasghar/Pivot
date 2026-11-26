import { describe, expect, it } from "vitest";
import { watchVisibility } from "./visibility";

class FakeDoc extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  set(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

describe("watchVisibility", () => {
  it("reports hidden and visible", () => {
    const doc = new FakeDoc();
    const seen: boolean[] = [];
    const stop = watchVisibility(doc, (v) => seen.push(v));
    doc.set("hidden");
    doc.set("visible");
    stop();
    doc.set("hidden");
    expect(seen).toEqual([false, true]);
  });
});
