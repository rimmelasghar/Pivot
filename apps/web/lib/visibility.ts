"use client";

import { useEffect, useState } from "react";

type Doc = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

/** Call `cb(visible)` whenever page visibility changes. Returns an unsubscribe function. */
export function watchVisibility(doc: Doc, cb: (visible: boolean) => void): () => void {
  const handler = () => cb(doc.visibilityState === "visible");
  doc.addEventListener("visibilitychange", handler);
  return () => doc.removeEventListener("visibilitychange", handler);
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(document.visibilityState === "visible");
    return watchVisibility(document, setVisible);
  }, []);
  return visible;
}
