"use client";

import { useState } from "react";
import { UploadZone } from "@/components/desktop/UploadZone";
import type { ModelUploaded } from "@/lib/api";
import { useDesktopSession } from "@/lib/useDesktopSession";

export default function DesktopPage() {
  const { session, error } = useDesktopSession();
  const [uploaded, setUploaded] = useState<ModelUploaded | null>(null);

  const model =
    uploaded ??
    (session?.initial?.modelUrl
      ? { modelUrl: session.initial.modelUrl, modelName: session.initial.modelName ?? "model" }
      : null);

  return (
    <main className="flex h-full flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Pivot</h1>
        {model && <span className="text-sm text-white/60">{model.modelName}</span>}
      </header>
      <section className="flex flex-1 items-center justify-center p-6">
        {error && <p className="text-red-400">{error}</p>}
        {!error && !session && <p className="text-white/50">Starting session…</p>}
        {session && !model && (
          <UploadZone
            sessionId={session.sessionId}
            token={session.desktopToken}
            onUploaded={setUploaded}
          />
        )}
        {session && model && <p data-testid="model-ready">Model ready: {model.modelName}</p>}
      </section>
    </main>
  );
}
