"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { getPublicUrl } from "@/lib/api";
import { useConnection } from "@/lib/store";

/** Poll /api/public-url every second until the tunnel is ready. */
function usePublicUrl() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const { url } = await getPublicUrl();
        if (!cancelled) setUrl(url);
      } catch {
        if (!cancelled) timer = setTimeout(poll, 1000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  return url;
}

export function QrPanel({ pairUrl }: { pairUrl: string }) {
  const publicUrl = usePublicUrl();
  const peer = useConnection((s) => s.peerConnected);
  const status = useConnection((s) => s.status);
  const rtt = useConnection((s) => s.rtt);
  const link = publicUrl ? `${publicUrl}${pairUrl}` : null;

  if (peer) {
    return (
      <div
        data-testid="phone-connected"
        className="flex items-center gap-2 rounded-full bg-ok/15 px-4 py-2 text-sm text-ok"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        Phone connected{rtt !== null && <span className="text-ok/60">· {rtt} ms</span>}
      </div>
    );
  }

  return (
    <div className="w-64 rounded-2xl bg-fg/5 p-4 text-center backdrop-blur">
      <p className="mb-3 text-sm font-medium">Scan with your phone</p>
      <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl bg-white p-3">
        {link ? (
          <QRCodeSVG data-testid="pair-qr" value={link} size={168} level="M" />
        ) : (
          <p className="text-xs text-black/60">Preparing secure link…</p>
        )}
      </div>
      {link && (
        <a
          data-testid="pair-link"
          href={link}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block truncate text-xs text-fg/40 hover:text-fg/70"
        >
          {link}
        </a>
      )}
      {status !== "open" && (
        <p className="mt-2 text-xs text-warn/80">
          {status === "failed" ? "Connection failed" : "Connecting to server…"}
        </p>
      )}
    </div>
  );
}
